#include "runtime_config.hpp"
#include <cstring>
#include "app_defaults.hpp"
#include "nvs.h"
namespace
{
    constexpr char NS[] = "station_cfg";
    constexpr char KEY[] = "runtime_v4";
    template <size_t N>
    void cp(char (&d)[N], const char *s)
    {
        std::strncpy(d, s, N - 1);
        d[N - 1] = '\0';
    }
}
RuntimeConfigManager &RuntimeConfigManager::instance()
{
    static RuntimeConfigManager x;
    return x;
}
esp_err_t RuntimeConfigManager::initialize()
{
    mutex_ = xSemaphoreCreateMutex();
    if (!mutex_)
        return ESP_ERR_NO_MEM;
    defaults();
    auto r = load();
    if (r != ESP_OK && r != ESP_ERR_NVS_NOT_FOUND)
    {
        defaults();
    }
    if (!validate(cfg_))
        defaults();
    return ESP_OK;
}
RuntimeConfig RuntimeConfigManager::snapshot()
{
    xSemaphoreTake(mutex_, portMAX_DELAY);
    auto c = cfg_;
    xSemaphoreGive(mutex_);
    return c;
}
esp_err_t RuntimeConfigManager::save(const RuntimeConfig &c)
{
    if (!validate(c))
        return ESP_ERR_INVALID_ARG;
    auto r = persist(c);
    if (r != ESP_OK)
        return r;
    xSemaphoreTake(mutex_, portMAX_DELAY);
    cfg_ = c;
    xSemaphoreGive(mutex_);
    return ESP_OK;
}
bool RuntimeConfigManager::validate(const RuntimeConfig &c) { return c.caster_host[0] && c.mountpoint[0] && c.auth_token[0] && c.caster_port && c.management_port && c.uart_baud >= 9600 && c.uart_baud <= 921600 && c.telemetry_interval_ms >= 500 && c.telemetry_interval_ms <= 60000 && c.config_poll_interval_ms >= 5000 && c.config_poll_interval_ms <= 3600000 && c.max_rtcm_age_ms >= 100 && c.max_rtcm_age_ms <= 60000; }
void RuntimeConfigManager::defaults()
{
    cfg_ = RuntimeConfig{};
    cfg_.caster_port = app_defaults::CASTER_PORT;
    cfg_.management_port = app_defaults::MANAGEMENT_PORT;
    cfg_.uart_baud = app_defaults::UART_BAUD;
    cfg_.telemetry_interval_ms = app_defaults::TELEMETRY_INTERVAL_MS;
    cfg_.config_poll_interval_ms = app_defaults::CONFIG_POLL_INTERVAL_MS;
    cfg_.max_rtcm_age_ms = app_defaults::MAX_RTCM_AGE_MS;
    cp(cfg_.caster_host, app_defaults::CASTER_HOST);
    cp(cfg_.mountpoint, app_defaults::MOUNTPOINT);
    cp(cfg_.auth_token, app_defaults::AUTH_TOKEN);
}
esp_err_t RuntimeConfigManager::load()
{
    nvs_handle_t h{};
    auto r = nvs_open(NS, NVS_READONLY, &h);
    if (r != ESP_OK)
        return r;
    size_t s = sizeof(cfg_);
    r = nvs_get_blob(h, KEY, &cfg_, &s);
    nvs_close(h);
    return r == ESP_OK && s != sizeof(cfg_) ? ESP_ERR_INVALID_SIZE : r;
}
esp_err_t RuntimeConfigManager::persist(const RuntimeConfig &c)
{
    nvs_handle_t h{};
    auto r = nvs_open(NS, NVS_READWRITE, &h);
    if (r != ESP_OK)
        return r;
    r = nvs_set_blob(h, KEY, &c, sizeof(c));
    if (r == ESP_OK)
        r = nvs_commit(h);
    nvs_close(h);
    return r;
}
