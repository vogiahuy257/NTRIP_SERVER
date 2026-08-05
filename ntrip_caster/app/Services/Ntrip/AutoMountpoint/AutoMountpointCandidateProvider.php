<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

final class AutoMountpointCandidateProvider
{
    /**
     * @param  array<string, array<string, mixed>>  $catalog
     * @param  iterable<string>  $connectedMountpoints
     * @param  iterable<int>|null  $allowedMountpointIds
     * @return list<AutoMountpointCandidate>
     */
    public function fromRuntimeCatalog(
        array $catalog,
        iterable $connectedMountpoints,
        string $virtualMountpointName = 'AUTO',
        ?iterable $allowedMountpointIds = null,
    ): array {
        $connected = [];

        foreach ($connectedMountpoints as $name) {
            $connected[strtoupper($name)] = true;
        }

        $allowed = null;

        if ($allowedMountpointIds !== null) {
            $allowed = [];

            foreach ($allowedMountpointIds as $id) {
                $allowed[$id] = true;
            }
        }

        $candidates = [];

        foreach ($catalog as $entry) {
            $id = $this->positiveInteger(
                $entry['mountpoint_id'] ?? null,
            );

            $name = $entry['name'] ?? null;

            if (
                $id === null
                || ! is_string($name)
                || $name === ''
                || strcasecmp(
                    $name,
                    $virtualMountpointName,
                ) === 0
            ) {
                continue;
            }

            if (
                $allowed !== null
                && ! isset($allowed[$id])
            ) {
                continue;
            }

            if (
                ($entry['mountpoint_enabled'] ?? false) !== true
                || ($entry['station_enabled'] ?? false) !== true
                || ! isset($connected[strtoupper($name)])
            ) {
                continue;
            }

            $latitude = $this->coordinate(
                $entry['latitude'] ?? null,
                -90,
                90,
            );

            $longitude = $this->coordinate(
                $entry['longitude'] ?? null,
                -180,
                180,
            );

            if ($latitude === null || $longitude === null) {
                continue;
            }

            $candidates[] = new AutoMountpointCandidate(
                mountpointId: $id,
                mountpointName: $name,
                latitude: $latitude,
                longitude: $longitude,
            );
        }

        return $candidates;
    }

    private function positiveInteger(mixed $value): ?int
    {
        if (
            ! is_int($value)
            && ! (
                is_string($value)
                && ctype_digit($value)
            )
        ) {
            return null;
        }

        $integer = (int) $value;

        return $integer > 0 ? $integer : null;
    }

    private function coordinate(
        mixed $value,
        float $minimum,
        float $maximum,
    ): ?float {
        if (! is_numeric($value)) {
            return null;
        }

        $coordinate = (float) $value;

        if (
            ! is_finite($coordinate)
            || $coordinate < $minimum
            || $coordinate > $maximum
        ) {
            return null;
        }

        return $coordinate;
    }
}
