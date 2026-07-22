#pragma once

#include <cstddef>

#include "esp_err.h"

namespace device_identity
{
/*
 * Returns a stable identifier generated from the ESP32 factory MAC address.
 * Example: ESP32-A1B2C3D4E5F6
 */
esp_err_t read_hardware_id(char *destination, std::size_t destination_size);
}
