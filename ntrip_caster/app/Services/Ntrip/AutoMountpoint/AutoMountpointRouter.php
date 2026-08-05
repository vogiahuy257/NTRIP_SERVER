<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

use App\Enums\Ntrip\AutoMountpointAction;
use InvalidArgumentException;

final readonly class AutoMountpointRouter
{
    public function __construct(
        private AutoMountpointSelector $selector,
    ) {}

    /**
     * @param  iterable<AutoMountpointCandidate>  $candidates
     */
    public function decide(
        float $roverLatitude,
        float $roverLongitude,
        ?int $currentMountpointId,
        iterable $candidates,
        float $serviceRadiusMeters,
    ): AutoMountpointDecision {
        if ($serviceRadiusMeters <= 0) {
            throw new InvalidArgumentException(
                'Service radius must be greater than zero.',
            );
        }

        $availableCandidates = is_array($candidates)
            ? array_values($candidates)
            : iterator_to_array($candidates, false);

        $currentCandidate = $this->findCandidate(
            candidates: $availableCandidates,
            mountpointId: $currentMountpointId,
        );

        $currentDistance = null;

        if ($currentCandidate !== null) {
            $currentDistance = $this->selector->distanceMeters(
                latitudeA: $roverLatitude,
                longitudeA: $roverLongitude,
                latitudeB: $currentCandidate->latitude,
                longitudeB: $currentCandidate->longitude,
            );

            if ($currentDistance <= $serviceRadiusMeters) {
                return new AutoMountpointDecision(
                    action: AutoMountpointAction::KEEP,
                    selection: new AutoMountpointSelection(
                        candidate: $currentCandidate,
                        distanceMeters: $currentDistance,
                    ),
                    currentDistanceMeters: $currentDistance,
                    reason: 'inside_service_radius',
                );
            }
        }

        $nearest = $this->selector->nearest(
            roverLatitude: $roverLatitude,
            roverLongitude: $roverLongitude,
            candidates: $availableCandidates,
            maximumDistanceMeters: $serviceRadiusMeters,
        );

        if ($nearest === null) {
            return new AutoMountpointDecision(
                action: AutoMountpointAction::WAIT,
                selection: null,
                currentDistanceMeters: $currentDistance,
                reason: $currentMountpointId !== null
                    && $currentCandidate === null
                        ? 'current_base_unavailable'
                        : 'no_available_base',
            );
        }

        if ($currentMountpointId === null) {
            return new AutoMountpointDecision(
                action: AutoMountpointAction::ASSIGN,
                selection: $nearest,
                currentDistanceMeters: null,
                reason: 'initial_assignment',
            );
        }

        return new AutoMountpointDecision(
            action: AutoMountpointAction::SWITCH,
            selection: $nearest,
            currentDistanceMeters: $currentDistance,
            reason: $currentCandidate === null
                ? 'current_base_unavailable'
                : 'outside_service_radius',
        );
    }

    /**
     * @param  list<AutoMountpointCandidate>  $candidates
     */
    private function findCandidate(
        array $candidates,
        ?int $mountpointId,
    ): ?AutoMountpointCandidate {
        if ($mountpointId === null) {
            return null;
        }

        foreach ($candidates as $candidate) {
            if ($candidate->mountpointId === $mountpointId) {
                return $candidate;
            }
        }

        return null;
    }
}
