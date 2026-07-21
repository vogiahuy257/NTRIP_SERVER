<?php

namespace App\Services\Ntrip\Devices;

final readonly class SourceDeviceIdentity
{
    public function __construct(
        public string $hardwareId,
        public ?string $deviceId,
        public ?string $mountpoint,
        public ?string $firmwareVersion,
        public string $provisioningState,
    ) {}
}
