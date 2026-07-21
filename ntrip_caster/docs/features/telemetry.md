# Đặc tả: Station Telemetry

## Mục tiêu

Nhận trạng thái ESP32/BASE, lưu snapshot telemetry mới nhất và cập nhật Dashboard realtime.

## Endpoint

```http
POST /api/v1/stations/{deviceId}/telemetry
X-Station-Token: <source-token>
Content-Type: application/json
```

## Payload hỗ trợ

```json
{
  "firmware_version": "1.0.0",
  "source_connected": true,
  "network": {
    "type": "wifi",
    "ip": "192.168.1.20",
    "rssi": -55
  },
  "survey_in": {
    "active": false,
    "valid": true,
    "duration_s": 180,
    "mean_accuracy_m": 0.02
  },
  "rtcm": {
    "bytes_sent": 100000,
    "frames_valid": 500,
    "crc_errors": 0,
    "upload_bps": 1250
  },
  "system": {
    "uptime_s": 3600,
    "free_heap_bytes": 150000,
    "temperature_c": 48.5
  }
}
```

## Xử lý

- Station không tồn tại: `404`.
- Station disabled: `403`.
- Token sai/thiếu: `401`.
- Payload sai: `422`.
- Thành công: cập nhật Station, upsert telemetry và trả `202`.
- Broadcast `StationTelemetryUpdated`.

## Lưu trữ

Bản beta lưu telemetry mới nhất theo Station bằng `updateOrCreate`; không phải chuỗi thời gian đầy đủ. Dữ liệu thô nằm trong JSON `payload`, thời điểm ở `received_at`.

## Tiêu chí nghiệm thu

- Token được kiểm tra bằng hash, không so sánh plaintext DB.
- Telemetry mới thay thế snapshot cũ của cùng Station.
- Event realtime có timestamp server nhận.
- Một payload thiếu nhóm tùy chọn vẫn được chấp nhận.
