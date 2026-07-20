<?php

return [
    'enabled' => env(
        'ALERT_ENGINE_ENABLED',
        true,
    ),

    'rules' => [
        'station_offline' => [
            /*
             * Không nhận telemetry trong khoảng này
             * thì Station được xem là offline.
             */
            'after_seconds' => 30,

            /*
             * Station phải khỏe ổn định đủ lâu
             * trước khi Alert tự resolve.
             */
            'resolve_after_seconds' => 10,
        ],

        'source_disconnected' => [
            'open_after_seconds' => 10,
            'resolve_after_seconds' => 5,
        ],

        'rtcm_stream_stalled' => [
            'open_after_seconds' => 15,
            'resolve_after_seconds' => 5,

            /*
             * Dùng khi Station chưa có cấu hình
             * max_rtcm_age_ms riêng.
             */
            'max_age_ms' => 1500,
        ],

        'rtcm_crc_errors' => [
            /*
             * Có CRC mới thì mở Warning ngay.
             */
            'open_after_seconds' => 0,

            /*
             * Không xuất hiện lỗi mới trong 60 giây
             * thì tự resolve.
             */
            'resolve_after_seconds' => 60,
        ],
    ],
];
