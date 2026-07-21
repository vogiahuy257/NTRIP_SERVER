<?php

namespace App\Services\Ntrip\Devices;

use App\Models\PendingDevice;
use App\Services\Devices\PendingDeviceService;
use LogicException;

final readonly class SourceDeviceDiscoveryService
{
    public function __construct(
        private SourceDeviceIdentityParser $identityParser,
        private PendingDeviceService $pendingDevices,
    ) {}

    /**
     * @param  array<string, string>  $headers
     */
    public function evaluate(
        array $headers,
        string $requestMountpoint,
        string $remoteIp,
    ): SourceDeviceDiscoveryDecision {
        /*
         * Source cũ không có X-Hardware-ID phải tiếp tục
         * hoạt động theo cơ chế cũ.
         */
        if (
            ! $this->identityParser->supports(
                $headers,
            )
        ) {
            return new SourceDeviceDiscoveryDecision(
                outcome: SourceDeviceDiscoveryOutcome::LEGACY_SOURCE,
            );
        }

        $identity = $this->identityParser->parse(
            headers: $headers,
            requestMountpoint: $requestMountpoint,
        );

        $result = $this->pendingDevices->discover(
            hardwareId: $identity->hardwareId,
            reportedDeviceId: $identity->deviceId,
            reportedMountpoint: $identity->mountpoint,
            reportedProvisioningState: $identity->provisioningState,
            firmwareVersion: $identity->firmwareVersion,
            remoteIp: $remoteIp,
        );

        $device = $result->device;

        $outcome = match ($device->status) {
            PendingDevice::STATUS_PENDING => SourceDeviceDiscoveryOutcome::DEVICE_PENDING,

            PendingDevice::STATUS_REJECTED => SourceDeviceDiscoveryOutcome::DEVICE_REJECTED,

            PendingDevice::STATUS_APPROVED,
            PendingDevice::STATUS_PROVISIONED => $this->approvedDeviceOutcome(
                $identity,
            ),

            default => throw new LogicException(
                sprintf(
                    'Unsupported pending device status [%s].',
                    $device->status,
                ),
            ),
        };

        return new SourceDeviceDiscoveryDecision(
            outcome: $outcome,
            identity: $identity,
            pendingDeviceId: $device->id,
        );
    }

    private function approvedDeviceOutcome(
        SourceDeviceIdentity $identity,
    ): SourceDeviceDiscoveryOutcome {
        /*
         * Thiết bị chỉ được đi tiếp tới kiểm tra Source Token
         * sau khi firmware xác nhận đã lưu provisioning config.
         */
        if (
            $identity->provisioningState
            === 'provisioned'
        ) {
            return SourceDeviceDiscoveryOutcome::READY_FOR_AUTHENTICATION;
        }

        return SourceDeviceDiscoveryOutcome::PROVISIONING_REQUIRED;
    }
}
