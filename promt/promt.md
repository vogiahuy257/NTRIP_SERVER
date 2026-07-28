Bạn có


Dưới đây là **6 prompt độc lập**, dùng lần lượt để cải thiện hệ thống NTRIP theo đúng nội dung bài báo. Mỗi prompt đều yêu cầu kiểm tra code hiện tại trước, sửa tối thiểu và có automated test.

## Prompt 1 — Kiểm tra toàn bộ hệ thống và lập kế hoạch cải tiến

```text
Tôi đang phát triển hệ thống NTRIP Caster phục vụ UAV RTK gồm:

- Base: ZED-F9P kết nối ESP32, gửi RTCM3 đến NTRIP Caster.
- Server: Laravel 13, PHP 8.3, MySQL, Redis, Laravel Reverb, Queue Worker, Alert Engine và NTRIP Caster tự phát triển.
- Rover/UAV: Raspberry Pi 5 nhận RTCM từ Caster, gửi vào PX4 qua MAVLink.
- Frontend: React 19, TypeScript, Inertia, Tailwind và shadcn/ui.
- Các cảnh báo hiện có: STATION_OFFLINE, SOURCE_DISCONNECTED, RTCM_STREAM_STALLED và RTCM_CRC_ERRORS.
- Backend bắt buộc có automated test trong thư mục tests, không dùng Tinker. Các test backend phải chạy được bằng composer test:backend.

Mục tiêu cải tiến hệ thống theo bài báo là:

1. Theo dõi RTCM end-to-end từ base đến PX4.
2. Đánh giá chất lượng correction theo thời gian thực.
3. Phát hiện sớm nguy cơ mất RTK FIX.
4. Tự động phục hồi kết nối NTRIP.
5. Thu thập dữ liệu phục vụ thí nghiệm và viết bài báo.

Trước tiên chưa sửa code. Hãy:

1. Yêu cầu tôi đóng gói đúng các file cần thiết bằng một lệnh terminal duy nhất.
2. Sau khi tôi gửi file ZIP, đọc và đánh giá kiến trúc hiện tại.
3. Lập bảng đối chiếu:
   - Chức năng hiện có.
   - Chức năng còn thiếu.
   - File cần sửa.
   - Migration cần thêm.
   - API cần thêm.
   - Event/queue cần thêm.
   - Test cần viết.
4. Đề xuất thứ tự triển khai ít rủi ro nhất.
5. Không viết lại toàn bộ hệ thống và không thay đổi các chức năng đang hoạt động nếu không cần thiết.

Chỉ bắt đầu code sau khi tôi xác nhận kế hoạch.
```

## Prompt 2 — Xây dựng RTCM end-to-end tracing và metrics

```text
Tiếp tục cải thiện hệ thống NTRIP Caster của tôi theo bài báo.

Mục tiêu của bước này là xây dựng cơ chế theo dõi RTCM end-to-end:

ESP32 Base → NTRIP Caster → Raspberry Pi Rover → PX4.

Hệ thống hiện dùng Laravel 13, PHP 8.3, MySQL, Redis, Reverb và NTRIP Caster tự phát triển. Backend bắt buộc có automated test trong tests và chạy bằng composer test:backend. Không dùng Tinker.

Hãy thực hiện theo từng bước:

1. Kiểm tra code hiện tại trước khi sửa.
2. Thiết kế metadata cho mỗi RTCM frame mà không thay đổi payload RTCM:
   - station_id
   - mountpoint_id
   - message_type
   - frame_size
   - crc_valid
   - frame_hash
   - received_at
   - forwarded_at
   - sequence/epoch nếu có thể suy ra
3. Phân biệt rõ:
   - transport latency
   - stream gap
   - time since last valid RTCM
   - RTCM message completeness
4. Không lưu mỗi frame của từng rover vào database.
5. Chỉ lưu dữ liệu tổng hợp theo cửa sổ 1 giây hoặc 5 giây.
6. Raw RTCM chỉ ghi ra file khi bật chế độ experiment.
7. Xây dựng migration, model, service, event, queue và API cần thiết.
8. Viết automated test cho:
   - CRC hợp lệ và không hợp lệ
   - nhận diện message type
   - stream stalled
   - frame duplicate
   - tổng hợp metric theo cửa sổ
   - không tạo dữ liệu trùng cho nhiều rover nhận cùng một frame
9. Mỗi lần sửa phải cung cấp:
   - file cần sửa
   - nội dung code hoàn chỉnh
   - lệnh chạy test
   - kết quả mong đợi

Ưu tiên clean code, thay đổi ít nhất và không làm ảnh hưởng luồng NTRIP hiện tại.
```

