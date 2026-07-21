# Đặc tả: System Status & Health

## Mục tiêu

Cung cấp endpoint nhẹ để kiểm tra backend, Caster configuration và số liệu tổng hợp cơ bản.

## Endpoints

```text
GET /up
GET /api/health
GET /api/v1/system/status
```

## `/api/health`

Trả service name, trạng thái running và timestamp. Không kiểm tra sâu database/Caster socket.

## `/api/v1/system/status`

Trả:

- Service time/name.
- Caster host/port.
- Station total/enabled/source_connected.
- Mountpoint total/enabled.
- Active Source/Rover session count.
- Tổng Source/Rover bytes từ session history.

## Lưu ý

Endpoint status hiện có thể công khai trong route beta. Production cần xác định dữ liệu nào được phép public; số lượng kết nối và traffic có thể là thông tin vận hành nhạy cảm.

## Tiêu chí nghiệm thu

- Không gây query nặng với dataset thông thường.
- Timestamp dùng ISO-8601.
- Active count chỉ tính `disconnected_at IS NULL`.
