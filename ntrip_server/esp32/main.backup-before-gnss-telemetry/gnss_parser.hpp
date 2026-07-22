#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include "rtcm_frame.hpp"
class GnssParser
{
public:
    using Callback = void (*)(const RtcmFrame &, void *);
    GnssParser(Callback, void *);
    void feed(const uint8_t *, size_t);
    uint64_t valid() const { return valid_; }
    uint64_t bad() const { return bad_; }

private:
    enum class S
    {
        Search,
        Rh,
        Rb,
        U2,
        Uh,
        Up,
        Ca,
        Cb
    };
    void one(uint8_t);
    void reset();
    void rtcm_done();
    void ubx_done();
    static uint32_t crc24q(const uint8_t *, size_t);
    Callback cb_;
    void *ctx_;
    S s_{S::Search};
    std::array<uint8_t, app_defaults::MAX_RTCM_FRAME> r_{};
    size_t rl_{0}, re_{0};
    uint8_t uc_{0}, ui_{0}, cka_{0}, ckb_{0}, rca_{0};
    uint16_t ul_{0}, upi_{0};
    std::array<uint8_t, 128> up_{};
    uint64_t valid_{0}, bad_{0};
};
