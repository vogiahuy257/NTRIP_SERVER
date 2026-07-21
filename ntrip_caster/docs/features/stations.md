# Đặc tả: Station Management

## Mục tiêu

Quản lý danh tính và trạng thái của trạm BASE/ESP32, liên kết một Station với cấu hình, Mountpoint, telemetry và NTRIP sessions.

## Tác nhân

- Quản trị viên dashboard.
- ESP32 đã provision.
- NTRIP Caster.

## Dữ liệu chính

- `device_id`: duy nhất, 1–64 ký tự, `[A-Za-z0-9_-]`.
- `name`: tối đa 120 ký tự.
- `enabled`: cho phép hoạt động.
- `source_token_hash`: hash token dùng cho Source/telemetry.
- `last_seen_at`, `last_ip`, `firmware_version`, `source_connected`.

## Tạo Station

Input bắt buộc:

```text
device_id, name, source_token, caster_host, mountpoint
```

Giá trị mặc định:

```text
caster_port=2101
uart_baud=115200
telemetry_interval_ms=2000
config_poll_interval_ms=30000
max_rtcm_age_ms=1500
enabled=true
```

Một transaction tạo đồng thời:

1. `stations`.
2. `station_configs` revision 1.
3. Primary public `mountpoints`.

`source_token` chỉ được trả tại thời điểm tạo và lưu dưới dạng hash.

## Cập nhật

- Có thể đổi `device_id`, `name`, `enabled` và rotate `source_token`.
- Token mới phải dài tối thiểu 8 ký tự.
- Disable Station làm config/telemetry hoặc Source bị từ chối theo luồng tương ứng.

## Xóa

Xóa Station phải tuân theo foreign key/cascade của schema. Production nên cân nhắc soft-delete hoặc audit log trước khi cho phép xóa dữ liệu lịch sử.

## API

- `GET /api/v1/stations`
- `POST /api/v1/stations`
- `GET /api/v1/stations/{station}`
- `PUT/PATCH /api/v1/stations/{station}`
- `DELETE /api/v1/stations/{station}`

## Tiêu chí nghiệm thu

- Không tạo được Station trùng `device_id` hoặc Mountpoint.
- Tạo thất bại không để lại record một phần.
- API không bao giờ trả `source_token_hash`.
- Dashboard phản ánh `source_connected`, last seen và telemetry mới nhất.
