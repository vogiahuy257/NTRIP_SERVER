<?php

namespace App\Services\Ntrip\Devices;

final readonly class SourceDeviceDiscoveryDecision
{
    public function __construct(
        public SourceDeviceDiscoveryOutcome $outcome,
        public ?SourceDeviceIdentity $identity = null,
        public ?int $pendingDeviceId = null,
    ) {}

    public function shouldContinueAuthentication(): bool
    {
        return in_array(
            $this->outcome,
            [
                SourceDeviceDiscoveryOutcome::LEGACY_SOURCE,
                SourceDeviceDiscoveryOutcome::READY_FOR_AUTHENTICATION,
            ],
            true,
        );
    }

    public function isManagedDevice(): bool
    {
        return $this->outcome
            !== SourceDeviceDiscoveryOutcome::LEGACY_SOURCE;
    }
}
