# Đặc tả: Rover Account & Mountpoint Access

## Mục tiêu

Xác thực Rover bằng Basic Authentication, giới hạn số kết nối và cho phép phân quyền chi tiết theo Mountpoint.

## Rover Account

- `username`: chuẩn hóa lowercase; 3–80; bắt đầu bằng chữ/số; cho phép `a-z0-9._-`.
- `password`: tối thiểu 12, confirmation khi tạo/cập nhật.
- `enabled`.
- `max_connections`: 1–1000.
- `expires_at`.
- `display_name`, `notes`.

Password chỉ lưu hash.

## Mountpoint grant

Mỗi grant có thể chứa:

- `enabled`.
- `max_connections`, không lớn hơn giới hạn account.
- `starts_at`.
- `expires_at`, phải sau `starts_at`.

## Xác thực Rover

1. Parse Basic Authorization.
2. Tìm account theo username.
3. Kiểm tra password, enabled và expiry.
4. Kiểm tra Mountpoint enabled/access mode.
5. Với restricted Mountpoint, kiểm tra grant và thời gian hiệu lực.
6. Đếm active connection của account và grant.
7. Tạo Rover session nếu hợp lệ.

## API quản trị

- CRUD `/api/v1/rover-accounts`.
- `GET /api/v1/rover-accounts/{id}/mountpoints`.
- `PUT /api/v1/rover-accounts/{id}/mountpoints`.

Tất cả nằm trong `auth:sanctum`, `verified`.

## Tiêu chí nghiệm thu

- Username không phân biệt hoa/thường sau chuẩn hóa.
- Password plaintext không xuất hiện trong response/log.
- Account disabled/expired không kết nối được.
- Không vượt account `max_connections` hoặc grant limit.
- Revoked grant ảnh hưởng kết nối mới; chính sách đóng kết nối đang hoạt động phải được xác định rõ khi production.
