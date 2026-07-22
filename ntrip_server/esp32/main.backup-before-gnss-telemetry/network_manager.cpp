#include "network_manager.hpp"
#include <cstring>
#include "app_defaults.hpp"
#include "esp_check.h"
#include "esp_eth.h"
#include "esp_eth_mac_esp.h"
#include "esp_eth_netif_glue.h"
#include "esp_eth_phy_lan87xx.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/event_groups.h"
#include "nvs_flash.h"
namespace
{
    constexpr char TAG[] = "NETWORK";
    constexpr EventBits_t WB = 1U, EB = 2U, AB = 3U;
    EventGroupHandle_t eg = nullptr;
    esp_eth_handle_t eh = nullptr;
    esp_err_t nvs_init()
    {
        auto r = nvs_flash_init();
        if (r == ESP_ERR_NVS_NO_FREE_PAGES || r == ESP_ERR_NVS_NEW_VERSION_FOUND)
        {
            ESP_ERROR_CHECK(nvs_flash_erase());
            r = nvs_flash_init();
        }
        return r;
    }
    void wh(void *, esp_event_base_t b, int32_t id, void *d)
    {
        if (b == WIFI_EVENT && id == WIFI_EVENT_STA_START)
        {
            esp_wifi_connect();
            return;
        }
        if (b == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED)
        {
            xEventGroupClearBits(eg, WB);
            esp_wifi_connect();
            return;
        }
        if (b == IP_EVENT && id == IP_EVENT_STA_GOT_IP)
        {
            xEventGroupSetBits(eg, WB);
            (void)d;
        }
    }
    void ehf(void *, esp_event_base_t b, int32_t id, void *)
    {
        if (b == ETH_EVENT && (id == ETHERNET_EVENT_DISCONNECTED || id == ETHERNET_EVENT_STOP))
            xEventGroupClearBits(eg, EB);
    }
    void eip(void *, esp_event_base_t b, int32_t id, void *d)
    {
        if (b == IP_EVENT && id == IP_EVENT_ETH_GOT_IP)
        {
            xEventGroupSetBits(eg, EB);
            (void)d;
        }
    }
    esp_err_t wifi_init()
    {
        if (!app_defaults::WIFI_ENABLED)
            return ESP_OK;
        if (!esp_netif_create_default_wifi_sta())
            return ESP_ERR_NO_MEM;
        wifi_init_config_t i = WIFI_INIT_CONFIG_DEFAULT();
        ESP_RETURN_ON_ERROR(esp_wifi_init(&i), TAG, "wifi");
        ESP_RETURN_ON_ERROR(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wh, nullptr), TAG, "wifi evt");
        ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wh, nullptr), TAG, "wifi ip");
        wifi_config_t c{};
        std::strncpy((char *)c.sta.ssid, app_defaults::WIFI_SSID, sizeof(c.sta.ssid) - 1);
        std::strncpy((char *)c.sta.password, app_defaults::WIFI_PASSWORD, sizeof(c.sta.password) - 1);
        c.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
        c.sta.pmf_cfg.capable = true;
        ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "mode");
        ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &c), TAG, "config");
        ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "start");
        return esp_wifi_set_ps(WIFI_PS_NONE);
    }
    esp_err_t eth_init()
    {
        if (!app_defaults::ETHERNET_ENABLED)
            return ESP_OK;
        eth_mac_config_t mc = ETH_MAC_DEFAULT_CONFIG();
        eth_phy_config_t pc = ETH_PHY_DEFAULT_CONFIG();
        pc.phy_addr = app_defaults::ETH_PHY_ADDRESS;
        pc.reset_gpio_num = (int)app_defaults::ETH_PHY_RESET_PIN;
        eth_esp32_emac_config_t ec = ETH_ESP32_EMAC_DEFAULT_CONFIG();
        ec.smi_gpio.mdc_num = app_defaults::ETH_MDC_PIN;
        ec.smi_gpio.mdio_num = app_defaults::ETH_MDIO_PIN;
        ec.clock_config.rmii.clock_mode = app_defaults::ETH_RMII_CLOCK_MODE;
        ec.clock_config.rmii.clock_gpio = app_defaults::ETH_RMII_CLOCK_GPIO;
        auto *mac = esp_eth_mac_new_esp32(&ec, &mc);
        if (!mac)
            return ESP_FAIL;
        auto *phy = esp_eth_phy_new_lan87xx(&pc);
        if (!phy)
        {
            mac->del(mac);
            return ESP_FAIL;
        }
        esp_eth_config_t c = ETH_DEFAULT_CONFIG(mac, phy);
        auto r = esp_eth_driver_install(&c, &eh);
        if (r != ESP_OK)
            return r;
        esp_netif_config_t nc = ESP_NETIF_DEFAULT_ETH();
        auto *n = esp_netif_new(&nc);
        if (!n)
            return ESP_ERR_NO_MEM;
        auto g = esp_eth_new_netif_glue(eh);
        if (!g)
            return ESP_ERR_NO_MEM;
        ESP_RETURN_ON_ERROR(esp_netif_attach(n, g), TAG, "attach");
        ESP_RETURN_ON_ERROR(esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, &ehf, nullptr), TAG, "eth evt");
        ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, &eip, nullptr), TAG, "eth ip");
        return esp_eth_start(eh);
    }
}
namespace network_manager
{
    esp_err_t initialize()
    {
        ESP_RETURN_ON_ERROR(nvs_init(), TAG, "nvs");
        ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "netif");
        ESP_RETURN_ON_ERROR(esp_event_loop_create_default(), TAG, "loop");
        eg = xEventGroupCreate();
        if (!eg)
            return ESP_ERR_NO_MEM;
        const esp_err_t er = eth_init();
        const esp_err_t wr = wifi_init();
        return er == ESP_OK || wr == ESP_OK ? ESP_OK : ESP_FAIL;
    }
    void wait_connected() { xEventGroupWaitBits(eg, AB, pdFALSE, pdFALSE, portMAX_DELAY); }
    bool connected() { return eg && (xEventGroupGetBits(eg) & AB); }
    bool ethernet() { return eg && (xEventGroupGetBits(eg) & EB); }
    bool wifi() { return eg && (xEventGroupGetBits(eg) & WB); }
    Interface active() { return ethernet() ? Interface::Ethernet : wifi() ? Interface::WiFi
                                                                          : Interface::None; }
    const char *active_name() { return active() == Interface::Ethernet ? "ethernet" : active() == Interface::WiFi ? "wifi"
                                                                                                                  : "none"; }
    int wifi_rssi()
    {
        if (!wifi())
            return -127;
        wifi_ap_record_t r{};
        return esp_wifi_sta_get_ap_info(&r) == ESP_OK ? r.rssi : -127;
    }
}
