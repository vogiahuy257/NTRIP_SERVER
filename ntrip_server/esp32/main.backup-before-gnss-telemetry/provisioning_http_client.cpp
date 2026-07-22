#include "provisioning_http_client.hpp"

#include <cstdio>
#include <cstring>

#include "app_defaults.hpp"
#include "cJSON.h"
#include "esp_log.h"
#include "esp_system.h"
#include "network_manager.hpp"
#include "runtime_config.hpp"

namespace
{
constexpr char TAG[] = "PROVISIONING";

template <std::size_t N>
bool copy_required(
    cJSON *object,
    const char *name,
    char (&destination)[N])
{
    cJSON *value = cJSON_GetObjectItemCaseSensitive(object, name);

    if (
        !cJSON_IsString(value) ||
        value->valuestring == nullptr ||
        value->valuestring[0] == '\0') {
        return false;
    }

    std::strncpy(destination, value->valuestring, N - 1);
    destination[N - 1] = '\0';
    return true;
}

template <std::size_t N>
void copy_optional(
    cJSON *object,
    const char *name,
    char (&destination)[N])
{
    cJSON *value = cJSON_GetObjectItemCaseSensitive(object, name);

    if (
        !cJSON_IsString(value) ||
        value->valuestring == nullptr ||
        value->valuestring[0] == '\0') {
        return;
    }

    std::strncpy(destination, value->valuestring, N - 1);
    destination[N - 1] = '\0';
}

void set_bearer_authorization(
    esp_http_client_handle_t client,
    const char *token)
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

void set_uint16_if_present(
    cJSON *object,
    const char *name,
    uint16_t &destination)
{
    cJSON *value = cJSON_GetObjectItemCaseSensitive(object, name);

    if (cJSON_IsNumber(value)) {
        destination = static_cast<uint16_t>(value->valueint);
    }
}

void set_uint32_if_present(
    cJSON *object,
    const char *name,
    uint32_t &destination)
{
    cJSON *value = cJSON_GetObjectItemCaseSensitive(object, name);

    if (cJSON_IsNumber(value)) {
        destination = static_cast<uint32_t>(value->valuedouble);
    }
}
}

