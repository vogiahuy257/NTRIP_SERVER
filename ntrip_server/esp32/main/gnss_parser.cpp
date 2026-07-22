#include "gnss_parser.hpp"

#include <cmath>
#include <cstring>

#include "esp_timer.h"
#include "station_state.hpp"

namespace
{
constexpr double WGS84_A_M = 6378137.0;
constexpr double WGS84_INVERSE_FLATTENING = 298.257223563;
constexpr double PI = 3.14159265358979323846;

uint32_t read_u32_le(const uint8_t *data)
{
    return static_cast<uint32_t>(data[0]) |
        (static_cast<uint32_t>(data[1]) << 8) |
        (static_cast<uint32_t>(data[2]) << 16) |
        (static_cast<uint32_t>(data[3]) << 24);
}

int32_t read_i32_le(const uint8_t *data)
{
    const uint32_t raw = read_u32_le(data);
    int32_t value = 0;
    static_assert(sizeof(value) == sizeof(raw));
    std::memcpy(&value, &raw, sizeof(value));
    return value;
}

int8_t read_i8(const uint8_t value)
{
    int8_t signed_value = 0;
    static_assert(sizeof(signed_value) == sizeof(value));
    std::memcpy(&signed_value, &value, sizeof(signed_value));
    return signed_value;
}

bool ecef_to_geodetic(
    const double x_m,
    const double y_m,
    const double z_m,
    double &latitude_deg,
    double &longitude_deg,
    double &altitude_m)
{
    const double flattening =
        1.0 / WGS84_INVERSE_FLATTENING;
    const double semi_minor_m =
        WGS84_A_M * (1.0 - flattening);

    const double eccentricity_sq =
        1.0 -
        (semi_minor_m * semi_minor_m) /
            (WGS84_A_M * WGS84_A_M);

    const double second_eccentricity_sq =
        (WGS84_A_M * WGS84_A_M -
         semi_minor_m * semi_minor_m) /
        (semi_minor_m * semi_minor_m);

    const double horizontal_m = std::hypot(x_m, y_m);

    if (
        !std::isfinite(horizontal_m) ||
        !std::isfinite(z_m) ||
        (horizontal_m < 1.0 && std::abs(z_m) < 1.0)) {
        return false;
    }

    const double longitude_rad = std::atan2(y_m, x_m);
    const double theta = std::atan2(
        z_m * WGS84_A_M,
        horizontal_m * semi_minor_m);

    const double sin_theta = std::sin(theta);
    const double cos_theta = std::cos(theta);

    const double latitude_rad = std::atan2(
        z_m +
            second_eccentricity_sq *
                semi_minor_m *
                sin_theta * sin_theta * sin_theta,
        horizontal_m -
            eccentricity_sq *
                WGS84_A_M *
                cos_theta * cos_theta * cos_theta);

    const double sin_latitude = std::sin(latitude_rad);
    const double prime_vertical_radius_m =
        WGS84_A_M /
        std::sqrt(
            1.0 -
            eccentricity_sq *
                sin_latitude * sin_latitude);

    if (std::abs(std::cos(latitude_rad)) > 1.0e-12) {
        altitude_m =
            horizontal_m / std::cos(latitude_rad) -
            prime_vertical_radius_m;
    } else {
        altitude_m =
            std::abs(z_m) -
            semi_minor_m;
    }

    latitude_deg = latitude_rad * 180.0 / PI;
    longitude_deg = longitude_rad * 180.0 / PI;

    return
        std::isfinite(latitude_deg) &&
        std::isfinite(longitude_deg) &&
        std::isfinite(altitude_m) &&
        latitude_deg >= -90.0 &&
        latitude_deg <= 90.0 &&
        longitude_deg >= -180.0 &&
        longitude_deg <= 180.0;
}
}

GnssParser::GnssParser(
    const Callback callback,
    void *context)
    : cb_(callback),
      ctx_(context)
{
}

void GnssParser::feed(
    const uint8_t *data,
    const size_t length)
{
    for (size_t index = 0; index < length; ++index) {
        one(data[index]);
    }
}

