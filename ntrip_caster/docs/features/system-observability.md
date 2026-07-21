# Đặc tả: RTCM Flow Observability

## Mục tiêu

Quan sát định lượng toàn bộ đường truyền `BASE → Caster → Rover`, phát hiện bottleneck và xác định Rover cụ thể gây backlog.

## Kiến trúc

1. `RtcmFlowProbe` nằm trong Caster, thu counter/gauge nhưng không ghi database trực tiếp.
2. UDP transport gửi snapshot cộng dồn, versioned và multipart.
3. `ntrip:observe` nhận packet, assemble snapshot.
4. Realtime projector tính delta/bitrate giữa hai snapshot.
5. Latest snapshot lưu cache và broadcast Reverb mỗi giây.
6. Aggregator tạo sample 5 giây.
7. Maintenance rollup theo bucket 1 phút và retention.

## Metrics Mountpoint

- Source bytes/chunks, bitrate, freshness và max gap.
- Active Rovers.
- Expected, queued, written egress.
- Fan-out coverage = queued / expected.
- Socket drain ratio = written / expected.
- Fan-out count, avg/P95/max duration.
- Total backlog, maximum Rover buffer và buffer age.
- Partial writes, zero writes, failures.

## Metrics Rover

- Queued/written bytes và bitrate.
- Current/max buffer bytes.
- Current/max buffer age.
- Last successful write age.
- Partial/zero/failure write deltas.

## Persistence

| Dữ liệu | Chu kỳ | Retention mặc định |
|---|---:|---:|
| Latest snapshot | 1 giây | TTL 10 giây |
| `rtcm_flow_samples` | 5 giây | 24 giờ |
| `rtcm_flow_rollups` | 1 phút | 30 ngày |

Raw sample chỉ bị xóa sau khi đã rollup. Late sample chưa rollup có thể kích hoạt cập nhật lại bucket.

## API

```text
GET /api/v1/observability/rtcm-flow/snapshot
GET /api/v1/observability/rtcm-flow/history
```

History parameters:

```text
mountpoint_id     required
resolution        auto | detail | minute
from, to          ISO date/time
max_points        100..5000
```

`auto` chọn detail nếu khoảng ngắn và còn trong retention; ngược lại chọn minute. Response có effective range, retention clamp và downsample metadata.

## Realtime contract

Event `.rtcm.flow.snapshot.updated` trên private channel `ntrip.dashboard`, payload `{ snapshot: ... }`.

Frontend:

- Runtime normalizer snake_case → camelCase.
- Không cho API response cũ ghi đè WebSocket snapshot mới.
- Chấp nhận Caster restart khi process ID đổi và sequence reset.
- Phát hiện stale theo `max(5 s, 3 × interval)`.
- Hủy history request cũ khi filter đổi.

## Chẩn đoán beta

- BASE: disconnected, freshness quá cao, source bitrate zero.
- Caster: coverage thấp hoặc fan-out P95 cao.
- Rover: drain thấp, buffer age, zero writes, failures.

Ngưỡng khởi đầu:

- Coverage/drain healthy `>= 98%`.
- Warning `90%..98%`.
- Critical `< 90%`.
- Write failure luôn Critical.

## UI

- Bộ lọc Mountpoint, time range và resolution.
- Metric cards.
- Throughput chart.
- Coverage/drain, latency, backlog/buffer, socket event charts.
- Bottleneck diagnosis.
- Rover detail cards.
- Dấu hỏi mở chú thích tiếng Việt từ JSON `observability-help.vi.json`.

## Tiêu chí nghiệm thu

- Realtime update khoảng 1 giây khi Caster có snapshot.
- History hiển thị đúng Mountpoint/range.
- Observer/Reverb lỗi không làm Caster dừng.
- Dialog help mở trên Map Dashboard và dùng được bằng bàn phím.
- Rover có backlog được xếp trước Rover healthy.
- Field test xác nhận ngưỡng trước production.
