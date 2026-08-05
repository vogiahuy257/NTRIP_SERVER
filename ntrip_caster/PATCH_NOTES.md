# AUTO Mountpoint backend completion patch

Patch này được tạo trực tiếp từ `app_now.zip`. Chỉ thay các phần còn thiếu, không viết lại selector/router/authentication/session model đã hoàn thành.

## Thay đổi

- Chặn Source NTRIP v1/v2 sử dụng tên mountpoint ảo `AUTO` trước Device Discovery.
- Thêm `AUTO` vào sourcetable với Basic authentication và yêu cầu GGA.
- Đổi phản hồi Rover sang `Connection: keep-alive`.
- Giới hạn ghi GGA vào database theo `ntrip.rover_gga_min_interval_ms`; routing AUTO vẫn chạy theo mọi GGA hợp lệ.
- Lưu vị trí GGA gần nhất trong runtime để failover ngay khi Source mất kết nối hoặc Base bị disable/remove.
- AUTO Rover không bị disconnect khi Base lỗi; hệ thống chuyển Base khác hoặc trở về trạng thái chờ.
- Áp dụng `max_rover_connections` của mountpoint và `max_connections` của grant khi chọn Base.
- Bổ sung test nhiều Rover độc lập, capacity, failover Source, sourcetable và payload realtime.
- Bổ sung payload realtime: `requested_mountpoint`, `auto_mountpoint`, `auto_state`, `mountpoint_switch_count`, `last_mountpoint_switch_at` và resolved mountpoint.
- Khi assign/switch, phát payload session đầy đủ thay vì payload mountpoint rời rạc.

## Áp dụng

Tại thư mục gốc `ntrip_caster`:

```bash
unzip -o auto_mountpoint_backend_completion.zip -d .

vendor/bin/pint \
  app/Services/Ntrip/AutoMountpoint/AutoMountpointCoordinator.php \
  app/Services/Ntrip/NtripCaster.php \
  app/Services/Ntrip/Sessions/NtripSessionService.php \
  app/Services/Ntrip/Sessions/NtripSessionPayloadFactory.php \
  tests/Feature/Services/Ntrip/AutoMountpoint

php artisan config:clear
```

## Kiểm tra

```bash
php artisan test \
  tests/Unit/Services/Ntrip/AutoMountpoint \
  tests/Feature/Services/Ntrip/AutoMountpoint \
  tests/Feature/Services/Ntrip/RoverAuthenticationServiceTest.php \
  tests/Feature/Services/Ntrip/RoverConnectionServiceTest.php

vendor/bin/phpstan analyse \
  app/Services/Ntrip/AutoMountpoint \
  app/Services/Ntrip/NtripCaster.php \
  app/Services/Ntrip/Sessions/NtripSessionService.php \
  app/Services/Ntrip/Sessions/NtripSessionPayloadFactory.php
```

## Phạm vi vận hành

Capacity được tính từ các Rover đang kết nối trong cùng một tiến trình `ntrip:serve`. Kiến trúc hiện tại là một Caster daemon; chưa hỗ trợ nhiều Caster instance cùng chia sẻ socket/runtime state.
