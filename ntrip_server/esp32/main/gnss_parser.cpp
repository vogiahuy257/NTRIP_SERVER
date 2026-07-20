#include "gnss_parser.hpp"
#include <cstring>
#include "esp_timer.h"
#include "station_state.hpp"
namespace
{
    uint32_t u32(const uint8_t *p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); }
}
GnssParser::GnssParser(Callback c, void *x) : cb_(c), ctx_(x) {}
void GnssParser::feed(const uint8_t *d, size_t n)
{
    for (size_t i = 0; i < n; i++)
        one(d[i]);
}
void GnssParser::one(uint8_t b)
{
    switch (s_)
    {
    case S::Search:
        if (b == 0xD3)
        {
            r_[0] = b;
            rl_ = 1;
            s_ = S::Rh;
        }
        else if (b == 0xB5)
            s_ = S::U2;
        break;
    case S::Rh:
        r_[rl_++] = b;
        if (rl_ == 3)
        {
            auto pl = ((size_t)(r_[1] & 3) << 8) | r_[2];
            re_ = pl + 6;
            if (!pl || re_ > r_.size())
                reset();
            else
                s_ = S::Rb;
        }
        break;
    case S::Rb:
        r_[rl_++] = b;
        if (rl_ == re_)
        {
            rtcm_done();
            reset();
        }
        break;
    case S::U2:
        if (b == 0x62)
        {
            cka_ = ckb_ = 0;
            upi_ = 0;
            s_ = S::Uh;
        }
        else
            reset();
        break;
    case S::Uh:
        if (upi_ == 0)
            uc_ = b;
        else if (upi_ == 1)
            ui_ = b;
        else if (upi_ == 2)
            ul_ = b;
        else if (upi_ == 3)
            ul_ |= (uint16_t)b << 8;
        cka_ += b;
        ckb_ += cka_;
        if (++upi_ == 4)
        {
            upi_ = 0;
            if (ul_ > up_.size())
                reset();
            else
                s_ = ul_ ? S::Up : S::Ca;
        }
        break;
    case S::Up:
        up_[upi_++] = b;
        cka_ += b;
        ckb_ += cka_;
        if (upi_ == ul_)
            s_ = S::Ca;
        break;
    case S::Ca:
        rca_ = b;
        s_ = S::Cb;
        break;
    case S::Cb:
        if (rca_ == cka_ && b == ckb_)
            ubx_done();
        reset();
        break;
    }
}
void GnssParser::reset()
{
    s_ = S::Search;
    rl_ = re_ = 0;
    upi_ = ul_ = 0;
}
void GnssParser::rtcm_done()
{
    uint32_t e = ((uint32_t)r_[rl_ - 3] << 16) | ((uint32_t)r_[rl_ - 2] << 8) | r_[rl_ - 1];
    if (e != crc24q(r_.data(), rl_ - 3))
    {
        bad_++;
        return;
    }
    RtcmFrame f{};
    f.length = rl_;
    f.type = (uint16_t)(((uint16_t)r_[3] << 4) | (r_[4] >> 4));
    f.received_us = esp_timer_get_time();
    std::memcpy(f.data.data(), r_.data(), rl_);
    valid_++;
    if (cb_)
        cb_(f, ctx_);
}
void GnssParser::ubx_done()
{
    if (uc_ != 0x01 || ui_ != 0x3B || ul_ < 40)
        return;
    SurveyInStatus s{};
    s.seen = true;
    s.i_tow_ms = u32(&up_[4]);
    s.dur_s = u32(&up_[8]);
    s.mean_acc_m = (float)u32(&up_[28]) * 0.0001f;
    s.obs = u32(&up_[32]);
    s.valid = up_[36] != 0;
    s.active = up_[37] != 0;
    s.last_update_us = esp_timer_get_time();
    StationState::instance().set_survey(s);
}
uint32_t GnssParser::crc24q(const uint8_t *d, size_t n)
{
    uint32_t c = 0;
    for (size_t i = 0; i < n; i++)
    {
        c ^= (uint32_t)d[i] << 16;
        for (int b = 0; b < 8; b++)
        {
            c <<= 1;
            if (c & 0x1000000)
                c ^= 0x1864CFB;
        }
    }
    return c & 0xFFFFFF;
}
