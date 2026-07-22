<?php

namespace App\Actions\Stations;

use App\Models\Station;

final class UpdateMountpointPositionFromTelemetry
{
    /*
     * Chỉ nhận vị trí có sai số tối đa 10 mét.
     */
    private const MAXIMUM_ACCURACY_METERS = 10.0;

    /*
     * Tọa độ mới phải cách tọa độ đã lưu
     * trên 10 mét mới ghi lại database.
     */
    private const MINIMUM_POSITION_CHANGE_METERS = 10.0;

    private const EARTH_RADIUS_METERS = 6371000.0;

    /**
     * @param  array<string, mixed>  $telemetry
     */
    public function execute(
        Station $station,
        array $telemetry,
    ): bool {
        $survey = $telemetry['survey_in']
            ?? null;

        $position = $telemetry['position']
            ?? null;

        if (
            ! is_array($survey)
            || ! is_array($position)
        ) {
            return false;
        }

        /*
         * Chỉ dùng tọa độ sau khi Survey-In
         * đã hoàn tất và còn mới.
         */
        if (
            ($survey['seen'] ?? false) !== true
            || ($survey['fresh'] ?? false) !== true
            || ($survey['state'] ?? null) !== 'complete'
            || ($survey['active'] ?? true) !== false
            || ($survey['valid'] ?? false) !== true
        ) {
            return false;
        }

        if (
            ($position['available'] ?? false) !== true
            || ($position['fresh'] ?? false) !== true
            || ($position['source'] ?? null)
                !== 'ubx_nav_svin'
            || ($position['datum'] ?? null)
                !== 'WGS84'
        ) {
            return false;
        }

        $latitude = $position['latitude']
            ?? null;

        $longitude = $position['longitude']
            ?? null;

        $positionAccuracy =
            $position['accuracy_m']
            ?? null;

        $surveyAccuracy =
            $survey['mean_accuracy_m']
            ?? null;

        if (
            ! is_numeric($latitude)
            || ! is_numeric($longitude)
            || ! is_numeric($positionAccuracy)
            || ! is_numeric($surveyAccuracy)
        ) {
            return false;
        }

        $latitude = (float) $latitude;
        $longitude = (float) $longitude;

        $positionAccuracy =
            (float) $positionAccuracy;

        $surveyAccuracy =
            (float) $surveyAccuracy;

        if (
            $latitude < -90.0
            || $latitude > 90.0
            || $longitude < -180.0
            || $longitude > 180.0
        ) {
            return false;
        }

        if (
            $positionAccuracy
                > self::MAXIMUM_ACCURACY_METERS
            || $surveyAccuracy
                > self::MAXIMUM_ACCURACY_METERS
        ) {
            return false;
        }

        /*
         * Dùng trực tiếp relationship Primary Mountpoint
         * đã tồn tại trong Station.
         */
        $mountpoint =
            $station->mountpoint()->first();

        if ($mountpoint === null) {
            return false;
        }

        $currentLatitude =
            $mountpoint->latitude;

        $currentLongitude =
            $mountpoint->longitude;

        /*
         * Mountpoint chưa có tọa độ:
         * lưu lần đầu.
         */
        if (
            $currentLatitude !== null
            && $currentLongitude !== null
        ) {
            $distanceMeters =
                $this->distanceMeters(
                    latitudeFrom: (float) $currentLatitude,
                    longitudeFrom: (float) $currentLongitude,
                    latitudeTo: $latitude,
                    longitudeTo: $longitude,
                );

            /*
             * Sai lệch không quá 10 mét:
             * không ghi lại database.
             */
            if (
                $distanceMeters
                <= self::MINIMUM_POSITION_CHANGE_METERS
            ) {
                return false;
            }
        }

        return $mountpoint->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
        ]);
    }

    private function distanceMeters(
        float $latitudeFrom,
        float $longitudeFrom,
        float $latitudeTo,
        float $longitudeTo,
    ): float {
        $latitudeFromRadians =
            deg2rad($latitudeFrom);

        $latitudeToRadians =
            deg2rad($latitudeTo);

        $latitudeDelta =
            deg2rad(
                $latitudeTo
                - $latitudeFrom,
            );

        $longitudeDelta =
            deg2rad(
                $longitudeTo
                - $longitudeFrom,
            );

        $latitudeSin =
            sin($latitudeDelta / 2.0);

        $longitudeSin =
            sin($longitudeDelta / 2.0);

        $haversine =
            $latitudeSin * $latitudeSin
            + cos($latitudeFromRadians)
            * cos($latitudeToRadians)
            * $longitudeSin
            * $longitudeSin;

        $haversine = min(
            1.0,
            max(
                0.0,
                $haversine,
            ),
        );

        return 2.0
            * self::EARTH_RADIUS_METERS
            * atan2(
                sqrt($haversine),
                sqrt(1.0 - $haversine),
            );
    }
}
