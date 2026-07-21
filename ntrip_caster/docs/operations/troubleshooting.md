# Troubleshooting

## Port already in use

```bash
ss -lntp | grep -E '8000|8080|2101'
pgrep -af 'artisan|vite'
```

Không chạy process riêng đồng thời với `composer dev`.

## Realtime disconnected

- Kiểm tra `reverb:start`.
- Kiểm tra browser console/network WebSocket.
- So sánh `VITE_REVERB_HOST` với địa chỉ browser có thể truy cập.
- Sau đổi `VITE_*`, restart Vite hoặc build lại.
- Kiểm tra `/broadcasting/auth` trả thành công khi đã đăng nhập.

## Dấu hỏi/Dialog không mở hoặc bị che

- Dialog/Select dùng Portal nên z-index phải cao hơn Map Dashboard.
- Overlay/content cần tầng cao hơn panel/map.
- Kiểm tra không có ancestor áp `pointer-events-none` lên trigger thực tế.

## No Mountpoint data / No historical samples

- Kiểm tra `ntrip:serve` và `ntrip:observe`.
- Kiểm tra UDP host/port và bind host khớp nhau.
- Cần Source snapshot có Mountpoint hợp lệ.
- Raw history chỉ xuất hiện sau chu kỳ sample 5 giây.
- Kiểm tra API snapshot/history bằng browser authenticated.

## `0 persisted samples`

Realtime snapshot có thể vẫn chạy khi không có Mountpoint metrics đủ điều kiện tạo sample. Kiểm tra Source/Mountpoint active, aggregator interval và logs Observer.

## UDP wait error khi Ctrl+C

SIGINT có thể ngắt syscall đang chờ UDP. Nếu log chỉ xuất hiện khi shutdown và process kết thúc với SIGINT, đây không phải sự cố runtime. Signal handler nên tránh report warning khi stop flag đã được đặt.

## Device luôn pending

- Kiểm tra `X-Hardware-ID` ổn định.
- Approve đúng pending device.
- `NTRIP_PROVISIONING_KEY` phải khớp ESP32.
- Thiết bị phải lưu token/config và reconnect với `X-Provisioning-State: provisioned`.

## Telemetry 401

- Header phải là `X-Station-Token`.
- Token phải là plaintext được cấp; DB lưu hash nên không thể copy hash từ DB.
- Rotate token yêu cầu cập nhật thiết bị.

## SQLite locked

- Xác nhận permissions thư mục `database/`.
- Không chạy nhiều process migration/reset.
- Giảm transaction dài.
- Load cao cần đánh giá MySQL/PostgreSQL.

## Frontend lint React 19 `set-state-in-effect`

Không tắt rule. Derived state phải tính trong render/useMemo. Network/timer/WebSocket Effect phải cleanup và không cập nhật state đồng bộ không cần thiết trong thân Effect.
