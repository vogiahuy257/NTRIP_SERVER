# Đặc tả: NTRIP Sessions

## Mục tiêu

Lưu vòng đời của mọi kết nối Source và Rover để phục vụ dashboard, audit, thống kê và cảnh báo.

## Loại session

```text
source
rover
```

## Thuộc tính quan trọng

- `mountpoint_id`, `station_id` hoặc identity liên quan.
- `connection_type`.
- `remote_ip`.
- `connected_at`, `disconnected_at`.
- `bytes_transferred`.
- RTCM valid frames, CRC errors.
- Rover account/username nếu có.
- `disconnect_reason`.

## State

- Active: `disconnected_at IS NULL`.
- Ended: có `disconnected_at` và final stats.

## Realtime events

- `NtripSessionStarted`.
- `NtripSessionUpdated`.
- `NtripSessionEnded`.

Frontend reducer phải xử lý event idempotent và resync snapshot sau reconnect.

## API

- `GET /api/v1/ntrip/sessions`.
- `GET /api/v1/ntrip/sessions/active`.

## Tiêu chí nghiệm thu

- Mỗi accepted connection có đúng một session.
- Stats tăng đơn điệu trong session.
- Disconnect luôn lưu reason và thời điểm.
- Graceful shutdown kết thúc mọi session active của process.
- Active endpoint không trả session đã kết thúc.
