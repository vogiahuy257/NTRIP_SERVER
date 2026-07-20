idf_component_register(
    SRCS "main.cpp" "network_manager.cpp" "runtime_config.cpp"
         "station_state.cpp" "gnss_parser.cpp" "rtk_uart.cpp"
         "ntrip_source.cpp" "telemetry_http_client.cpp"
         "config_http_client.cpp"
    INCLUDE_DIRS "."
    REQUIRES esp_driver_uart esp_driver_gpio
             esp_wifi esp_eth esp_netif esp_event esp_timer
             nvs_flash cjson lwip esp_http_client
)
