<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

use InvalidArgumentException;

final class AutoMountpointSelector
{
    private const EARTH_RADIUS_METERS = 6_371_008.8;

    /**
     * @param  iterable<AutoMountpointCandidate>  $candidates
     */
    public function nearest(
        float $roverLatitude,
        float $roverLongitude,
        iterable $candidates,
        float $maximumDistanceMeters,
    ): ?AutoMountpointSelection {
        if ($maximumDistanceMeters <= 0) {
            throw new InvalidArgumentException(
                'Maximum distance must be greater than zero.',
            );
        }

        $nearest = null;

        foreach ($candidates as $candidate) {
            $distanceMeters = $this->distanceMeters(
                latitudeA: $roverLatitude,
                longitudeA: $roverLongitude,
                latitudeB: $candidate->latitude,
                longitudeB: $candidate->longitude,
            );

            if ($distanceMeters > $maximumDistanceMeters) {
                continue;
            }

            if (
                $nearest === null ||
                $distanceMeters < $nearest->distanceMeters
            ) {
                $nearest = new AutoMountpointSelection(
                    candidate: $candidate,
                    distanceMeters: $distanceMeters,
                );
            }
        }

        return $nearest;
    }

    public function distanceMeters(
        float $latitudeA,
        float $longitudeA,
        float $latitudeB,
        float $longitudeB,
    ): float {
        $latitudeARadians = deg2rad($latitudeA);
        $latitudeBRadians = deg2rad($latitudeB);

        $latitudeDelta = deg2rad($latitudeB - $latitudeA);
        $longitudeDelta = deg2rad($longitudeB - $longitudeA);

        $haversine =
            sin($latitudeDelta / 2) ** 2 +
            cos($latitudeARadians) *
            cos($latitudeBRadians) *
            sin($longitudeDelta / 2) ** 2;

        $haversine = min(1.0, max(0.0, $haversine));

        return 2
            * self::EARTH_RADIUS_METERS
            * asin(sqrt($haversine));
    }
}
