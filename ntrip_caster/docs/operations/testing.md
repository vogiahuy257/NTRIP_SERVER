# Testing & Quality Gates

## Backend

```bash
composer lint:check
composer types:check
composer test:backend
```

Toàn bộ:

```bash
composer test
```

## Frontend

```bash
npm run format:check
npm run lint:check
npm run types:check
npm run build
```

## Kiểm tra route

```bash
php artisan route:list --path=api/v1
php artisan route:list --path=observability
```

## Test NTRIP protocol

Sourcetable:

```bash
printf "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n" \
  | nc 127.0.0.1 2101
```

Graceful shutdown:

```bash
php artisan ntrip:serve
# Ctrl+C
```

SIGTERM:

```bash
pgrep -af 'artisan ntrip:serve'
kill -TERM <PID>
```

## Test matrix beta

### Source

- Valid legacy Source.
- New hardware pending/approved/provisioned.
- Invalid token.
- Duplicate Source.
- Idle timeout.
- CRC errors.

### Rover

- Public Mountpoint.
- Restricted Mountpoint valid/invalid credentials.
- Account disabled/expired.
- Connection limit.
- Slow reader and stopped reader.

### Realtime

- Reverb disconnect/reconnect.
- Lost event and snapshot resync.
- Caster restart/sequence reset.

### Observability

- Snapshot 1 giây.
- Sample 5 giây.
- Rollup 1 phút.
- Late sample reroll.
- Retention không xóa unrolled sample.
- History auto/detail/minute và downsampling.

### Responsive

```text
375×667
390×844
768×1024
1366×768
1920×1080
```

## Tiêu chí release beta

- Backend test pass.
- PHPStan/Pint pass.
- ESLint/Prettier/TypeScript/build pass.
- Không có console error ở Dashboard/System.
- Field test BASE → Caster → Rover thành công.
