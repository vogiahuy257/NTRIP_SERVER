# Đặc tả: NTRIP TCP Caster

## Mục tiêu

Cung cấp TCP server tương thích NTRIP để nhận Source RTCM và phân phối đến nhiều Rover mà không để một socket chậm block toàn bộ server.

## Khởi chạy

```bash
php artisan ntrip:serve
```

Mặc định bind `0.0.0.0:2101`.

## Loại request

- Root/sourcetable request.
- Source publish request tới Mountpoint.
- Rover GET request tới Mountpoint.
- Legacy Source và discovered ESP32 Source.

## Nonblocking I/O

- Dùng `stream_select` hoặc cơ chế tương đương.
- Mỗi client có `input_buffer` và output buffers.
- RTCM protocol bytes được tách khỏi HTTP handshake bytes.
- Output buffer mỗi client bị giới hạn, mặc định 256 KiB.
- Partial write/zero write là trạng thái có thể xảy ra bình thường với nonblocking socket.
- Write failure hoặc policy overflow dẫn đến đóng session với reason phù hợp.

## Source flow

1. Nhận và giới hạn header.
2. Parse Mountpoint, identity headers và authentication.
3. Kiểm tra Station/Mountpoint enabled.
4. Đảm bảo chính sách một Source active cho Mountpoint.
5. Tạo Source session.
6. Đọc RTCM chunks, parse frame statistics và fan-out.
7. Flush stats định kỳ.

## Rover flow

1. Parse request và Basic Auth nếu cần.
2. Resolve Mountpoint.
3. Authenticate/authorize account.
4. Tạo Rover session.
5. Queue mỗi chunk Source vào buffer của Rover.
6. Drain buffer theo socket writable.

## Timeout

- Header timeout mặc định 15 giây.
- Source idle timeout mặc định 30 giây.
- Select timeout mặc định 200 ms.

## Graceful shutdown

SIGINT/SIGTERM:

- Ngừng accept kết nối.
- Đóng Source/Rover sockets.
- Flush thống kê cuối.
- Ghi `disconnected_at` và `disconnect_reason`.
- Đặt `source_connected=false` khi phù hợp.

## Tiêu chí nghiệm thu

- Sourcetable trả được khi Caster chạy.
- Một Rover chậm không làm giảm khả năng phục vụ Rover khác.
- Buffer không tăng vô hạn.
- Session luôn được kết thúc khi disconnect hoặc shutdown.
- Caster restart không để Station hiển thị Source connected sai kéo dài.
