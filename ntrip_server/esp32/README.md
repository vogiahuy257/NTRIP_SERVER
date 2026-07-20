# ESP32 NTRIP full firmware

## Connections

The firmware keeps three independent connections:

1. **TCP RTCM stream**
   - Sends raw RTCM3 to the caster.
   - Highest application priority.
   - Does not carry dashboard or configuration traffic.

2. **WebSocket telemetry**
   - Sends realtime telemetry to the dashboard.
   - Transmit-only at application level.
   - Does not receive configuration or commands.

3. **HTTP configuration**
   - Periodically checks for a newer configuration.
   - Saves accepted configuration to NVS.
   - Restarts after applying a new revision.

## HTTP remote configuration

ESP32 requests:

```http
GET /api/v1/stations/BASE_001/config?revision=3 HTTP/1.1
Authorization: Bearer base-001-development-token
X-Device-ID: BASE_001
```

No update:

```http
HTTP/1.1 204 No Content
```

New configuration:

```json
{
  "revision": 4,
  "enabled": true,
  "caster_host": "192.168.1.100",
  "caster_port": 2101,
  "management_port": 2102,
  "mountpoint": "BASE_001",
  "auth_token": "base-001-development-token",
  "uart_baud": 115200,
  "telemetry_interval_ms": 2000,
  "config_poll_interval_ms": 30000,
  "max_rtcm_age_ms": 1500
}
```

`revision` is mandatory and must be greater than the revision stored by the
ESP32. Missing optional fields keep their current values.

## WebSocket telemetry

```text
ws://SERVER:2102/api/v1/stations/ws
```

WebSocket is used only to send:

- registration
- network interface
- RTCM upload rate
- source connection state
- RTCM counters
- UBX-NAV-SVIN status

Configuration is never accepted through WebSocket.

## Build

```bash
source ~/.espressif/tools/activate_idf_v6.0.2.sh
cd ~/NTRIP/NTRIP_SERVER/ntrip_server/esp32

idf.py set-target esp32
idf.py fullclean
idf.py reconfigure
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Edit the initial values in:

```text
main/app_defaults.hpp
```

The ZED-F9P UART must output both RTCM3 and UBX-NAV-SVIN.
