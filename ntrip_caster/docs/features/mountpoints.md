# Đặc tả: Mountpoint Management

## Mục tiêu

Định nghĩa các luồng RTCM mà Source publish và Rover subscribe.

## Thuộc tính chính

- `station_id`.
- `name`: duy nhất, tối đa 64, `[A-Za-z0-9_-]`.
- `identifier`, `format`, `format_details`, `nav_system`.
- `latitude`, `longitude`, `country`.
- `enabled`, `is_primary`.
- `access_mode`: public hoặc restricted theo schema hiện tại.

## Quy tắc

- Station mới có một primary Mountpoint.
- Mountpoint disabled không được nhận Source/Rover mới.
- Tên Mountpoint là khóa giao thức trong NTRIP request path.
- Vị trí phải nằm trong latitude `[-90,90]`, longitude `[-180,180]`.
- Country dùng mã 3 ký tự.

## API

- `GET /api/v1/mountpoints`
- `GET /api/v1/mountpoints/{mountpoint}`
- `PUT /api/v1/mountpoints/{mountpoint}`

## Sourcetable

Request tới root Caster trả sourcetable từ catalog Mountpoint enabled. Catalog được refresh định kỳ, mặc định 10 giây.

## Tiêu chí nghiệm thu

- Không cho phép tên trùng hoặc ký tự không hợp lệ.
- Update Mountpoint được phản ánh trong sourcetable sau chu kỳ refresh.
- Rover restricted chỉ truy cập khi có account và grant hợp lệ.
