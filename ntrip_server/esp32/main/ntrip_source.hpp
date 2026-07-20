#pragma once

#include <array>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#include "rtcm_frame.hpp"
#include "runtime_config.hpp"
class NtripSource
{
public:
    esp_err_t initialize();
    bool enqueue(const RtcmFrame &);

private:
    struct Cache
    {
        RtcmFrame f{};
        bool valid{false};
    };
    static void entry(void *);
    void task();
    int connect_socket(const RuntimeConfig &);
    bool handshake(int, const RuntimeConfig &);
    bool write_all(int, const void *, size_t);
    void cache(const RtcmFrame &);
    bool send_cache(int);
    static int cache_index(uint16_t);
    QueueHandle_t q_{nullptr};
    std::array<Cache, 4> c_{};
};
