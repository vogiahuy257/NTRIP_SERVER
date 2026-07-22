#include "station_state.hpp"
StationState::StationState() : lock_(portMUX_INITIALIZER_UNLOCKED) {}
StationState &StationState::instance()
{
    static StationState s;
    return s;
}
StationSnapshot StationState::snapshot() const
{
    SurveyInStatus v;
    portENTER_CRITICAL(&lock_);
    v = survey_;
    portEXIT_CRITICAL(&lock_);
    return {valid_frames.load(), bad_crc_frames.load(), queue_drops.load(), stale_drops.load(), bytes_sent.load(), source_connected.load(), last_rtcm_time_us.load(), v};
}
void StationState::set_survey(const SurveyInStatus &s)
{
    portENTER_CRITICAL(&lock_);
    survey_ = s;
    portEXIT_CRITICAL(&lock_);
}
