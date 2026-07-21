<?php

return [
    /*
    |--------------------------------------------------------------------------
    | TCP listener
    |--------------------------------------------------------------------------
    */

    'host' => env('NTRIP_HOST', '0.0.0.0'),

    'port' => (int) env('NTRIP_PORT', 2101),

    /*
    |--------------------------------------------------------------------------
    | Socket handling
    |--------------------------------------------------------------------------
    */

    'read_chunk_bytes' => 4096,

    'max_header_bytes' => 8192,

    'select_timeout_microseconds' => 200000,

    'header_timeout_seconds' => 15,

    'source_idle_timeout_seconds' => 30,

    /*
    |--------------------------------------------------------------------------
    | Database catalog
    |--------------------------------------------------------------------------
    */

    'catalog_refresh_seconds' => 10,

    /*
    |--------------------------------------------------------------------------
    | Output buffering
    |--------------------------------------------------------------------------
    */

    'max_client_buffer_bytes' => 262144,

    /*
    |--------------------------------------------------------------------------
    | Statistics
    |--------------------------------------------------------------------------
    */

    'stats_flush_seconds' => 15,

    'public_host' => env(
        'NTRIP_PUBLIC_HOST',
        '127.0.0.1',
    ),

    'management_port' => (int) env(
        'NTRIP_MANAGEMENT_PORT',
        8000,
    ),

    'provisioning_key' => env(
        'NTRIP_PROVISIONING_KEY',
        '',
    ),

    'observability' => [

        'history' => [
            /*
            * Khi không truyền from/to, API trả về
            * một giờ dữ liệu gần nhất.
            */
            'default_window_minutes' => (int) env(
                'NTRIP_OBSERVABILITY_HISTORY_DEFAULT_MINUTES',
                60,
            ),

            /*
            * resolution=auto chỉ dùng raw detail nếu
            * khoảng truy vấn không dài quá hai giờ.
            */
            'auto_detail_max_minutes' => (int) env(
                'NTRIP_OBSERVABILITY_AUTO_DETAIL_MAX_MINUTES',
                120,
            ),

            /*
            * Số điểm mặc định trả về cho biểu đồ.
            */
            'default_max_points' => (int) env(
                'NTRIP_OBSERVABILITY_HISTORY_DEFAULT_POINTS',
                1500,
            ),

            /*
            * Giới hạn cứng để bảo vệ API.
            */
            'maximum_points' => (int) env(
                'NTRIP_OBSERVABILITY_HISTORY_MAX_POINTS',
                5000,
            ),
        ],

        'latest_snapshot' => [
            /*
            * Dùng file cache để không ghi database mỗi giây.
            * Sau này có thể đổi thành redis mà không sửa service.
            */
            'cache_store' => env(
                'NTRIP_OBSERVABILITY_LATEST_CACHE_STORE',
                'file',
            ),

            /*
            * Snapshot được phát mỗi giây.
            * Quá thời gian này thì API xem như không còn dữ liệu realtime.
            */
            'ttl_seconds' => (int) env(
                'NTRIP_OBSERVABILITY_LATEST_TTL_SECONDS',
                10,
            ),
        ],

        'maintenance' => [
            /*
            * Chờ thêm trước khi tổng hợp một bucket đã kết thúc,
            * tránh trường hợp sample cuối đến chậm.
            */
            'rollup_delay_seconds' => (int) env(
                'NTRIP_OBSERVABILITY_ROLLUP_DELAY_SECONDS',
                30,
            ),

            /*
            * Giới hạn công việc mỗi lần scheduler chạy,
            * tránh giữ SQLite quá lâu.
            */
            'max_buckets_per_run' => (int) env(
                'NTRIP_OBSERVABILITY_MAX_BUCKETS_PER_RUN',
                120,
            ),

            /*
            * Số bản ghi xóa trong mỗi batch.
            */
            'delete_batch_size' => (int) env(
                'NTRIP_OBSERVABILITY_DELETE_BATCH_SIZE',
                1000,
            ),
        ],
        /*
        * Tắt hoàn toàn probe bằng false.
        */
        'enabled' => env(
            'NTRIP_OBSERVABILITY_ENABLED',
            true,
        ),

        /*
        * Hiện tại dùng UDP.
        * Có thể thay driver sau mà không sửa NtripCaster.
        */
        'driver' => env(
            'NTRIP_OBSERVABILITY_DRIVER',
            'udp',
        ),

        /*
        * Caster phát snapshot cộng dồn mỗi giây.
        */
        'snapshot_interval_ms' => (int) env(
            'NTRIP_OBSERVABILITY_SNAPSHOT_MS',
            1000,
        ),

        /*
        * Collector chạy riêng trên cùng máy trong giai đoạn đầu.
        */
        'udp' => [
            'host' => env(
                'NTRIP_OBSERVABILITY_HOST',
                '127.0.0.1',
            ),

            'port' => (int) env(
                'NTRIP_OBSERVABILITY_PORT',
                22101,
            ),

            /*
            * Giữ dưới giới hạn datagram UDP.
            */
            'max_packet_bytes' => 60000,
        ],

        'collector' => [
            /*
            * Collector lắng nghe trên localhost trong
            * giai đoạn chạy cùng máy với Caster.
            *
            * Sau này có thể đổi thành 0.0.0.0 khi
            * tách Collector sang máy chủ riêng.
            */
            'bind_host' => env(
                'NTRIP_OBSERVABILITY_BIND_HOST',
                '127.0.0.1',
            ),

            /*
            * Dùng cùng port với UDP transport.
            */
            'receive_buffer_bytes' => 65535,

            /*
            * Khoảng thời gian chờ datagram trong mỗi
            * vòng lặp của ntrip:observe.
            */
            'select_timeout_microseconds' => 200000,

            /*
            * Các packet multipart chưa hoàn chỉnh sẽ
            * bị loại sau khoảng thời gian này.
            */
            'assembly_timeout_seconds' => 5,
        ],
        /*
        * Chia nhỏ payload để sau này hỗ trợ nhiều
        * mountpoint và nhiều Rover.
        */
        'mountpoints_per_packet' => 100,
        'rovers_per_packet' => 100,

        /*
        * Số mẫu latency tối đa giữ trong một chu kỳ.
        */
        'max_latency_samples_per_interval' => 2048,

        /*
        * Collector sẽ sử dụng ở bước persistence.
        */
        'database_sample_seconds' => 5,
        'detail_retention_hours' => 24,
        'rollup_retention_days' => 30,
    ],
];
