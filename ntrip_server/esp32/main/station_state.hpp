#pragma once

#include <atomic>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

struct SurveyInStatus
{
    bool seen{false};
    bool position_valid{false};

    uint32_t i_tow_ms{0};
    uint32_t dur_s{0};
    uint32_t obs{0};

    float mean_acc_m{0.0F};

    bool valid{false};
    bool active{false};

    double latitude_deg{0.0};
    double longitude_deg{0.0};
    double altitude_m{0.0};

    int64_t last_update_us{0};
};

struct StationSnapshot
{
    uint64_t valid_frames{0};
    uint64_t bad_crc_frames{0};
    uint64_t queue_drops{0};
    uint64_t stale_drops{0};
    uint64_t bytes_sent{0};

    bool source_connected{false};
    int64_t last_rtcm_time_us{0};

    SurveyInStatus survey{};
};

class StationState
{
public:
    static StationState &instance();

    StationSnapshot snapshot() const;
    void set_survey(const SurveyInStatus &survey);

    std::atomic<uint64_t> valid_frames{0};
    std::atomic<uint64_t> bad_crc_frames{0};
    std::atomic<uint64_t> queue_drops{0};
    std::atomic<uint64_t> stale_drops{0};
    std::atomic<uint64_t> bytes_sent{0};

    std::atomic<bool> source_connected{false};
    std::atomic<int64_t> last_rtcm_time_us{0};

private:
    StationState();

    mutable portMUX_TYPE lock_;
    SurveyInStatus survey_{};
};
