# NTRIP Caster Documentation

Thư mục này là tài liệu kỹ thuật và đặc tả chức năng cho hệ thống NTRIP Caster.

## Quy ước tài liệu đặc tả

Mỗi chức năng được mô tả theo các phần:

- Mục tiêu và phạm vi.
- Tác nhân.
- Điều kiện trước.
- Input và validation.
- Luồng xử lý chính.
- State transition.
- Output và lỗi.
- Bảo mật.
- Realtime/event.
- Dữ liệu liên quan.
- Tiêu chí nghiệm thu.
- Kịch bản kiểm thử.

## Mục lục

### Tổng quan và kiến trúc

- [Kiến trúc hệ thống](architecture/system-architecture.md)
- [Luồng dữ liệu end-to-end](architecture/data-flows.md)

### Cài đặt và cấu hình

- [Chuẩn bị môi trường](setup/environment.md)
- [Cấu hình `.env` và `config/ntrip.php`](setup/configuration.md)
- [Local development](development/local-development.md)

### Đặc tả chức năng

- [Authentication & user settings](features/authentication.md)
- [Station management](features/stations.md)
- [Device discovery & provisioning](features/device-provisioning.md)
- [Station configuration polling](features/station-configuration.md)
- [Station telemetry](features/telemetry.md)
- [Mountpoint management](features/mountpoints.md)
- [Rover Account & Mountpoint access](features/rover-access.md)
- [NTRIP TCP Caster](features/ntrip-caster.md)
- [RTCM3 parser](features/rtcm-parser.md)
- [NTRIP Sessions](features/sessions.md)
- [Alert Engine](features/alerts.md)
- [Map Dashboard & realtime](features/dashboard-realtime.md)
- [System status](features/system-status.md)
- [RTCM Flow Observability](features/system-observability.md)

### Giao tiếp và dữ liệu

- [HTTP API](api/http-api.md)
- [Realtime events](api/realtime-events.md)
- [Database schema](data/database-schema.md)

### Vận hành

- [Testing & quality gates](operations/testing.md)
- [Production deployment](operations/deployment.md)
- [Operations runbook](operations/runbook.md)
- [Troubleshooting](operations/troubleshooting.md)

## Trạng thái tài liệu

Tài liệu phản ánh bản beta hiện tại. Các ngưỡng observability là ngưỡng khởi đầu và phải được hiệu chỉnh sau field test/load test. Khi thay đổi API, schema hoặc event contract, cập nhật tài liệu trong cùng pull request.
