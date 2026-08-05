<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

use App\Enums\Ntrip\AutoMountpointAction;

final readonly class AutoMountpointDecision
{
    public function __construct(
        public AutoMountpointAction $action,
        public ?AutoMountpointSelection $selection,
        public ?float $currentDistanceMeters,
        public string $reason,
    ) {}

    public function mountpointId(): ?int
    {
        return $this->selection?->candidate->mountpointId;
    }

    public function mountpointName(): ?string
    {
        return $this->selection?->candidate->mountpointName;
    }
}
