# Đặc tả: Authentication & User Settings

## Mục tiêu

Bảo vệ dashboard và API quản trị bằng tài khoản người dùng, xác minh email, Sanctum session authentication và các tính năng bảo mật của Fortify.

## Tác nhân

- Người dùng chưa đăng nhập.
- Người dùng đã đăng nhập và verified.
- Quản trị viên hệ thống; bản beta chưa tách role chi tiết.

## Phạm vi

- Login/logout.
- Registration theo cấu hình Fortify.
- Email verification.
- Profile/password/security settings.
- Two-factor authentication và passkey nếu được bật.
- Broadcast channel authorization.

## Quy tắc

- Web dashboard dùng middleware `auth`, `verified`.
- API quản trị dùng `auth:sanctum`, `verified`.
- Private channel `ntrip.dashboard` yêu cầu user đăng nhập.
- Bản beta cho phép mọi user authenticated truy cập dashboard channel; production cần bổ sung policy/permission.

## Tiêu chí nghiệm thu

- User chưa đăng nhập bị redirect ở web và nhận `401` ở JSON API.
- User chưa verify không truy cập được route verified.
- Broadcast authentication từ chối request không có session hợp lệ.
- Thay password vô hiệu hóa credential cũ theo chính sách ứng dụng.
