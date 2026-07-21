# Realtime Events

## Channel authorization

```text
private-ntrip.dashboard
private-stations.{deviceId}
```

`ntrip.dashboard` hiện cho phép mọi user authenticated. Production nên thay bằng permission policy.

## Event list

| Domain | Event |
|---|---|
| Station | `StationTelemetryUpdated` |
| Session | `NtripSessionStarted` |
| Session | `NtripSessionUpdated` |
| Session | `NtripSessionEnded` |
| Device | `PendingDeviceDiscovered` |
| Device | `PendingDeviceUpdated` |
| Alert | `AlertOpened` |
| Alert | `AlertUpdated` |
| Alert | `AlertAcknowledged` |
| Alert | `AlertResolved` |
| Observability | `.rtcm.flow.snapshot.updated` |

Tên frontend có thể có dấu `.` khi dùng `broadcastAs()` để Echo không prepend namespace.

## Client strategy

1. Configure Echo một lần trong `app.tsx`.
2. Load HTTP snapshot đầu tiên.
3. Subscribe channel và áp dụng event reducer.
4. Track connection state.
5. Khi reconnect, gọi snapshot API.
6. Event/snapshot phải idempotent hoặc được so sánh sequence/timestamp.
7. Không xóa dữ liệu cuối khi WebSocket tạm mất.

## Payload compatibility

- Backend payload dùng snake_case.
- Frontend normalizer xác thực runtime.
- Field mới nên optional trong thời gian chuyển đổi.
- Breaking payload change cần version.