void GnssParser::one(const uint8_t byte)
{
    switch (s_) {
    case S::Search:
        if (byte == 0xD3) {
            r_[0] = byte;
            rl_ = 1;
            s_ = S::Rh;
        } else if (byte == 0xB5) {
            s_ = S::U2;
        }
        break;

    case S::Rh:
        r_[rl_++] = byte;

        if (rl_ == 3) {
            const size_t payload_length =
                (static_cast<size_t>(r_[1] & 0x03) << 8) |
                r_[2];

            re_ = payload_length + 6;

            if (
                payload_length == 0 ||
                re_ > r_.size()) {
                reset();
            } else {
                s_ = S::Rb;
            }
        }
        break;

    case S::Rb:
        r_[rl_++] = byte;

        if (rl_ == re_) {
            rtcm_done();
            reset();
        }
        break;

    case S::U2:
        if (byte == 0x62) {
            cka_ = 0;
            ckb_ = 0;
            upi_ = 0;
            s_ = S::Uh;
        } else {
            reset();
        }
        break;

    case S::Uh:
        if (upi_ == 0) {
            uc_ = byte;
        } else if (upi_ == 1) {
            ui_ = byte;
        } else if (upi_ == 2) {
            ul_ = byte;
        } else if (upi_ == 3) {
            ul_ |= static_cast<uint16_t>(byte) << 8;
        }

        cka_ += byte;
        ckb_ += cka_;

        if (++upi_ == 4) {
            upi_ = 0;

            if (ul_ > up_.size()) {
                reset();
            } else {
                s_ = ul_ > 0 ? S::Up : S::Ca;
            }
        }
        break;

    case S::Up:
        up_[upi_++] = byte;
        cka_ += byte;
        ckb_ += cka_;

        if (upi_ == ul_) {
            s_ = S::Ca;
        }
        break;

    case S::Ca:
        rca_ = byte;
        s_ = S::Cb;
        break;

    case S::Cb:
        if (rca_ == cka_ && byte == ckb_) {
            ubx_done();
        }

        reset();
        break;
    }
}

void GnssParser::reset()
{
    s_ = S::Search;
    rl_ = 0;
    re_ = 0;
    upi_ = 0;
    ul_ = 0;
}

void GnssParser::rtcm_done()
{
    const uint32_t received_crc =
        (static_cast<uint32_t>(r_[rl_ - 3]) << 16) |
        (static_cast<uint32_t>(r_[rl_ - 2]) << 8) |
        r_[rl_ - 1];

    if (received_crc != crc24q(r_.data(), rl_ - 3)) {
        ++bad_;
        return;
    }

    RtcmFrame frame{};
    frame.length = rl_;
    frame.type = static_cast<uint16_t>(
        (static_cast<uint16_t>(r_[3]) << 4) |
        (r_[4] >> 4));
    frame.received_us = esp_timer_get_time();

    std::memcpy(
        frame.data.data(),
        r_.data(),
        rl_);

    ++valid_;

    if (cb_ != nullptr) {
        cb_(frame, ctx_);
    }
}

void GnssParser::ubx_done()
{
    constexpr uint8_t NAV_CLASS = 0x01;
    constexpr uint8_t NAV_SVIN_ID = 0x3B;
    constexpr uint16_t NAV_SVIN_LENGTH = 40;

    if (
        uc_ != NAV_CLASS ||
        ui_ != NAV_SVIN_ID ||
        ul_ < NAV_SVIN_LENGTH) {
        return;
    }

    SurveyInStatus survey{};
    survey.seen = true;
    survey.i_tow_ms = read_u32_le(&up_[4]);
    survey.dur_s = read_u32_le(&up_[8]);
    survey.obs = read_u32_le(&up_[32]);
    survey.mean_acc_m =
        static_cast<float>(read_u32_le(&up_[28])) *
        0.0001F;
    survey.valid = up_[36] != 0;
    survey.active = up_[37] != 0;
    survey.last_update_us = esp_timer_get_time();

    const double mean_x_m =
        static_cast<double>(read_i32_le(&up_[12])) * 0.01 +
        static_cast<double>(read_i8(up_[24])) * 0.0001;

    const double mean_y_m =
        static_cast<double>(read_i32_le(&up_[16])) * 0.01 +
        static_cast<double>(read_i8(up_[25])) * 0.0001;

    const double mean_z_m =
        static_cast<double>(read_i32_le(&up_[20])) * 0.01 +
        static_cast<double>(read_i8(up_[26])) * 0.0001;

    survey.position_valid = ecef_to_geodetic(
        mean_x_m,
        mean_y_m,
        mean_z_m,
        survey.latitude_deg,
        survey.longitude_deg,
        survey.altitude_m);

    StationState::instance().set_survey(survey);
}

uint32_t GnssParser::crc24q(
    const uint8_t *data,
    const size_t length)
{
    uint32_t crc = 0;

    for (size_t index = 0; index < length; ++index) {
        crc ^= static_cast<uint32_t>(data[index]) << 16;

        for (int bit = 0; bit < 8; ++bit) {
            crc <<= 1;

            if ((crc & 0x1000000) != 0) {
                crc ^= 0x1864CFB;
            }
        }
    }

    return crc & 0xFFFFFF;
}
