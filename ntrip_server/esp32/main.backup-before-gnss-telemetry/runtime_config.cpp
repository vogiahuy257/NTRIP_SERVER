#include "runtime_config.hpp"

#include <cstring>

#include "app_defaults.hpp"
#include "device_identity.hpp"
#include "esp_log.h"
#include "nvs.h"

namespace
{
constexpr char TAG[] = "RUNTIME_CONFIG";
constexpr char NVS_NAMESPACE[] = "station_cfg";
constexpr char NVS_KEY[] = "runtime_v5";

template <std::size_t N>
void copy_string(char (&destination)[N], const char *source)
{
    if (source == nullptr) {
        destination[0] = '\0';
        return;
    }

    std::strncpy(destination, source, N - 1);
    destination[N - 1] = '\0';
}
}

RuntimeConfigManager &RuntimeConfigManager::instance()
{
    static RuntimeConfigManager manager;
    return manager;
}

esp_err_t RuntimeConfigManager::initialize()
{
    mutex_ = xSemaphoreCreateMutex();

    if (mutex_ == nullptr) {
        return ESP_ERR_NO_MEM;
    }

    defaults();

    const esp_err_t load_result = load();

    if (
        load_result != ESP_OK &&
        load_result != ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(
            TAG,
            "Cannot load runtime config from NVS: %s",
            esp_err_to_name(load_result));
        defaults();
    }

    if (!validate(cfg_)) {
        ESP_LOGW(TAG, "Runtime config is invalid; using bootstrap defaults");
        defaults();
    }

    /* hardware_id always comes from this ESP32, never from the server. */
    refresh_hardware_id();

    ESP_LOGI(
        TAG,
        "Loaded config: provisioned=%s revision=%lu "
        "device=%s mountpoint=%s uart_baud=%d "
        "max_rtcm_age_ms=%lu",
        cfg_.provisioned ? "true" : "false",
        static_cast<unsigned long>(
            cfg_.revision
        ),
        cfg_.device_id,
        cfg_.mountpoint,
        cfg_.uart_baud,
        static_cast<unsigned long>(
            cfg_.max_rtcm_age_ms
        )
    );

    return ESP_OK;
}

RuntimeConfig RuntimeConfigManager::snapshot()
{
    xSemaphoreTake(mutex_, portMAX_DELAY);
    const RuntimeConfig copy = cfg_;
    xSemaphoreGive(mutex_);
    return copy;
}

esp_err_t RuntimeConfigManager::save(const RuntimeConfig &config)
{
    if (!validate(config)) {
        return ESP_ERR_INVALID_ARG;
    }

    RuntimeConfig normalized = config;
    char hardware_id[sizeof(normalized.hardware_id)]{};

    if (
        device_identity::read_hardware_id(
            hardware_id,
            sizeof(hardware_id)) == ESP_OK) {
        copy_string(normalized.hardware_id, hardware_id);
    }

    const esp_err_t persist_result = persist(normalized);

    if (persist_result != ESP_OK) {
        ESP_LOGE(
            TAG,
            "Cannot persist runtime config: %s",
            esp_err_to_name(persist_result));
        return persist_result;
    }

    xSemaphoreTake(mutex_, portMAX_DELAY);
    cfg_ = normalized;
    xSemaphoreGive(mutex_);

    ESP_LOGI(
        TAG,
        "Saved config: provisioned=%s revision=%lu "
        "device=%s mountpoint=%s uart_baud=%d "
        "max_rtcm_age_ms=%lu",
        normalized.provisioned
            ? "true"
            : "false",
        static_cast<unsigned long>(
            normalized.revision
        ),
        normalized.device_id,
        normalized.mountpoint,
        normalized.uart_baud,
        static_cast<unsigned long>(
            normalized.max_rtcm_age_ms
        )
    );

    return ESP_OK;
}

bool RuntimeConfigManager::validate(const RuntimeConfig &config)
{
    return config.hardware_id[0] != '\0' &&
        config.device_id[0] != '\0' &&
        config.caster_host[0] != '\0' &&
        config.mountpoint[0] != '\0' &&
        config.auth_token[0] != '\0' &&
        config.caster_port > 0 &&
        config.management_port > 0 &&
        config.uart_baud >= 9600 &&
        config.uart_baud <= 3000000 &&
        config.telemetry_interval_ms >= 500 &&
        config.telemetry_interval_ms <= 60000 &&
        config.config_poll_interval_ms >= 5000 &&
        config.config_poll_interval_ms <= 3600000 &&
        config.provisioning_poll_interval_ms >= 1000 &&
        config.provisioning_poll_interval_ms <= 60000 &&
        config.max_rtcm_age_ms >= 100 &&
        config.max_rtcm_age_ms <= 60000;
}

void RuntimeConfigManager::defaults()
{
    cfg_ = RuntimeConfig{};

    cfg_.revision = 0;
    cfg_.enabled = true;
    cfg_.provisioned = app_defaults::BOOTSTRAP_PROVISIONED;

    cfg_.caster_port = app_defaults::CASTER_PORT;
    cfg_.management_port = app_defaults::MANAGEMENT_PORT;
    cfg_.uart_baud = app_defaults::UART_BAUD;
    cfg_.telemetry_interval_ms = app_defaults::TELEMETRY_INTERVAL_MS;
    cfg_.config_poll_interval_ms = app_defaults::CONFIG_POLL_INTERVAL_MS;
    cfg_.provisioning_poll_interval_ms =
        app_defaults::PROVISIONING_POLL_INTERVAL_MS;
    cfg_.max_rtcm_age_ms = app_defaults::MAX_RTCM_AGE_MS;

    copy_string(cfg_.caster_host, app_defaults::CASTER_HOST);
    copy_string(cfg_.device_id, app_defaults::BOOTSTRAP_DEVICE_ID);
    copy_string(cfg_.mountpoint, app_defaults::BOOTSTRAP_MOUNTPOINT);
    copy_string(
        cfg_.auth_token,
        app_defaults::BOOTSTRAP_PROVISIONING_KEY);

    refresh_hardware_id();
}

void RuntimeConfigManager::refresh_hardware_id()
{
    char hardware_id[sizeof(cfg_.hardware_id)]{};

    if (
        device_identity::read_hardware_id(
            hardware_id,
            sizeof(hardware_id)) == ESP_OK) {
        copy_string(cfg_.hardware_id, hardware_id);
    }
}

esp_err_t RuntimeConfigManager::load()
{
    nvs_handle_t handle{};
    esp_err_t result = nvs_open(
        NVS_NAMESPACE,
        NVS_READONLY,
        &handle);

    if (result != ESP_OK) {
        return result;
    }

    std::size_t size = sizeof(cfg_);
    result = nvs_get_blob(handle, NVS_KEY, &cfg_, &size);
    nvs_close(handle);

    if (result == ESP_OK && size != sizeof(cfg_)) {
        return ESP_ERR_INVALID_SIZE;
    }

    return result;
}

esp_err_t RuntimeConfigManager::persist(const RuntimeConfig &config)
{
    nvs_handle_t handle{};
    esp_err_t result = nvs_open(
        NVS_NAMESPACE,
        NVS_READWRITE,
        &handle);

    if (result != ESP_OK) {
        return result;
    }

    result = nvs_set_blob(
        handle,
        NVS_KEY,
        &config,
        sizeof(config));

    if (result == ESP_OK) {
        result = nvs_commit(handle);
    }

    nvs_close(handle);
    return result;
}
