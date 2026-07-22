#include "rtk_uart.hpp"

#include <array>
#include <cstddef>
#include <cstdio>

#include "app_defaults.hpp"
#include "driver/uart.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "gnss_parser.hpp"
#include "ntrip_source.hpp"
#include "runtime_config.hpp"
#include "station_state.hpp"

namespace
{
constexpr char TAG[] = "RTK_UART";

constexpr int64_t REPORT_INTERVAL_US =
    2'000'000;

void format_hex_preview(
    const uint8_t *data,
    std::size_t length,
    char *output,
    std::size_t output_size)
{
    if (
        data == nullptr
        || output == nullptr
        || output_size == 0
    ) {
        return;
    }

    output[0] = '\0';

    std::size_t used = 0;

    for (
        std::size_t index = 0;
        index < length;
        ++index
    ) {
        const int written = std::snprintf(
            output + used,
            output_size - used,
            index == 0 ? "%02X" : " %02X",
            static_cast<unsigned>(data[index])
        );

        if (
            written <= 0
            || static_cast<std::size_t>(written)
                >= output_size - used
        ) {
            break;
        }

        used += static_cast<std::size_t>(
            written
        );
    }
}
}

esp_err_t RtkUart::initialize(
    NtripSource *source
)
{
    src_ = source;

    const RuntimeConfig config =
        RuntimeConfigManager::instance()
            .snapshot();

    uart_config_t uart_config{
        .baud_rate = config.uart_baud,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl =
            UART_HW_FLOWCTRL_DISABLE,
        .rx_flow_ctrl_thresh = 0,
        .source_clk = UART_SCLK_DEFAULT,
        .flags = {},
    };

    ESP_RETURN_ON_ERROR(
        uart_driver_install(
            app_defaults::UART_PORT,
            app_defaults::UART_RX_BUFFER,
            0,
            0,
            nullptr,
            0
        ),
        TAG,
        "Cannot install UART driver"
    );

    ESP_RETURN_ON_ERROR(
        uart_param_config(
            app_defaults::UART_PORT,
            &uart_config
        ),
        TAG,
        "Cannot configure UART"
    );

    ESP_RETURN_ON_ERROR(
        uart_set_pin(
            app_defaults::UART_PORT,
            app_defaults::UART_TX_PIN,
            app_defaults::UART_RX_PIN,
            UART_PIN_NO_CHANGE,
            UART_PIN_NO_CHANGE
        ),
        TAG,
        "Cannot assign UART pins"
    );

    uint32_t actual_baud = 0;

    const esp_err_t baud_result =
        uart_get_baudrate(
            app_defaults::UART_PORT,
            &actual_baud
        );

    if (baud_result == ESP_OK) {
        ESP_LOGI(
            TAG,
            "Configured UART%d: "
            "baud=%lu RX=GPIO%d TX=GPIO%d "
            "format=8N1 flow=none",
            static_cast<int>(
                app_defaults::UART_PORT
            ),
            static_cast<unsigned long>(
                actual_baud
            ),
            static_cast<int>(
                app_defaults::UART_RX_PIN
            ),
            static_cast<int>(
                app_defaults::UART_TX_PIN
            )
        );
    } else {
        ESP_LOGW(
            TAG,
            "Cannot read configured baud: %s",
            esp_err_to_name(baud_result)
        );
    }

    constexpr uint32_t RTK_UART_TASK_STACK_BYTES = 8192;

    return xTaskCreate(
            &RtkUart::entry,
            "rtk_uart",
            RTK_UART_TASK_STACK_BYTES,
            this,
            8,
            nullptr
        ) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

void RtkUart::entry(void *context)
{
    static_cast<RtkUart *>(context)
        ->task();
}

void RtkUart::cb(
    const RtcmFrame &frame,
    void *context
)
{
    static_cast<RtkUart *>(context)
        ->on(frame);
}

void RtkUart::task()
{
    std::array<
        uint8_t,
        app_defaults::UART_READ_SIZE
    > buffer{};

    GnssParser parser(
        &RtkUart::cb,
        this
    );

    uint64_t interval_uart_bytes = 0;
    uint64_t previous_valid_frames = 0;
    uint64_t previous_bad_frames = 0;

    int64_t last_report_us =
        esp_timer_get_time();

    int64_t last_uart_byte_us = 0;

    bool first_data_logged = false;

    while (true) {
        const int length = uart_read_bytes(
            app_defaults::UART_PORT,
            buffer.data(),
            buffer.size(),
            pdMS_TO_TICKS(100)
        );

        const int64_t now_us =
            esp_timer_get_time();

        if (length > 0) {
            interval_uart_bytes +=
                static_cast<uint64_t>(
                    length
                );

            last_uart_byte_us = now_us;

            if (!first_data_logged) {
                const std::size_t preview_length =
                    static_cast<std::size_t>(
                        length
                    ) < 12
                    ? static_cast<std::size_t>(
                          length
                      )
                    : 12;

                char preview[48]{};

                format_hex_preview(
                    buffer.data(),
                    preview_length,
                    preview,
                    sizeof(preview)
                );

                ESP_LOGI(
                    TAG,
                    "First UART data: "
                    "bytes=%d head=%s",
                    length,
                    preview
                );

                first_data_logged = true;
            }

            parser.feed(
                buffer.data(),
                static_cast<std::size_t>(
                    length
                )
            );

            auto &state =
                StationState::instance();

            state.valid_frames.store(
                parser.valid()
            );

            state.bad_crc_frames.store(
                parser.bad()
            );
        }

        if (
            now_us - last_report_us
            < REPORT_INTERVAL_US
        ) {
            continue;
        }

        const int64_t interval_us =
            now_us - last_report_us;

        const uint64_t valid_frames =
            parser.valid();

        const uint64_t bad_frames =
            parser.bad();

        const uint64_t valid_delta =
            valid_frames
            - previous_valid_frames;

        const uint64_t bad_delta =
            bad_frames
            - previous_bad_frames;

        const uint64_t uart_bps =
            interval_us > 0
            ? interval_uart_bytes
                * 1'000'000ULL
                / static_cast<uint64_t>(
                    interval_us
                )
            : 0;

        const StationSnapshot state =
            StationState::instance()
                .snapshot();

        const int64_t uart_age_ms =
            last_uart_byte_us > 0
            ? (
                now_us
                - last_uart_byte_us
            ) / 1000
            : -1;

        const int64_t rtcm_age_ms =
            state.last_rtcm_time_us > 0
            ? (
                now_us
                - state.last_rtcm_time_us
            ) / 1000
            : -1;

        if (interval_uart_bytes == 0) {
            ESP_LOGW(
                TAG,
                "No UART input: "
                "baud configured but no bytes "
                "received; uart_age=%lld ms",
                static_cast<long long>(
                    uart_age_ms
                )
            );
        } else if (valid_delta == 0) {
            ESP_LOGW(
                TAG,
                "UART data without valid RTCM: "
                "raw=%llu B/s "
                "bad_crc_delta=%llu "
                "total_valid=%llu "
                "uart_age=%lld ms. "
                "Check baud and RTCM output "
                "on the connected GNSS port.",
                static_cast<
                    unsigned long long
                >(uart_bps),
                static_cast<
                    unsigned long long
                >(bad_delta),
                static_cast<
                    unsigned long long
                >(valid_frames),
                static_cast<long long>(
                    uart_age_ms
                )
            );
        } else {
            ESP_LOGI(
                TAG,
                "RTCM input healthy: "
                "raw=%llu B/s "
                "valid_delta=%llu "
                "bad_crc_delta=%llu "
                "total_valid=%llu "
                "rtcm_age=%lld ms "
                "survey_seen=%s "
                "survey_active=%s "
                "survey_valid=%s "
                "survey_dur=%lu s "
                "survey_acc=%.4f m",
                static_cast<
                    unsigned long long
                >(uart_bps),
                static_cast<
                    unsigned long long
                >(valid_delta),
                static_cast<
                    unsigned long long
                >(bad_delta),
                static_cast<
                    unsigned long long
                >(valid_frames),
                static_cast<long long>(
                    rtcm_age_ms
                ),
                state.survey.seen
                    ? "true"
                    : "false",
                state.survey.active
                    ? "true"
                    : "false",
                state.survey.valid
                    ? "true"
                    : "false",
                static_cast<unsigned long>(
                    state.survey.dur_s
                ),
                static_cast<double>(
                    state.survey.mean_acc_m
                )
            );
        }

        interval_uart_bytes = 0;

        previous_valid_frames =
            valid_frames;

        previous_bad_frames =
            bad_frames;

        last_report_us = now_us;
    }
}

void RtkUart::on(
    const RtcmFrame &frame
)
{
    auto &state =
        StationState::instance();

    state.last_rtcm_time_us.store(
        frame.received_us
    );

    static uint64_t frame_count = 0;

    ++frame_count;

    if (
        frame_count == 1
        || frame_count % 100 == 0
    ) {
        ESP_LOGI(
            TAG,
            "Valid RTCM frame: "
            "count=%llu type=%u length=%u",
            static_cast<
                unsigned long long
            >(frame_count),
            static_cast<unsigned>(
                frame.type
            ),
            static_cast<unsigned>(
                frame.length
            )
        );
    }

    if (!src_->enqueue(frame)) {
        ESP_LOGW(
            TAG,
            "RTCM queue full: "
            "type=%u length=%u",
            static_cast<unsigned>(
                frame.type
            ),
            static_cast<unsigned>(
                frame.length
            )
        );
    }
}