#pragma once

#include "esp_err.h"
#include "esp_http_client.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

class TelemetryHttpClient
{
public:
    esp_err_t initialize();

private:
    static void entry(void *context);
    void task();
    void send();

    uint64_t previous_bytes_{0};
    int64_t previous_time_us_{0};
};
