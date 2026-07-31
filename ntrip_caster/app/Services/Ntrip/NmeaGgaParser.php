<?php

namespace App\Services\Ntrip;

final class NmeaGgaParser
{
    /**
     * @return array{
     *     utc_time: string,
     *     latitude: ?float,
     *     longitude: ?float,
     *     altitude_m: ?float,
     *     geoid_separation_m: ?float,
     *     fix_quality: int,
     *     fix_type: string,
     *     satellites: int,
     *     hdop: float
     * }|null
     */
    public function parse(string $sentence): ?array
    {
        if (! preg_match(
            '/^\$(?<body>[A-Z]{2}GGA,[^*\r\n]*)\*(?<checksum>[0-9A-F]{2})$/i',
            trim($sentence),
            $matches,
        )) {
            return null;
        }

        $body = $matches['body'];

        if (! $this->checksumMatches(
            $body,
            $matches['checksum'],
        )) {
            return null;
        }

        $fields = explode(',', $body);

        if (count($fields) < 15) {
            return null;
        }

        $utcTime = $this->validUtc(
            $fields[1] ?? '',
        );

        $fixQuality = $this->unsignedInteger(
            $fields[6] ?? '',
        );

        $satellites = $this->unsignedInteger(
            $fields[7] ?? '',
        );

        $hdop = $this->nonNegativeFloat(
            $fields[8] ?? '',
        );

        if (
            $utcTime === null
            || $fixQuality === null
            || $satellites === null
            || $hdop === null
        ) {
            return null;
        }

        $latitudeRaw = $fields[2] ?? '';
        $latitudeHemisphere = $fields[3] ?? '';

        $longitudeRaw = $fields[4] ?? '';
        $longitudeHemisphere = $fields[5] ?? '';

        $hasLatitude = $latitudeRaw !== ''
            || $latitudeHemisphere !== '';

        $hasLongitude = $longitudeRaw !== ''
            || $longitudeHemisphere !== '';

        $latitude = $this->coordinate(
            $latitudeRaw,
            $latitudeHemisphere,
            true,
        );

        $longitude = $this->coordinate(
            $longitudeRaw,
            $longitudeHemisphere,
            false,
        );

        if (
            $hasLatitude !== $hasLongitude
            || ($hasLatitude && $latitude === null)
            || ($hasLongitude && $longitude === null)
            || ($fixQuality > 0 && ! $hasLatitude)
        ) {
            return null;
        }

        $altitudeRaw = $fields[9] ?? '';
        $geoidRaw = $fields[11] ?? '';

        $altitude = $this->optionalFloat(
            $altitudeRaw,
        );

        $geoidSeparation = $this->optionalFloat(
            $geoidRaw,
        );

        if (
            ($altitudeRaw !== '' && $altitude === null)
            || ($geoidRaw !== '' && $geoidSeparation === null)
            || (
                $altitude !== null
                && strtoupper($fields[10] ?? '') !== 'M'
            )
            || (
                $geoidSeparation !== null
                && strtoupper($fields[12] ?? '') !== 'M'
            )
        ) {
            return null;
        }

        return [
            'utc_time' => $utcTime,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'altitude_m' => $altitude,
            'geoid_separation_m' => $geoidSeparation,
            'fix_quality' => $fixQuality,
            'fix_type' => $this->fixType(
                $fixQuality,
            ),
            'satellites' => $satellites,
            'hdop' => $hdop,
        ];
    }

    private function checksumMatches(
        string $body,
        string $expected,
    ): bool {
        $checksum = 0;

        for (
            $index = 0, $length = strlen($body);
            $index < $length;
            $index++
        ) {
            $checksum ^= ord(
                $body[$index],
            );
        }

        return strtoupper($expected)
            === sprintf('%02X', $checksum);
    }

    private function validUtc(
        string $value,
    ): ?string {
        if (! preg_match(
            '/^(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})(?:\.\d+)?$/',
            $value,
            $matches,
        )) {
            return null;
        }

        if (
            (int) $matches['hour'] > 23
            || (int) $matches['minute'] > 59
            || (int) $matches['second'] > 60
        ) {
            return null;
        }

        return $value;
    }

    private function coordinate(
        string $raw,
        string $hemisphere,
        bool $latitude,
    ): ?float {
        if ($raw === '' && $hemisphere === '') {
            return null;
        }

        if (! is_numeric($raw)) {
            return null;
        }

        $value = (float) $raw;

        $degrees = (int) floor(
            $value / 100,
        );

        $minutes = $value
            - ($degrees * 100);

        $hemisphere = strtoupper(
            $hemisphere,
        );

        $allowed = $latitude
            ? ['N', 'S']
            : ['E', 'W'];

        if (
            $minutes < 0
            || $minutes >= 60
            || ! in_array(
                $hemisphere,
                $allowed,
                true,
            )
        ) {
            return null;
        }

        $coordinate = $degrees
            + ($minutes / 60);

        if (
            $hemisphere === 'S'
            || $hemisphere === 'W'
        ) {
            $coordinate *= -1;
        }

        $limit = $latitude
            ? 90
            : 180;

        if (
            ! is_finite($coordinate)
            || abs($coordinate) > $limit
        ) {
            return null;
        }

        return round(
            $coordinate,
            7,
        );
    }

    private function unsignedInteger(
        string $value,
    ): ?int {
        if (
            $value === ''
            || ! ctype_digit($value)
        ) {
            return null;
        }

        $number = (int) $value;

        return $number <= 255
            ? $number
            : null;
    }

    private function nonNegativeFloat(
        string $value,
    ): ?float {
        $number = $this->optionalFloat(
            $value,
        );

        return $number !== null
            && $number >= 0
                ? $number
                : null;
    }

    private function optionalFloat(
        string $value,
    ): ?float {
        if (
            $value === ''
            || ! is_numeric($value)
        ) {
            return null;
        }

        $number = (float) $value;

        return is_finite($number)
            ? $number
            : null;
    }

    private function fixType(
        int $fixQuality,
    ): string {
        return match ($fixQuality) {
            0 => 'no_fix',
            1 => 'gps_fix',
            2 => 'dgps',
            4 => 'rtk_fixed',
            5 => 'rtk_float',
            6 => 'estimated',
            default => 'unknown',
        };
    }
}
