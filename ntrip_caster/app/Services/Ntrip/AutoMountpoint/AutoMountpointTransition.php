<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

final readonly class AutoMountpointTransition
{
    public function __construct(
        public bool $apply,
        public ?int $outsideSince,
    ) {}
}