esp_err_t ProvisioningHttpClient::initialize()
{
    return xTaskCreate(
               &ProvisioningHttpClient::entry,
               "provisioning_http",
               6144,
               this,
               4,
               nullptr) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

void ProvisioningHttpClient::entry(void *context)
{
    static_cast<ProvisioningHttpClient *>(context)->task();
}

esp_err_t ProvisioningHttpClient::http_event(
    esp_http_client_event_t *event)
{
    if (
        event->event_id != HTTP_EVENT_ON_DATA ||
        event->user_data == nullptr ||
        event->data == nullptr ||
        event->data_len <= 0) {
        return ESP_OK;
    }

    auto *response = static_cast<ResponseBuffer *>(event->user_data);

    const std::size_t free_space =
        sizeof(response->data) - response->length - 1;

    const std::size_t incoming =
        static_cast<std::size_t>(event->data_len);

    const std::size_t copy_length =
        incoming < free_space ? incoming : free_space;

    if (incoming > free_space) {
        response->overflow = true;
    }

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

void ProvisioningHttpClient::task()
{
    while (true) {
        network_manager::wait_connected();

        const RuntimeConfig config =
            RuntimeConfigManager::instance().snapshot();

        if (!config.provisioned) {
            poll();
        }

        const uint32_t delay_ms = config.provisioned
            ? 10000
            : config.provisioning_poll_interval_ms;

        vTaskDelay(pdMS_TO_TICKS(delay_ms));
    }
}

void ProvisioningHttpClient::poll()
{
    const RuntimeConfig current =
        RuntimeConfigManager::instance().snapshot();

    if (current.provisioned) {
        return;
    }

    char url[384]{};

    std::snprintf(
        url,
        sizeof(url),
        "http://%s:%u%s%s",
        current.caster_host,
        current.management_port,
        app_defaults::PROVISIONING_PATH_PREFIX,
        current.hardware_id);

    ResponseBuffer response{};

    esp_http_client_config_t http_config{};
    http_config.url = url;
    http_config.timeout_ms = 5000;
    http_config.event_handler = &ProvisioningHttpClient::http_event;
    http_config.user_data = &response;

    esp_http_client_handle_t client =
        esp_http_client_init(&http_config);

    if (client == nullptr) {
        return;
    }

    esp_http_client_set_method(client, HTTP_METHOD_GET);
    esp_http_client_set_header(client, "Accept", "application/json");
    esp_http_client_set_header(
        client,
        "X-Hardware-ID",
        current.hardware_id);
    esp_http_client_set_header(
        client,
        "X-Device-ID",
        current.device_id);
    esp_http_client_set_header(
        client,
        "X-Firmware-Version",
        app_defaults::FIRMWARE_VERSION);
    esp_http_client_set_header(
        client,
        "X-Provisioning-Key",
        app_defaults::BOOTSTRAP_PROVISIONING_KEY);

    set_bearer_authorization(
        client,
        app_defaults::BOOTSTRAP_PROVISIONING_KEY);

    ESP_LOGI(
        TAG,
        "Requesting provisioning: hardware_id=%s host=%s:%u",
        current.hardware_id,
        current.caster_host,
        current.management_port);

    const esp_err_t result = esp_http_client_perform(client);
    const int status = esp_http_client_get_status_code(client);

    esp_http_client_cleanup(client);

    if (result != ESP_OK) {
        ESP_LOGW(
            TAG,
            "Provisioning request failed: %s",
            esp_err_to_name(result));
        return;
    }

    ESP_LOGI(
        TAG,
        "Provisioning response: status=%d bytes=%u overflow=%s",
        status,
        static_cast<unsigned>(response.length),
        response.overflow ? "true" : "false");

    if (response.overflow) {
        ESP_LOGE(TAG, "Provisioning response exceeded local buffer");
        return;
    }

    if (status != 200) {
        ESP_LOGW(TAG, "Provisioning HTTP status: %d", status);
        return;
    }

    if (response.length == 0) {
        ESP_LOGE(TAG, "Provisioning response body is empty");
        return;
    }

    if (!parse_and_apply(response.data)) {
        ESP_LOGE(TAG, "Provisioning response could not be applied");
    }
}

bool ProvisioningHttpClient::parse_and_apply(const char *json)
{
    cJSON *root = cJSON_Parse(json);

    if (root == nullptr) {
        ESP_LOGW(TAG, "Invalid provisioning JSON");
        return false;
    }

    cJSON *status = cJSON_GetObjectItemCaseSensitive(root, "status");

    if (!cJSON_IsString(status) || status->valuestring == nullptr) {
        ESP_LOGW(TAG, "Provisioning response has no valid status");
        cJSON_Delete(root);
        return false;
    }

    ESP_LOGI(TAG, "Provisioning state from server: %s", status->valuestring);

    if (std::strcmp(status->valuestring, "pending") == 0) {
        ESP_LOGI(TAG, "Device is waiting for dashboard approval");
        cJSON_Delete(root);
        return true;
    }

    if (std::strcmp(status->valuestring, "rejected") == 0) {
        ESP_LOGW(TAG, "Device provisioning was rejected");
        cJSON_Delete(root);
        return true;
    }

    if (
        std::strcmp(status->valuestring, "approved") != 0 &&
        std::strcmp(status->valuestring, "provisioned") != 0) {
        cJSON_Delete(root);
        return false;
    }

    cJSON *payload = cJSON_GetObjectItemCaseSensitive(root, "data");

    if (!cJSON_IsObject(payload)) {
        payload = cJSON_GetObjectItemCaseSensitive(root, "provisioning");
    }

    if (!cJSON_IsObject(payload)) {
        ESP_LOGW(TAG, "Provisioning response has no data object");
        cJSON_Delete(root);
        return false;
    }

    RuntimeConfig updated =
        RuntimeConfigManager::instance().snapshot();

    const bool has_device_id =
        copy_required(payload, "device_id", updated.device_id);
    const bool has_mountpoint =
        copy_required(payload, "mountpoint", updated.mountpoint);
    const bool has_source_token =
        copy_required(payload, "source_token", updated.auth_token);

    if (!has_device_id || !has_mountpoint || !has_source_token) {
        ESP_LOGW(TAG, "Provisioning payload is incomplete");
        cJSON_Delete(root);
        return false;
    }

    copy_optional(payload, "caster_host", updated.caster_host);

    set_uint16_if_present(payload, "caster_port", updated.caster_port);
    set_uint16_if_present(
        payload,
        "management_port",
        updated.management_port);

    cJSON *uart_baud =
        cJSON_GetObjectItemCaseSensitive(payload, "uart_baud");

    if (cJSON_IsNumber(uart_baud)) {
        updated.uart_baud = uart_baud->valueint;
    }

    set_uint32_if_present(
        payload,
        "telemetry_interval_ms",
        updated.telemetry_interval_ms);
    set_uint32_if_present(
        payload,
        "config_poll_interval_ms",
        updated.config_poll_interval_ms);
    set_uint32_if_present(
        payload,
        "max_rtcm_age_ms",
        updated.max_rtcm_age_ms);
    set_uint32_if_present(payload, "revision", updated.revision);

    updated.enabled = true;
    updated.provisioned = true;

    cJSON_Delete(root);

    const esp_err_t save_result =
        RuntimeConfigManager::instance().save(updated);

    if (save_result != ESP_OK) {
        ESP_LOGE(
            TAG,
            "Cannot save provisioning config: %s",
            esp_err_to_name(save_result));
        return false;
    }

    const RuntimeConfig persisted =
        RuntimeConfigManager::instance().snapshot();

    if (
        !persisted.provisioned ||
        persisted.auth_token[0] == '\0' ||
        persisted.revision != updated.revision) {
        ESP_LOGE(TAG, "Provisioning verification failed after NVS save");
        return false;
    }

    ESP_LOGI(
        TAG,
        "Provisioning saved: device=%s mountpoint=%s revision=%lu",
        persisted.device_id,
        persisted.mountpoint,
        static_cast<unsigned long>(persisted.revision));

    ESP_LOGI(TAG, "Restarting to activate provisioned configuration");
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
    return true;
}
