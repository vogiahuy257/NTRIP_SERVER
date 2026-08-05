<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

final readonly class AutoMountpointSelection
{
    public function __construct(
        public AutoMountpointCandidate $candidate,
        public float $distanceMeters,
    ) {}
}