## Prompt 3 — Xây dựng Correction Quality Monitor

```text
Tiếp tục bước tiếp theo của hệ thống NTRIP-UAV theo bài báo.

Dữ liệu RTCM và network metrics đã được thu thập. Bây giờ cần xây dựng Correction Quality Monitor để đánh giá sức khỏe correction stream theo thời gian thực.

Các chỉ số cần xem xét:

- RTCM CRC error rate
- valid frame rate
- required message completeness
- thời gian từ frame hợp lệ cuối cùng
- stream gap
- byte rate
- duplicate frame rate
- frozen/replayed stream
- reconnect count
- network latency và jitter
- PX4 fix_type
- eph, epv
- satellites_used
- rtcm_injection_rate
- rtcm_crc_failed
- rtcm_msg_used

Yêu cầu:

1. Trước tiên kiểm tra code hiện tại và tái sử dụng service, alert và event đang có.
2. Xây dựng bộ đánh giá rule-based trước, chưa dùng deep learning.
3. Phân loại trạng thái:
   - HEALTHY
   - WARNING
   - DEGRADED
4. Các threshold phải cấu hình được trong database hoặc config, không hard-code rải rác.
5. Required RTCM message set phải cấu hình theo từng mountpoint.
6. Không xem RTCM 4072 là bắt buộc cho mọi receiver.
7. Không gọi hệ thống này là formal GNSS integrity monitoring; dùng thuật ngữ Correction Quality Monitoring.
8. Tích hợp với Alert Engine hiện tại nhưng tránh tạo alert lặp liên tục.
9. Có debounce, recovery delay và tự resolve.
10. Viết automated test cho từng trạng thái và từng điều kiện chuyển trạng thái.
11. Cung cấp migration, service, DTO/contract, event, API và test theo từng bước.
12. Sau mỗi bước, cho lệnh composer test:backend để kiểm tra.

Không sửa frontend trong bước này.
```

## Prompt 4 — Xây dựng Adaptive Recovery State Machine

```text
Tiếp tục cải thiện hệ thống NTRIP Caster theo bài báo.

Correction Quality Monitor đã phân loại được HEALTHY, WARNING và DEGRADED. Bước này cần xây dựng Adaptive Recovery State Machine cho NTRIP Client trên Raspberry Pi và backend điều phối.

State machine yêu cầu:

HEALTHY → WARNING → DEGRADED → RECOVERING → HEALTHY.

Điều kiện DEGRADED có thể gồm:

- TCP vẫn connected nhưng RTCM không tiến triển.
- Không có frame hợp lệ trong thời gian quy định.
- CRC error tăng cao.
- Thiếu required RTCM message kéo dài.
- rtcm_msg_used báo không sử dụng.
- PX4 chuyển từ RTK FIX sang FLOAT.
- NTRIP source hoặc mountpoint mất kết nối.

Hành động phục hồi:

1. Ngừng chuyển frame stale hoặc CRC-invalid vào PX4.
2. Reset RTCM parser và MAVLink fragmentation state.
3. Đóng socket bị treo.
4. Reconnect có exponential backoff.
5. Chuyển mountpoint hoặc caster dự phòng nếu được cấu hình.
6. Chỉ quay lại HEALTHY khi RTCM ổn định và PX4 sử dụng correction trở lại.
7. Dùng hysteresis để tránh reconnect liên tục.
8. Ghi đầy đủ recovery event, nguyên nhân, thời gian bắt đầu và thời gian kết thúc.

Hãy:

- Kiểm tra code backend và Pi client hiện tại trước khi sửa.
- Ưu tiên sửa ít file nhất.
- Tách recovery policy khỏi network client.
- Không để backend trực tiếp điều khiển socket nếu Pi client có thể tự xử lý tại edge.
- Backend chỉ lưu policy, nhận telemetry và ghi nhận recovery event.
- Viết unit test cho state machine.
- Viết integration test cho reconnect, timeout, stale stream và recovery success.
- Không dùng sleep thật trong test; sử dụng fake clock hoặc mock timer.
- Mỗi bước cung cấp code hoàn chỉnh và lệnh chạy test.
```

## Prompt 5 — Tích hợp PX4 telemetry và dự đoán mất RTK FIX

