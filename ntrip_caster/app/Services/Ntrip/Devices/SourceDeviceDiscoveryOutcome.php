<?php

namespace App\Services\Ntrip\Devices;

enum SourceDeviceDiscoveryOutcome: string
{
    /*
     * Source cũ không gửi X-Hardware-ID.
     */
    case LEGACY_SOURCE =
        'legacy_source';

    /*
     * ESP32 mới đã được phát hiện nhưng chưa được duyệt.
     */
    case DEVICE_PENDING =
        'device_pending';

    /*
     * Người dùng đã từ chối thiết bị.
     */
    case DEVICE_REJECTED =
        'device_rejected';

    /*
     * Backend đã duyệt hoặc từng provision thiết bị,
     * nhưng firmware đang chạy ở trạng thái bootstrap.
     */
    case PROVISIONING_REQUIRED =
        'provisioning_required';

    /*
     * Thiết bị báo đã nhận cấu hình runtime.
     * Caster được phép kiểm tra mountpoint và Source Token.
     */
    case READY_FOR_AUTHENTICATION =
        'ready_for_authentication';
}
