<?php

namespace App\Services\Devices;

use App\Models\PendingDevice;

final readonly class PendingDeviceDiscoveryResult
{
    public function __construct(
        public PendingDevice $device,

        /*
         * true khi hardware_id xuất hiện lần đầu
         * và một record mới vừa được tạo.
         */
        public bool $discovered,

        /*
         * true khi các thông tin có ý nghĩa thay đổi:
         * device_id, mountpoint, firmware, IP hoặc
         * provisioning state.
         *
         * last_seen_at và connection_attempts không
         * được xem là thay đổi có ý nghĩa để tránh
         * broadcast realtime liên tục.
         */
        public bool $changed,
    ) {}
}
