<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

final readonly class AutoMountpointCandidate
{
    public function __construct(
        public int $mountpointId,
        public string $mountpointName,
        public float $latitude,
        public float $longitude,
    ) {}
}
