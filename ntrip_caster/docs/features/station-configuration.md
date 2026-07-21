# Đặc tả: Station Configuration Polling

## Mục tiêu

ESP32 định kỳ lấy cấu hình runtime từ backend và chỉ tải payload mới khi revision tăng.

## Endpoint

```http
GET /api/v1/stations/{deviceId}/config?revision=<clientRevision>
```

## Luồng

1. Tìm Station theo `device_id`.
2. Từ chối nếu Station không tồn tại (`404`) hoặc disabled (`403`).
3. Từ chối nếu thiếu config/Mountpoint (`409`).
4. Cập nhật `last_seen_at` và `last_ip`.
5. Nếu client revision >= server revision, trả `204 No Content`.
6. Nếu có config mới, trả payload.

## Payload

```json
{
  "revision": 2,
  "enabled": true,
  "caster_host": "caster.example",
  "caster_port": 2101,
  "mountpoint": "BASE_01",
  "uart_baud": 115200,
  "telemetry_interval_ms": 2000,
  "config_poll_interval_ms": 30000,
  "max_rtcm_age_ms": 1500
}
```

## Cập nhật từ dashboard

```http
PUT /api/v1/stations/{station}/config
```

- Mọi thay đổi config làm revision tăng.
- Chỉ đổi Mountpoint cũng phải tăng revision.
- Cập nhật config và Mountpoint chạy trong transaction.

## Lưu ý bảo mật

Endpoint polling trong code beta nhận biết Station bằng device ID; production nên bổ sung Station Token hoặc signed request để ngăn đọc cấu hình trái phép.

## Tiêu chí nghiệm thu

- Client không tải lại config khi revision không đổi.
- Revision tăng đúng một lần cho mỗi update logic.
- Update transaction không để config và Mountpoint lệch nhau.
