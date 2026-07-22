#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include "app_defaults.hpp"
struct RtcmFrame
{
    std::array<uint8_t, app_defaults::MAX_RTCM_FRAME> data{};
    size_t length{0};
    uint16_t type{0};
    int64_t received_us{0};
};
