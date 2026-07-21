# Chuẩn bị môi trường

## Phạm vi hỗ trợ

Script `ntrip_project.sh` hiện nhắm đến Ubuntu Linux. Không chạy script bằng root nếu không cần; script tự sử dụng `sudo` cho package hệ thống.

## Cài tự động

```bash
chmod +x ntrip_project.sh
./ntrip_project.sh setup-env
./ntrip_project.sh check
```

Biến tùy chọn:

```bash
PHP_VERSION=8.3 NODE_MAJOR=22 ./ntrip_project.sh setup-env
```

## Thành phần được kiểm tra

```text
php composer node npm git curl unzip sqlite3
```

PHP extensions:

```text
bcmath ctype curl dom fileinfo filter hash intl json mbstring
openssl pcntl pdo pdo_sqlite session tokenizer xml zip
```

## Kiểm tra thủ công

```bash
php -v
php --ri pcntl
php -m | grep -E 'pdo_sqlite|pcntl|mbstring|intl'
composer --version
node --version
npm --version
sqlite3 --version
```

## Node.js và package manager

Dự án dùng npm và `package-lock.json`. Không trộn npm với pnpm/yarn trong cùng working tree. Nếu shadcn CLI nhận nhầm `pnpm` do `pnpm-workspace.yaml`, cài dependency bằng npm và lấy component registry bằng `shadcn view` thay vì tạo thêm lockfile mới.

## Quyền file local

User chạy Artisan cần ghi được vào:

```text
storage/
bootstrap/cache/
database/database.sqlite
database/
```