```text
Tiếp tục hệ thống NTRIP-UAV theo bài báo.

Mục tiêu của bước này là lấy trạng thái GNSS/RTK từ PX4 trên Raspberry Pi, gửi về backend và xây dựng mô hình dự đoán nguy cơ mất RTK FIX.

Các trường cần lấy nếu PX4 cung cấp:

- fix_type
- eph
- epv
- satellites_used
- rtcm_injection_rate
- rtcm_crc_failed
- rtcm_msg_used
- jamming_state
- spoofing_state
- system_error
- timestamp

Yêu cầu:

1. Kiểm tra phiên bản PX4, MAVLink/MAVSDK và code Pi client hiện tại.
2. Chỉ sử dụng message thực sự tồn tại trong phiên bản PX4 của tôi.
3. Không tự giả định field nếu chưa xác minh trong code/generated MAVLink.
4. Gửi telemetry về backend theo chu kỳ hợp lý, không gửi quá dày.
5. Backend lưu dữ liệu tổng hợp phục vụ thí nghiệm.
6. Xây dựng nhãn:
   y(t)=1 nếu RTK FIX bị mất trong khoảng 1, 3 hoặc 5 giây tiếp theo.
7. Triển khai:
   - Rule-based detector làm baseline.
   - Logistic Regression làm mô hình chính nếu dữ liệu đủ.
8. Không dùng deep learning.
9. Chia dữ liệu theo experiment/run, không random split từng dòng gây data leakage.
10. Đánh giá:
   - precision
   - recall
   - F1-score
   - false-positive rate
   - AUROC
   - detection lead time
11. Nếu dữ liệu mất FIX quá ít, giữ rule-based detector làm giải pháp chính và nói rõ lý do.
12. Viết script xử lý dataset, train, evaluate và export model.
13. Viết test cho API telemetry, feature extraction và model inference.

Thực hiện từng bước, không sửa toàn bộ hệ thống cùng lúc.
```

## Prompt 6 — Xây dựng hệ thống thí nghiệm và xuất dữ liệu bài báo

```text
Hoàn thiện hệ thống NTRIP-UAV theo thiết kế bài báo.

Mục tiêu của bước này là xây dựng framework thí nghiệm thực tế, không phải simulation. Base ZED-F9P, ESP32, Raspberry Pi rover và PX4 đều là thiết bị thật; Azure VM chỉ chạy NTRIP Caster và backend.

Cần hỗ trợ ba cấu hình:

- B0: Standard NTRIP Client, chỉ reconnect khi socket lỗi.
- B1: Monitoring Only, có cảnh báo nhưng không tự phục hồi.
- P1: Quality-Aware Adaptive Recovery.

Các nhóm thí nghiệm:

1. Hoạt động mạng bình thường.
2. Tăng latency.
3. Tăng jitter.
4. Packet loss.
5. Complete outage.
6. TCP socket còn mở nhưng RTCM bị stalled.
7. CRC corruption.
8. Drop từng loại RTCM message.
9. Base restart.
10. Nhiều base và nhiều rover thật reconnect đồng thời.

Yêu cầu:

- Tạo experiment_id duy nhất cho mỗi lần chạy.
- Ghi metadata phần cứng, phần mềm, firmware, commit hash và cấu hình threshold.
- Đồng bộ thời gian giữa Azure VM, Raspberry Pi và thiết bị liên quan.
- Không dùng tc netem lên toàn bộ interface làm mất SSH.
- Fault injection phải tách riêng theo port, proxy hoặc network namespace.
- Raw RTCM chỉ ghi khi bật experiment mode.
- Xuất dữ liệu dưới dạng CSV hoặc Parquet.
- Tạo script tự động tính:
  - RTK FIX availability
  - detection time
  - recovery time
  - stale correction exposure
  - reconnect success rate
  - horizontal/vertical/3D RMSE
  - latency P50, P95, P99
  - CPU, RAM, network và database overhead
- Tạo file CSV tương ứng với toàn bộ bảng trống trong bài báo.
- Tạo script vẽ toàn bộ biểu đồ cần cho bài.
- Không điền dữ liệu giả.
- Viết automated test cho experiment lifecycle và data export.
- Cung cấp quy trình chạy một thí nghiệm hoàn chỉnh từ đầu đến cuối.
- Sau cùng review xem dữ liệu thu được đã đủ để trả lời các research question của bài báo chưa.
```

Thứ tự sử dụng: **Prompt 1 → 2 → 3 → 4 → 5 → 6**.
