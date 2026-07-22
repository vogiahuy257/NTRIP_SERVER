#pragma once
#include "esp_err.h"
#include "rtcm_frame.hpp"
class NtripSource;
class RtkUart
{
public:
    esp_err_t initialize(NtripSource *);

private:
    static void entry(void *);
    static void cb(const RtcmFrame &, void *);
    void task();
    void on(const RtcmFrame &);
    NtripSource *src_{nullptr};
};
