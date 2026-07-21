# Production Deployment

## 1. Build

```bash
cd /var/www/ntrip_caster
./ntrip_project.sh deploy
```

Script chạy optimized Composer install, npm build, migrations và Laravel caches.

## 2. Permissions

```bash
sudo chown -R deploy:www-data /var/www/ntrip_caster
sudo chown -R www-data:www-data \
  /var/www/ntrip_caster/storage \
  /var/www/ntrip_caster/bootstrap/cache \
  /var/www/ntrip_caster/database

sudo chmod -R ug+rwX \
  /var/www/ntrip_caster/storage \
  /var/www/ntrip_caster/bootstrap/cache \
  /var/www/ntrip_caster/database
```

## 3. Processes bắt buộc

- Nginx.
- PHP-FPM 8.3.
- Queue worker.
- Scheduler (`schedule:work` hoặc cron `schedule:run`).
- Reverb.
- NTRIP Caster.
- Observability Collector.

Mỗi process lâu dài cần `autorestart`, graceful stop và log riêng.

## 4. Supervisor command examples

```text
php artisan queue:work --queue=default,alerts --sleep=1 --tries=2 --timeout=30
php artisan schedule:work
php artisan reverb:start --host=127.0.0.1 --port=8080
php artisan ntrip:serve
php artisan ntrip:observe
```

## 5. Nginx

- Serve Laravel public directory.
- Proxy WebSocket path của Reverb với HTTP/1.1 Upgrade headers.
- TLS termination tại Nginx.
- Không proxy NTRIP TCP qua HTTP location; mở trực tiếp port 2101 hoặc dùng TCP stream proxy nếu có yêu cầu.

## 6. Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 2101/tcp
```

Giữ Reverb `8080` và observability UDP `22101` chỉ localhost/private network.

## 7. Deploy sequence an toàn

1. Backup database.
2. Pull release.
3. Enable maintenance mode nếu cần.
4. `./ntrip_project.sh deploy`.
5. Restart PHP-FPM/queue/scheduler/Reverb/Observer.
6. Gracefully restart Caster trong maintenance window vì sẽ ngắt Source/Rover TCP.
7. Kiểm tra health, ports và reconnect.
8. Disable maintenance mode.

## 8. SQLite scaling note

SQLite phù hợp bản thử nghiệm và tải vừa. Khi write concurrency hoặc retention data tăng, đánh giá chuyển sang MySQL/PostgreSQL; trước khi chuyển phải load test session, telemetry, alert và observability writes.
