#pragma once
#include <cstddef>
#include <cstdint>
#include "driver/gpio.h"
#include "driver/uart.h"
#include "esp_eth_mac_esp.h"
namespace app_defaults
{
    inline constexpr char FIRMWARE_VERSION[] = "1.0.0";
    inline constexpr bool WIFI_ENABLED = true;
    inline constexpr char WIFI_SSID[] = "CONHAMA";
    inline constexpr char WIFI_PASSWORD[] = "22042004";
    inline constexpr bool ETHERNET_ENABLED = true;
    inline constexpr int ETH_PHY_ADDRESS = 1;
    inline constexpr gpio_num_t ETH_PHY_RESET_PIN = GPIO_NUM_NC;
    inline constexpr gpio_num_t ETH_MDC_PIN = GPIO_NUM_23;
    inline constexpr gpio_num_t ETH_MDIO_PIN = GPIO_NUM_18;
    inline constexpr emac_rmii_clock_mode_t ETH_RMII_CLOCK_MODE = EMAC_CLK_EXT_IN;
    inline constexpr int ETH_RMII_CLOCK_GPIO = 0;
    inline constexpr char DEVICE_ID[] = "CTUAV-BASE-REAL-001";
    inline constexpr char CASTER_HOST[] = "ctuav-ntrip.local";
    inline constexpr uint16_t CASTER_PORT = 2101;
    inline constexpr uint16_t MANAGEMENT_PORT = 8000;
    inline constexpr char MOUNTPOINT[] = "CTUAV-RTCM-REAL-001";
    inline constexpr char AUTH_TOKEN[] = "ctuav-real-base-001-development-token";
    inline constexpr char SOURCE_PATH_PREFIX[] = "/";
    inline constexpr char CONFIG_PATH_PREFIX[] = "/api/v1/stations/";
    inline constexpr uart_port_t UART_PORT = UART_NUM_2;
    inline constexpr int UART_BAUD = 115200;
    inline constexpr gpio_num_t UART_RX_PIN = GPIO_NUM_16;
    inline constexpr gpio_num_t UART_TX_PIN = GPIO_NUM_17;
    inline constexpr std::size_t UART_RX_BUFFER = 16384;
    inline constexpr std::size_t UART_READ_SIZE = 1024;
    inline constexpr std::size_t MAX_RTCM_FRAME = 1029;
    inline constexpr std::size_t RTCM_QUEUE_LENGTH = 24;
    inline constexpr uint32_t TELEMETRY_INTERVAL_MS = 2000;
    inline constexpr uint32_t CONFIG_POLL_INTERVAL_MS = 30000;
    inline constexpr uint32_t MAX_RTCM_AGE_MS = 1500;
    inline constexpr uint32_t SURVEY_TIMEOUT_MS = 5000;
    inline constexpr uint32_t RETRY_MIN_MS = 1000;
    inline constexpr uint32_t RETRY_MAX_MS = 30000;
    inline constexpr uint32_t RETRY_JITTER_MS = 1000;
}
