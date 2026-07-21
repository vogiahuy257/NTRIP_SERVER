#include "device_identity.hpp"

#include <cstdio>

#include "esp_mac.h"

namespace device_identity
{
esp_err_t read_hardware_id(
    char *destination,
    const std::size_t destination_size)
{
    if (destination == nullptr || destination_size < 19) {
        return ESP_ERR_INVALID_ARG;
    }

    uint8_t mac[6]{};
    const esp_err_t result = esp_read_mac(mac, ESP_MAC_WIFI_STA);

    if (result != ESP_OK) {
        destination[0] = '\0';
        return result;
    }

    const int written = std::snprintf(
        destination,
        destination_size,
        "ESP32-%02X%02X%02X%02X%02X%02X",
        mac[0],
        mac[1],
        mac[2],
        mac[3],
        mac[4],
        mac[5]);

    return written > 0 &&
            static_cast<std::size_t>(written) < destination_size
        ? ESP_OK
        : ESP_ERR_INVALID_SIZE;
}
}
