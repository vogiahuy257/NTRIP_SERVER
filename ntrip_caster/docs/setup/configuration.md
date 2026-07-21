# Cấu hình hệ thống

## 1. Laravel

| Biến | Mô tả | Local |
|---|---|---|
| `APP_ENV` | Môi trường | `local` |
| `APP_DEBUG` | Debug page | `true` |
| `APP_URL` | URL quản trị | `http://127.0.0.1:8000` |
| `DB_CONNECTION` | Database driver | `sqlite` |
| `QUEUE_CONNECTION` | Queue driver | `database` |
| `CACHE_STORE` | Cache store | `file` |

## 2. Reverb

| Biến | Mô tả |
|---|---|
| `BROADCAST_CONNECTION` | Phải là `reverb` |
| `REVERB_APP_ID/KEY/SECRET` | Application credentials |
| `REVERB_HOST/PORT/SCHEME` | Backend Reverb endpoint |
| `VITE_REVERB_*` | Endpoint được browser sử dụng |

Khi browser chạy trên máy khác, `VITE_REVERB_HOST=127.0.0.1` sẽ trỏ về chính máy client. Trong LAN dùng IP/domain của server; production nên proxy WebSocket qua Nginx/HTTPS.

## 3. NTRIP Caster

| Key | Mặc định | Ý nghĩa |
|---|---:|---|
| `NTRIP_HOST` | `0.0.0.0` | Bind TCP listener |
| `NTRIP_PORT` | `2101` | NTRIP TCP port |
| `NTRIP_PUBLIC_HOST` | `127.0.0.1` | Host trả về thiết bị/client |
| `NTRIP_MANAGEMENT_PORT` | `8000` | HTTP management port |
| `NTRIP_PROVISIONING_KEY` | rỗng | Secret cho provisioning API |

Các giới hạn trong `config/ntrip.php`:

- `read_chunk_bytes = 4096`.
- `max_header_bytes = 8192`.
- `header_timeout_seconds = 15`.
- `source_idle_timeout_seconds = 30`.
- `catalog_refresh_seconds = 10`.
- `max_client_buffer_bytes = 262144`.
- `stats_flush_seconds = 15`.

## 4. Observability

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `NTRIP_OBSERVABILITY_ENABLED` | `true` | Bật probe |
| `NTRIP_OBSERVABILITY_DRIVER` | `udp` | Transport |
| `NTRIP_OBSERVABILITY_SNAPSHOT_MS` | `1000` | Chu kỳ snapshot |
| `NTRIP_OBSERVABILITY_HOST` | `127.0.0.1` | UDP destination |
| `NTRIP_OBSERVABILITY_PORT` | `22101` | UDP port |
| `NTRIP_OBSERVABILITY_BIND_HOST` | `127.0.0.1` | Collector bind address |
| `NTRIP_OBSERVABILITY_LATEST_CACHE_STORE` | `file` | Latest snapshot store |
| `NTRIP_OBSERVABILITY_LATEST_TTL_SECONDS` | `10` | Snapshot TTL |

Cấu hình mặc định bổ sung:

- `database_sample_seconds = 5`.
- `detail_retention_hours = 24`.
- `rollup_retention_days = 30`.
- `mountpoints_per_packet = 100`.
- `rovers_per_packet = 100`.
- `rollup_delay_seconds = 30`.
- `max_buckets_per_run = 120`.
- `delete_batch_size = 1000`.
- History default window 60 phút; auto-detail tối đa 120 phút; tối đa 5000 điểm.

## 5. Production checklist

- `APP_ENV=production`.
- `APP_DEBUG=false`.
- Secret ngẫu nhiên, không dùng giá trị local.
- HTTPS cho dashboard và WebSocket.
- `NTRIP_OBSERVABILITY_BIND_HOST=127.0.0.1` nếu Observer cùng máy.
- Không công khai port `8080` và `22101` khi không cần.
- Sau thay đổi biến `VITE_*`, phải build lại frontend.
