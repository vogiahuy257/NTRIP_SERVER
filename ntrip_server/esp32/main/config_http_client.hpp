#pragma once

#include <cstddef>

#include "esp_err.h"
#include "esp_http_client.h"

class ConfigHttpClient
{
public:
    esp_err_t initialize();

private:
    struct ResponseBuffer
    {
        char data[1536]{};
        std::size_t length{0};
    };

    static void entry(void* context);
    static esp_err_t http_event(esp_http_client_event_t* event);

    void task();
    void poll();
    bool parse_and_apply(const char* json);
};
