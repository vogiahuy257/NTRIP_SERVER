#pragma once
#include "esp_err.h"
namespace network_manager
{
    enum class Interface
    {
        None,
        Ethernet,
        WiFi
    };
    esp_err_t initialize();
    void wait_connected();
    bool connected();
    bool ethernet();
    bool wifi();
    Interface active();
    const char *active_name();
    int wifi_rssi();
}
