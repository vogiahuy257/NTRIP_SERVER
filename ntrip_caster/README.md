# NTRIP Caster — Setup, Development, Test and Deployment

Project path used in this guide:

```bash
~/NTRIP/NTRIP_SERVER/ntrip_caster
```

The project contains Laravel, SQLite, Laravel Reverb, React/TypeScript and an NTRIP TCP caster on port `2101`.

## 1. One-time environment setup

```bash
chmod +x ntrip_project.sh
./ntrip_project.sh setup-env
./ntrip_project.sh check
```

The script installs or checks PHP 8.3, Composer, SQLite, Node.js, npm, Nginx, Supervisor and required PHP extensions, including PCNTL availability.

## 2. Project setup after clone or copy

```bash
cd ~/NTRIP/NTRIP_SERVER/ntrip_caster
./ntrip_project.sh setup-project
```

This performs:

```text
composer install
npm install
create database/database.sqlite if missing
php artisan key:generate when APP_KEY is empty
php artisan optimize:clear
php artisan migrate
npm run build
```

Required `.env` values:

```env
APP_NAME="NTRIP Caster"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=sqlite

BROADCAST_CONNECTION=reverb

REVERB_APP_ID=ntrip-local
REVERB_APP_KEY=ntrip-local-key
REVERB_APP_SECRET=ntrip-local-secret
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

NTRIP_HOST=0.0.0.0
NTRIP_PORT=2101
```

Install broadcasting only once if Reverb has not yet been configured:

```bash
php artisan install:broadcasting
npm install
```

## 3. Verify SQLite

```bash
php artisan db:show
sqlite3 database/database.sqlite ".tables"
php artisan migrate:status
```

Expected NTRIP tables:

```text
stations
station_configs
mountpoints
station_telemetries
ntrip_sessions
```

## 4. Local development runtime

Terminal 1 — Laravel and Vite:

```bash
cd ~/NTRIP/NTRIP_SERVER/ntrip_caster
composer run dev
```

Terminal 2 — Reverb:

```bash
cd ~/NTRIP/NTRIP_SERVER/ntrip_caster
php artisan reverb:start \
    --host=0.0.0.0 \
    --port=8080 \
    --debug
```

Terminal 3 — NTRIP caster:

```bash
cd ~/NTRIP/NTRIP_SERVER/ntrip_caster
php artisan ntrip:serve
```

Open:

```text
http://127.0.0.1:8000
```

Check ports:

```bash
ss -lntp | grep -E '8000|8080|2101'
```

## 5. Quick backend checks

```bash
curl http://127.0.0.1:8000/up
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/v1/system/status
curl http://127.0.0.1:8000/api/v1/ntrip/sessions/active
```

Sourcetable:

```bash
printf "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n" \
    | nc 127.0.0.1 2101
```

## 6. Graceful shutdown test

Start:

```bash
php artisan ntrip:serve
```

Press `Ctrl+C`. The caster should close Source and Rover sockets, store final statistics and set `source_connected` to false.

Test SIGTERM:

```bash
pgrep -af "artisan ntrip:serve"
kill -TERM <PID>
```

Inspect sessions:

```bash
sqlite3 database/database.sqlite "
SELECT
    id,
    connection_type,
    disconnected_at,
    bytes_transferred,
    valid_rtcm_frames,
    rtcm_crc_errors,
    disconnect_reason
FROM ntrip_sessions
ORDER BY id DESC
LIMIT 10;
"
```

## 7. Clear generated state

```bash
./ntrip_project.sh clear
```

This clears Laravel caches, `public/build` and temporary logs. It does not delete SQLite data.

Full database reset:

```bash
./ntrip_project.sh reset-db
```

This permanently deletes users, stations, mountpoints, telemetry and session history.

## 8. Production deployment

Use production `.env` values:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.example

DB_CONNECTION=sqlite
BROADCAST_CONNECTION=reverb

REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http

NTRIP_HOST=0.0.0.0
NTRIP_PORT=2101
```

Deploy:

```bash
./ntrip_project.sh deploy
```

The command runs production Composer install, frontend build, migrations and Laravel caches.

Set permissions:

```bash
sudo chown -R "$USER":www-data ~/NTRIP/NTRIP_SERVER/ntrip_caster

sudo chown -R www-data:www-data \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/storage \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/bootstrap/cache \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/database

sudo chmod -R ug+rwX \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/storage \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/bootstrap/cache \
    ~/NTRIP/NTRIP_SERVER/ntrip_caster/database
```

SQLite needs write permission for both `database/database.sqlite` and the `database/` directory because journal or WAL files may be created there.

## 9. Production processes

Do not use `composer run dev` in production.

Run these under Supervisor or systemd:

```bash
php artisan reverb:start --host=127.0.0.1 --port=8080
php artisan ntrip:serve
```

Nginx and PHP-FPM serve Laravel HTTP requests. Reverb and `ntrip:serve` are long-running processes.

## 10. Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 2101/tcp
```

Port `8080` should normally remain internal when Nginx proxies WebSocket traffic to Reverb.

## 11. Script commands

```bash
./ntrip_project.sh check
./ntrip_project.sh setup-env
./ntrip_project.sh setup-project
./ntrip_project.sh clear
./ntrip_project.sh reset-db
./ntrip_project.sh deploy
```