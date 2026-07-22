#include "telemetry_http_client.hpp"

#include <cstdio>

#include "app_defaults.hpp"
#include "esp_timer.h"
#include "network_manager.hpp"
#include "runtime_config.hpp"
#include "station_state.hpp"
#include "esp_log.h"

namespace
{
constexpr char kTag[] = "TELEMETRY_HTTP";
}

esp_err_t TelemetryHttpClient::initialize()
{
    return xTaskCreate(
               &TelemetryHttpClient::entry,
               "telemetry_http",
               6144,
               this,
               4,
               nullptr) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

void TelemetryHttpClient::entry(void *context)
{
    static_cast<TelemetryHttpClient *>(context)->task();
}

void TelemetryHttpClient::task()
{
    while (true) {
        network_manager::wait_connected();

        const RuntimeConfig config =
            RuntimeConfigManager::instance().snapshot();

        if (config.enabled && config.provisioned) {
            send();
        }

        vTaskDelay(pdMS_TO_TICKS(config.telemetry_interval_ms));
    }
}

void TelemetryHttpClient::send()
{
    const RuntimeConfig config =
        RuntimeConfigManager::instance().snapshot();

    if (!config.provisioned) {
        return;
    }

    const StationSnapshot state =
        StationState::instance().snapshot();

    const int64_t now_us = esp_timer_get_time();

    uint64_t upload_bps = 0;

    if (previous_time_us_ > 0 && now_us > previous_time_us_) {
        upload_bps =
            (state.bytes_sent - previous_bytes_) * 1000000ULL /
            static_cast<uint64_t>(now_us - previous_time_us_);
    }

    previous_bytes_ = state.bytes_sent;
    previous_time_us_ = now_us;

    char url[320]{};
    std::snprintf(
        url,
        sizeof(url),
        "http://%s:%u/api/v1/stations/%s/telemetry",
        config.caster_host,
        config.management_port,
        config.device_id);

    char body[1536]{};
    const int body_length = std::snprintf(
        body,
        sizeof(body),
        "{"
        "\"firmware_version\":\"%s\","
        "\"source_connected\":%s,"
        "\"identity\":{"
        "\"hardware_id\":\"%s\","
        "\"device_id\":\"%s\","
        "\"provisioned\":true,"
        "\"config_revision_applied\":%lu"
        "},"
        "\"network\":{"
        "\"type\":\"%s\","
        "\"rssi\":%d"
        "},"
        "\"survey_in\":{"
        "\"active\":%s,"
        "\"valid\":%s,"
        "\"duration_s\":%lu,"
        "\"mean_accuracy_m\":%.4f"
        "},"
        "\"rtcm\":{"
        "\"bytes_sent\":%llu,"
        "\"frames_valid\":%llu,"
        "\"crc_errors\":%llu,"
        "\"upload_bps\":%llu,"
        "\"queue_drops\":%llu,"
        "\"stale_drops\":%llu"
        "},"
        "\"system\":{"
        "\"uptime_s\":%lld"
        "}"
        "}",
        app_defaults::FIRMWARE_VERSION,
        state.source_connected ? "true" : "false",
        config.hardware_id,
        config.device_id,
        static_cast<unsigned long>(config.revision),
        network_manager::active_name(),
        network_manager::wifi_rssi(),
        state.survey.active ? "true" : "false",
        state.survey.valid ? "true" : "false",
        static_cast<unsigned long>(state.survey.dur_s),
        static_cast<double>(state.survey.mean_acc_m),
        static_cast<unsigned long long>(state.bytes_sent),
        static_cast<unsigned long long>(state.valid_frames),
        static_cast<unsigned long long>(state.bad_crc_frames),
        static_cast<unsigned long long>(upload_bps),
        static_cast<unsigned long long>(state.queue_drops),
        static_cast<unsigned long long>(state.stale_drops),
        static_cast<long long>(now_us / 1000000));

    if (
        body_length <= 0 ||
        body_length >= static_cast<int>(sizeof(body))) {
        return;
    }

    esp_http_client_config_t http_config{};
    http_config.url = url;
    http_config.timeout_ms = 5000;

    esp_http_client_handle_t client =
        esp_http_client_init(&http_config);

    if (client == nullptr) {
        return;
    }

    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "Accept", "application/json");
    esp_http_client_set_header(client,"Accept-Encoding","identity");
    esp_http_client_set_header(client,"Connection","close");
    esp_http_client_set_header(client, "X-Station-Token", config.auth_token);
    esp_http_client_set_header(client, "X-Hardware-ID", config.hardware_id);
    esp_http_client_set_header(client, "X-Device-ID", config.device_id);
    esp_http_client_set_post_field(client, body, body_length);

    const esp_err_t result = esp_http_client_perform(client);

    const int status = esp_http_client_get_status_code(client);

    esp_http_client_cleanup(client);

    const bool accepted = status == 200 || status == 202 || status == 204;

    if (result != ESP_OK && ! (result == ESP_ERR_HTTP_INCOMPLETE_DATA && accepted)) {
        ESP_LOGW(
            kTag,
            "Telemetry request failed: "
            "result=%s status=%d",
            esp_err_to_name(result),
            status);

        return;
    }

    if (!accepted) {
        ESP_LOGW(
            kTag,
            "Telemetry rejected: status=%d",
            status);

        return;
    }
}
