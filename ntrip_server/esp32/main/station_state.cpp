#include "station_state.hpp"

StationState::StationState()
    : lock_(portMUX_INITIALIZER_UNLOCKED)
{
}

StationState &StationState::instance()
{
    static StationState state;
    return state;
}

StationSnapshot StationState::snapshot() const
{
    SurveyInStatus survey;

    portENTER_CRITICAL(&lock_);
    survey = survey_;
    portEXIT_CRITICAL(&lock_);

    return {
        .valid_frames = valid_frames.load(),
        .bad_crc_frames = bad_crc_frames.load(),
        .queue_drops = queue_drops.load(),
        .stale_drops = stale_drops.load(),
        .bytes_sent = bytes_sent.load(),
        .source_connected = source_connected.load(),
        .last_rtcm_time_us = last_rtcm_time_us.load(),
        .survey = survey,
    };
}

void StationState::set_survey(const SurveyInStatus &survey)
{
    portENTER_CRITICAL(&lock_);
    survey_ = survey;
    portEXIT_CRITICAL(&lock_);
}
