# Local development

## Chạy toàn bộ stack

```bash
composer dev
```

`Ctrl+C` gửi SIGINT đến các process con. Các dòng `exited with code SIGINT` là shutdown bình thường.

## Chạy riêng để debug

```bash
php artisan serve --host=0.0.0.0 --port=8000
npm run dev -- --host=0.0.0.0 --port=5173
php artisan ntrip:serve
php artisan ntrip:observe
php artisan reverb:start --host=0.0.0.0 --port=8080 --debug
php artisan queue:listen --queue=default,alerts --tries=2 --timeout=30
php artisan schedule:work
php artisan pail --timeout=0
```

## Kiểm tra port

```bash
ss -lntp | grep -E '8000|5173|8080|2101|22101'
```

## Database local

```bash
php artisan db:show
php artisan migrate:status
sqlite3 database/database.sqlite '.tables'
```

## Xóa generated state

```bash
./ntrip_project.sh clear
```

Không xóa database. Reset toàn bộ dữ liệu:

```bash
./ntrip_project.sh reset-db
```

Lệnh reset yêu cầu nhập chính xác `RESET`.

## Quy tắc development

- Backend: chạy Pint và PHPStan trước khi commit.
- Frontend: không lưu derived state bằng Effect nếu có thể tính trong render/useMemo.
- Effect chỉ dùng cho network, WebSocket, timer hoặc external system và phải cleanup.
- Không mở Echo connection riêng cho từng page; dùng connection đã configure toàn ứng dụng.
- API response phải qua runtime normalizer trước khi vào UI observability.
- Không hard-code secret hoặc token trong fixtures được commit.
