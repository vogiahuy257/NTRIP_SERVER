#include "config_http_client.hpp"

#include <cstdio>
#include <cstring>

#include "app_defaults.hpp"
#include "cJSON.h"
#include "esp_system.h"
#include "network_manager.hpp"
#include "runtime_config.hpp"

namespace
{

template <std::size_t N>
void copy_if_present(
    cJSON* object,
    const char* name,
    char (&destination)[N])
{
    cJSON* value = cJSON_GetObjectItemCaseSensitive(object, name);

    if (!cJSON_IsString(value) ||
        value->valuestring == nullptr ||
        value->valuestring[0] == '\0') {
        return;
    }

    std::strncpy(destination, value->valuestring, N - 1);
    destination[N - 1] = '\0';
}

void set_authorization(
    esp_http_client_handle_t client,
    const char* token)
{
    char header[192]{};

    std::snprintf(
        header,
        sizeof(header),
        "Bearer %s",
        token);

    esp_http_client_set_header(
        client,
        "Authorization",
        header);
}

}  // namespace

esp_err_t ConfigHttpClient::initialize()
{
    return xTaskCreate(
        &ConfigHttpClient::entry,
        "config_http",
        6144,
        this,
        3,
        nullptr) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

void ConfigHttpClient::entry(void* context)
{
    static_cast<ConfigHttpClient*>(context)->task();
}

esp_err_t ConfigHttpClient::http_event(
    esp_http_client_event_t* event)
{
    if (event->event_id != HTTP_EVENT_ON_DATA ||
        event->user_data == nullptr ||
        event->data == nullptr ||
        event->data_len <= 0) {
        return ESP_OK;
    }

    auto* response =
        static_cast<ResponseBuffer*>(event->user_data);

    const std::size_t free_space =
        sizeof(response->data) - response->length - 1;

    const std::size_t copy_length =
        static_cast<std::size_t>(event->data_len) < free_space
        ? static_cast<std::size_t>(event->data_len)
        : free_space;

    if (copy_length > 0) {
        std::memcpy(
            response->data + response->length,
            event->data,
            copy_length);

        response->length += copy_length;
        response->data[response->length] = '\0';
    }

    return ESP_OK;
}

void ConfigHttpClient::task()
{
    while (true) {
        network_manager::wait_connected();

        const RuntimeConfig config =
            RuntimeConfigManager::instance().snapshot();

        if (config.provisioned) {
            poll();
        }

        vTaskDelay(pdMS_TO_TICKS(
            config.provisioned
                ? config.config_poll_interval_ms
                : 1000));
    }
}

void ConfigHttpClient::poll()
{
    const RuntimeConfig current =
        RuntimeConfigManager::instance().snapshot();

    if (!current.provisioned) {
        return;
    }

    char url[320]{};

    std::snprintf(
        url,
        sizeof(url),
        "http://%s:%u%s%s/config?revision=%lu",
        current.caster_host,
        current.management_port,
        app_defaults::CONFIG_PATH_PREFIX,
        current.device_id,
        static_cast<unsigned long>(current.revision));

    ResponseBuffer response{};

    esp_http_client_config_t config{};
    config.url = url;
    config.timeout_ms = 5000;
    config.event_handler = &ConfigHttpClient::http_event;
    config.user_data = &response;

    esp_http_client_handle_t client =
        esp_http_client_init(&config);

    if (client == nullptr) {
        return;
    }

    esp_http_client_set_method(client, HTTP_METHOD_GET);
    esp_http_client_set_header(
        client,
        "X-Device-ID",
        current.device_id);
    esp_http_client_set_header(
        client,
        "X-Hardware-ID",
        current.hardware_id);
    set_authorization(client, current.auth_token);

    const esp_err_t result =
        esp_http_client_perform(client);

    const int status =
        esp_http_client_get_status_code(client);

    esp_http_client_cleanup(client);

    if (result != ESP_OK) {
        return;
    }

    if (status == 204 || status == 304) {
        return;
    }

    if (status != 200) {
        return;
    }

    parse_and_apply(response.data);
}

bool ConfigHttpClient::parse_and_apply(const char* json)
{
    cJSON* root = cJSON_Parse(json);

    if (root == nullptr) {
        return false;
    }

    RuntimeConfig updated =
        RuntimeConfigManager::instance().snapshot();

    cJSON* revision =
        cJSON_GetObjectItemCaseSensitive(root, "revision");

    if (!cJSON_IsNumber(revision)) {
        cJSON_Delete(root);
        return false;
    }

    const uint32_t new_revision =
        static_cast<uint32_t>(revision->valuedouble);

    if (new_revision <= updated.revision) {
        cJSON_Delete(root);
        return true;
    }

    updated.revision = new_revision;

    cJSON* enabled =
        cJSON_GetObjectItemCaseSensitive(root, "enabled");

    if (cJSON_IsBool(enabled)) {
        updated.enabled = cJSON_IsTrue(enabled);
    }

    /*
     * The server may rename the logical device ID or mountpoint.
     * The new values are stored in NVS and become active after restart.
     */
    copy_if_present(root, "device_id", updated.device_id);
    copy_if_present(root, "caster_host", updated.caster_host);
    copy_if_present(root, "mountpoint", updated.mountpoint);
    copy_if_present(root, "source_token", updated.auth_token);
    copy_if_present(root, "auth_token", updated.auth_token);

    cJSON* value = nullptr;

    value = cJSON_GetObjectItemCaseSensitive(root, "caster_port");
    if (cJSON_IsNumber(value)) {
        updated.caster_port =
            static_cast<uint16_t>(value->valueint);
    }

    value = cJSON_GetObjectItemCaseSensitive(
        root,
        "management_port");
    if (cJSON_IsNumber(value)) {
        updated.management_port =
            static_cast<uint16_t>(value->valueint);
    }

    value = cJSON_GetObjectItemCaseSensitive(root, "uart_baud");
    if (cJSON_IsNumber(value)) {
        updated.uart_baud = value->valueint;
    }

    value = cJSON_GetObjectItemCaseSensitive(
        root,
        "telemetry_interval_ms");
    if (cJSON_IsNumber(value)) {
        updated.telemetry_interval_ms =
            static_cast<uint32_t>(value->valuedouble);
    }

    value = cJSON_GetObjectItemCaseSensitive(
        root,
        "config_poll_interval_ms");
    if (cJSON_IsNumber(value)) {
        updated.config_poll_interval_ms =
            static_cast<uint32_t>(value->valuedouble);
    }

    value = cJSON_GetObjectItemCaseSensitive(
        root,
        "max_rtcm_age_ms");
    if (cJSON_IsNumber(value)) {
        updated.max_rtcm_age_ms =
            static_cast<uint32_t>(value->valuedouble);
    }

    cJSON_Delete(root);

    if (RuntimeConfigManager::instance().save(updated) != ESP_OK) {
        return false;
    }

    vTaskDelay(pdMS_TO_TICKS(500));
    esp_restart();
    return true;
}
