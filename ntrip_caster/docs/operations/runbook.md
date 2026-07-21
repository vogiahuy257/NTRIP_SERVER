# Operations Runbook

## Kiểm tra hệ thống đang chạy

```bash
curl -fsS http://127.0.0.1:8000/up
curl -fsS http://127.0.0.1:8000/api/health
ss -lntp | grep -E '8000|8080|2101'
pgrep -af 'artisan (ntrip:serve|ntrip:observe|reverb:start|queue:work|schedule:work)'
```

## Kiểm tra Source/Rover active

```bash
sqlite3 database/database.sqlite "
SELECT connection_type, COUNT(*)
FROM ntrip_sessions
WHERE disconnected_at IS NULL
GROUP BY connection_type;
"
```

## Kiểm tra session gần nhất

```bash
sqlite3 database/database.sqlite "
SELECT id, connection_type, remote_ip, connected_at, disconnected_at,
       bytes_transferred, valid_rtcm_frames, rtcm_crc_errors,
       disconnect_reason
FROM ntrip_sessions
ORDER BY id DESC
LIMIT 20;
"
```

## Kiểm tra observability persistence

```bash
sqlite3 database/database.sqlite "
SELECT COUNT(*) AS detail_rows, MAX(sampled_at)
FROM rtcm_flow_samples;

SELECT COUNT(*) AS rollup_rows, MAX(bucket_started_at)
FROM rtcm_flow_rollups;
"
```

## Restart

- Queue/Reverb/Observer có thể restart độc lập; frontend tự resync.
- Restart Caster ngắt toàn bộ Source/Rover; thực hiện trong maintenance window.
- Sau restart Caster, xác nhận Station `source_connected` và session cũ đã kết thúc.

## Backup

```bash
mkdir -p backups
sqlite3 database/database.sqlite ".backup 'backups/ntrip-$(date +%F-%H%M%S).sqlite'"
```

## Khi có bottleneck

1. Mở `/system` và chọn Mountpoint.
2. Kiểm tra Realtime live/stale.
3. Source rate/freshness để loại trừ BASE.
4. Expected vs Queued để đánh giá Caster fan-out.
5. Queued vs Written, backlog và buffer age để đánh giá Rover.
6. Mở Rover details và đối chiếu Session ID.
7. Thu log và metrics trước khi restart.
