#pragma once

#include <cstdint>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

struct RuntimeConfig
{
    uint32_t revision{0};
    bool enabled{true};
    char caster_host[96]{};
    uint16_t caster_port{2101};
    uint16_t management_port{8000};
    char mountpoint[64]{};
    char auth_token[128]{};
    int uart_baud{115200};
    uint32_t telemetry_interval_ms{2000};
    uint32_t config_poll_interval_ms{30000};
    uint32_t max_rtcm_age_ms{1500};
};

class RuntimeConfigManager
{
public:
    static RuntimeConfigManager &instance();
    esp_err_t initialize();
    RuntimeConfig snapshot();
    esp_err_t save(const RuntimeConfig &config);
    static bool validate(const RuntimeConfig &config);

private:
    RuntimeConfigManager() = default;

    void defaults();
    esp_err_t load();
    esp_err_t persist(const RuntimeConfig &config);

    RuntimeConfig cfg_{};
    SemaphoreHandle_t mutex_{nullptr};
};
