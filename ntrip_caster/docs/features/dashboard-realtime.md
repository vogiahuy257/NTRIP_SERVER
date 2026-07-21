# Đặc tả: Map Dashboard & Realtime

## Mục tiêu

Cung cấp giao diện map-first với bản đồ MapLibre tồn tại xuyên suốt các trang và cập nhật dữ liệu bằng Reverb mà không reload bản đồ.

## Layout

- Map toàn màn hình là lớp nền cố định.
- Top navigation và page panels là lớp nổi.
- Page prefix thuộc MapDashboard dùng chung layout/provider.
- Chuyển route chỉ thay page content; map center, zoom, pitch và selected state được giữ.

## Thiết kế

- Glassmorphism, blur cao nhưng vẫn đủ contrast.
- Card bo góc lớn, viền mảnh, bóng nhẹ.
- Responsive một cột mobile; nhiều cột theo breakpoint.
- Safe-area cho notch/gesture bar.
- Touch target tối thiểu xấp xỉ 44 px.
- Không phụ thuộc hover cho chức năng bắt buộc.
- Tôn trọng `prefers-reduced-motion`.

## Realtime

- Một Echo/Reverb connection toàn ứng dụng.
- Private channel `ntrip.dashboard`.
- Dashboard load snapshot HTTP ban đầu.
- Event reducer cập nhật Station/Session/Alert.
- Khi reconnect, `useRealtimeResync` gọi snapshot để bù event bị mất.

## Marker

- Marker screen-space, MapLibre quản lý transform root.
- Animation chỉ áp dụng vào inner visual.
- Click/focus pan và zoom tới Station với mức zoom cố định, không cộng dồn.

## Tiêu chí nghiệm thu

- Chuyển Dashboard ↔ Stations ↔ Mountpoints ↔ System không reset map.
- Reverb disconnect hiển thị trạng thái, dữ liệu cuối vẫn còn.
- Reconnect tự resync.
- Không horizontal overflow tại 375 px.
- Dialog/select portal nằm trên z-index của map/dashboard.
