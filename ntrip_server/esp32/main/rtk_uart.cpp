#include "rtk_uart.hpp"

#include <array>
#include <cstddef>

#include "app_defaults.hpp"
#include "driver/uart.h"
#include "esp_check.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "gnss_parser.hpp"
#include "ntrip_source.hpp"
#include "runtime_config.hpp"
#include "station_state.hpp"

namespace
{
constexpr char TAG[] = "RTK_UART";
constexpr uint32_t TASK_STACK_BYTES = 8192;
}

esp_err_t RtkUart::initialize(NtripSource *source)
{
    src_ = source;

    const RuntimeConfig config =
        RuntimeConfigManager::instance().snapshot();

    uart_config_t uart_config{
        .baud_rate = config.uart_baud,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
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
            0),
        TAG,
        "Cannot install UART driver");

    ESP_RETURN_ON_ERROR(
        uart_param_config(
            app_defaults::UART_PORT,
            &uart_config),
        TAG,
        "Cannot configure UART");

    ESP_RETURN_ON_ERROR(
        uart_set_pin(
            app_defaults::UART_PORT,
            app_defaults::UART_TX_PIN,
            app_defaults::UART_RX_PIN,
            UART_PIN_NO_CHANGE,
            UART_PIN_NO_CHANGE),
        TAG,
        "Cannot assign UART pins");

    return xTaskCreate(
               &RtkUart::entry,
               "rtk_uart",
               TASK_STACK_BYTES,
               this,
               8,
               nullptr) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

void RtkUart::entry(void *context)
{
    static_cast<RtkUart *>(context)->task();
}

void RtkUart::cb(
    const RtcmFrame &frame,
    void *context)
{
    static_cast<RtkUart *>(context)->on(frame);
}

void RtkUart::task()
{
    std::array<
        uint8_t,
        app_defaults::UART_READ_SIZE>
        buffer{};

    GnssParser parser(
        &RtkUart::cb,
        this);

    auto &state = StationState::instance();

    while (true) {
        const int length = uart_read_bytes(
            app_defaults::UART_PORT,
            buffer.data(),
            buffer.size(),
            pdMS_TO_TICKS(100));

        if (length < 0) {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        if (length == 0) {
            continue;
        }

        parser.feed(
            buffer.data(),
            static_cast<std::size_t>(length));

        state.valid_frames.store(parser.valid());
        state.bad_crc_frames.store(parser.bad());
    }
}

void RtkUart::on(const RtcmFrame &frame)
{
    auto &state = StationState::instance();
    state.last_rtcm_time_us.store(frame.received_us);

    src_->enqueue(frame);
}
