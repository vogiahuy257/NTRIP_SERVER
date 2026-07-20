#include "rtk_uart.hpp"
#include <array>
#include "app_defaults.hpp"
#include "driver/uart.h"
#include "esp_check.h"
#include "esp_log.h"
#include "gnss_parser.hpp"
#include "ntrip_source.hpp"
#include "runtime_config.hpp"
#include "station_state.hpp"
esp_err_t RtkUart::initialize(NtripSource *s)
{
    src_ = s;
    auto rc = RuntimeConfigManager::instance().snapshot();
    uart_config_t c{.baud_rate = rc.uart_baud, .data_bits = UART_DATA_8_BITS, .parity = UART_PARITY_DISABLE, .stop_bits = UART_STOP_BITS_1, .flow_ctrl = UART_HW_FLOWCTRL_DISABLE, .rx_flow_ctrl_thresh = 0, .source_clk = UART_SCLK_DEFAULT, .flags = {}};
    ESP_RETURN_ON_ERROR(uart_driver_install(app_defaults::UART_PORT, app_defaults::UART_RX_BUFFER, 0, 0, nullptr, 0), "UART", "install");
    ESP_RETURN_ON_ERROR(uart_param_config(app_defaults::UART_PORT, &c), "UART", "config");
    ESP_RETURN_ON_ERROR(uart_set_pin(app_defaults::UART_PORT, app_defaults::UART_TX_PIN, app_defaults::UART_RX_PIN, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE), "UART", "pins");
    return xTaskCreate(&RtkUart::entry, "rtk_uart", 4096, this, 8, nullptr) == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
}
void RtkUart::entry(void *x) { ((RtkUart *)x)->task(); }
void RtkUart::cb(const RtcmFrame &f, void *x) { ((RtkUart *)x)->on(f); }
void RtkUart::task()
{
    std::array<uint8_t, app_defaults::UART_READ_SIZE> b{};
    GnssParser p(&RtkUart::cb, this);
    while (true)
    {
        int n = uart_read_bytes(app_defaults::UART_PORT, b.data(), b.size(), pdMS_TO_TICKS(100));
        if (n > 0)
        {
            p.feed(b.data(), n);
            auto &s = StationState::instance();
            s.valid_frames.store(p.valid());
            s.bad_crc_frames.store(p.bad());
        }
    }
}
void RtkUart::on(const RtcmFrame &f)
{
    StationState::instance().last_rtcm_time_us.store(f.received_us);
    src_->enqueue(f);
}
