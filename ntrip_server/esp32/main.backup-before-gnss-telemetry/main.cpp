#include "config_http_client.hpp"
#include "network_manager.hpp"
#include "ntrip_source.hpp"
#include "provisioning_http_client.hpp"
#include "rtk_uart.hpp"
#include "runtime_config.hpp"
#include "telemetry_http_client.hpp"

namespace
{
NtripSource source;
RtkUart uart;
TelemetryHttpClient telemetry;
ProvisioningHttpClient provisioning;
ConfigHttpClient config_http;
}

extern "C" void app_main()
{
    /* network_manager initializes NVS flash before RuntimeConfig loads it. */
    ESP_ERROR_CHECK(network_manager::initialize());
    ESP_ERROR_CHECK(RuntimeConfigManager::instance().initialize());

    ESP_ERROR_CHECK(source.initialize());
    ESP_ERROR_CHECK(uart.initialize(&source));

    ESP_ERROR_CHECK(provisioning.initialize());
    ESP_ERROR_CHECK(telemetry.initialize());
    ESP_ERROR_CHECK(config_http.initialize());
}
