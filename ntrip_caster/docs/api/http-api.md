# HTTP API Reference

Base URL local:

```text
http://127.0.0.1:8000/api
```

## Quy ước response

Phần lớn API quản trị trả:

```json
{
  "success": true,
  "data": {}
}
```

Validation failure: `422`; unauthenticated: `401`; forbidden: `403`; not found: `404`; state conflict: `409`.

## Public/device endpoints

| Method | Path | Chức năng |
|---|---|---|
| GET | `/health` | Backend liveness |
| GET | `/v1/system/status` | System summary |
| GET | `/v1/device-provisioning/{hardwareId}` | ESP32 provisioning; yêu cầu provisioning key |
| GET | `/v1/stations/{deviceId}/config` | Station config polling |
| POST | `/v1/stations/{deviceId}/telemetry` | Telemetry; yêu cầu `X-Station-Token` |

## Station & Mountpoint

| Method | Path |
|---|---|
| GET/POST | `/v1/stations` |
| GET/PUT/PATCH/DELETE | `/v1/stations/{station}` |
| PUT | `/v1/stations/{station}/config` |
| GET | `/v1/mountpoints` |
| GET/PUT | `/v1/mountpoints/{mountpoint}` |

Một số route Station/Mountpoint trong beta chưa được bọc auth ở `routes/api.php`. Production phải rà soát và đưa các write route vào `auth:sanctum`, `verified`.

## Authenticated management API

Yêu cầu Laravel session/Sanctum và verified user.

### Pending devices

```text
GET  /v1/pending-devices
GET  /v1/pending-devices/{id}
POST /v1/pending-devices/{id}/approve
POST /v1/pending-devices/{id}/reject
```

### Rover accounts

```text
apiResource /v1/rover-accounts
GET /v1/rover-accounts/{id}/mountpoints
PUT /v1/rover-accounts/{id}/mountpoints
```

### Sessions

```text
GET /v1/ntrip/sessions
GET /v1/ntrip/sessions/active
```

### Dashboard and alerts

```text
GET  /v1/dashboard/snapshot
GET  /v1/alerts
GET  /v1/alerts/summary
POST /v1/alerts/{alert}/acknowledge
```

### Observability

```text
GET /v1/observability/rtcm-flow/snapshot
GET /v1/observability/rtcm-flow/history
```

## Security headers

- Telemetry: `X-Station-Token`.
- Provisioning: `X-Provisioning-Key` hoặc Bearer token.
- Rover NTRIP TCP: HTTP Basic Authorization.

## Versioning

Tất cả domain API mới nên đặt dưới `/api/v1`. Breaking change phải tạo version mới hoặc cung cấp migration period.
