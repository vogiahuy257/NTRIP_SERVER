#pragma once
#include <atomic>
#include <cstdint>
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"
struct SurveyInStatus
{
    bool seen{false};
    uint32_t i_tow_ms{0};
    uint32_t dur_s{0};
    float mean_acc_m{0};
    uint32_t obs{0};
    bool valid{false};
    bool active{false};
    int64_t last_update_us{0};
};
struct StationSnapshot
{
    uint64_t valid_frames, bad_crc_frames, queue_drops, stale_drops, bytes_sent;
    bool source_connected;
    int64_t last_rtcm_time_us;
    SurveyInStatus survey;
};
class StationState
{
public:
    static StationState &instance();
    StationSnapshot snapshot() const;
    void set_survey(const SurveyInStatus &);
    std::atomic<uint64_t> valid_frames{0}, bad_crc_frames{0}, queue_drops{0}, stale_drops{0}, bytes_sent{0};
    std::atomic<bool> source_connected{false};
    std::atomic<int64_t> last_rtcm_time_us{0};

private:
    StationState();
    mutable portMUX_TYPE lock_;
    SurveyInStatus survey_{};
};
