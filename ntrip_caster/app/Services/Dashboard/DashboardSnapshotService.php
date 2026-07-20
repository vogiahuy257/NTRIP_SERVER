<?php

namespace App\Services\Dashboard;

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\Station;
use Illuminate\Support\Collection;

final class DashboardSnapshotService
{
    /**
     * Tạo snapshot đầy đủ cho NTRIP Dashboard.
     *
     * @return array<string, mixed>
     */
    public function build(): array
    {
        $stations = Station::query()
            ->select([
                'id',
                'device_id',
                'name',
                'enabled',
                'source_connected',
                'last_seen_at',
                'last_ip',
                'firmware_version',
            ])
            ->with([
                'mountpoint:id,station_id,name,identifier,latitude,longitude,enabled,is_primary,access_mode,max_rover_connections',
                'telemetry:id,station_id,payload,received_at',
            ])
            ->orderBy('device_id')
            ->get();

        $mountpoints = Mountpoint::query()
            ->select([
                'id',
                'station_id',
                'name',
                'identifier',
                'format',
                'format_details',
                'nav_system',
                'latitude',
                'longitude',
                'country',
                'enabled',
                'is_primary',
                'access_mode',
                'max_rover_connections',
            ])
            ->with([
                'station:id,device_id,name,enabled,source_connected',
            ])
            ->orderBy('name')
            ->get();

        $activeSessions = NtripSession::query()
            ->active()
            ->select([
                'id',
                'mountpoint_id',
                'station_id',
                'rover_account_id',
                'connection_type',
                'authenticated_username',
                'client_agent',
                'ntrip_version',
                'remote_ip',
                'connected_at',
                'disconnected_at',
                'bytes_transferred',
                'valid_rtcm_frames',
                'rtcm_crc_errors',
                'rtcm_message_counts',
            ])
            ->with([
                'mountpoint:id,station_id,name',
                'mountpoint.station:id,device_id,name',
            ])
            ->latest('connected_at')
            ->get();

        $sourceSessionCount = $activeSessions
            ->where(
                'connection_type',
                NtripSession::TYPE_SOURCE,
            )
            ->count();

        $roverSessionCount = $activeSessions
            ->where(
                'connection_type',
                NtripSession::TYPE_ROVER,
            )
            ->count();

        /*
         * Trong giai đoạn chuyển đổi, một số Station có thể báo
         * source_connected nhưng Caster chưa tạo Source session.
         *
         * Vì vậy chỉ fallback sang source_connected khi chưa có
         * Source session nào.
         */
        $activeSourceCount = $sourceSessionCount > 0
            ? $sourceSessionCount
            : $stations
                ->where('source_connected', true)
                ->count();

        return [
            /*
             * Version của schema snapshot, không phải version dữ liệu.
             */
            'version' => 1,

            'generated_at' => now()->toIso8601String(),

            /*
             * Station chỉ chứa các field cần thiết cho Dashboard.
             * Không chứa source_token_hash.
             */
            'stations' => $stations
                ->map(
                    fn (Station $station): array => $this->stationPayload($station),
                )
                ->values()
                ->all(),

            /*
             * Danh sách toàn bộ Mountpoint.
             * Không chứa rover_password_hash.
             */
            'mountpoints' => $mountpoints
                ->map(
                    fn (Mountpoint $mountpoint): array => $this->mountpointPayload($mountpoint),
                )
                ->values()
                ->all(),

            /*
             * Chỉ trả về các session chưa disconnected.
             */
            'active_sessions' => $activeSessions
                ->map(
                    fn (NtripSession $session): array => $this->sessionPayload($session),
                )
                ->values()
                ->all(),

            'summary' => [
                'station_count' => $stations->count(),

                'enabled_stations' => $stations
                    ->where('enabled', true)
                    ->count(),

                'mountpoint_count' => $mountpoints->count(),

                'enabled_mountpoints' => $mountpoints
                    ->where('enabled', true)
                    ->count(),

                'active_sources' => $activeSourceCount,

                'active_rovers' => $roverSessionCount,

                'active_sessions' => $activeSessions->count(),

                'total_traffic_bps' => $this->sumTelemetryMetric(
                    $stations,
                    'rtcm.upload_bps',
                ),

                'total_crc_errors' => $this->sumTelemetryMetric(
                    $stations,
                    'rtcm.crc_errors',
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function stationPayload(
        Station $station,
    ): array {
        $mountpoint = $station->mountpoint;
        $telemetry = $station->telemetry;

        return [
            'id' => $station->id,
            'device_id' => $station->device_id,
            'name' => $station->name,
            'enabled' => $station->enabled,
            'source_connected' => $station->source_connected,

            'last_seen_at' => $station->last_seen_at?->toIso8601String(),

            'last_ip' => $station->last_ip,

            'firmware_version' => $station->firmware_version,

            'mountpoint' => $mountpoint === null
                ? null
                : [
                    'id' => $mountpoint->id,
                    'station_id' => $mountpoint->station_id,
                    'name' => $mountpoint->name,
                    'identifier' => $mountpoint->identifier,
                    'latitude' => $mountpoint->latitude,
                    'longitude' => $mountpoint->longitude,
                    'enabled' => $mountpoint->enabled,
                    'is_primary' => $mountpoint->is_primary,
                    'access_mode' => $mountpoint->access_mode,
                    'max_rover_connections' => $mountpoint->max_rover_connections,
                ],

            'telemetry' => $telemetry === null
                ? null
                : [
                    'payload' => $telemetry->payload,

                    'received_at' => $telemetry
                        ->received_at
                        ?->toIso8601String(),
                ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mountpointPayload(
        Mountpoint $mountpoint,
    ): array {
        $station = $mountpoint->station;

        return [
            'id' => $mountpoint->id,
            'station_id' => $mountpoint->station_id,
            'name' => $mountpoint->name,
            'identifier' => $mountpoint->identifier,
            'format' => $mountpoint->format,
            'format_details' => $mountpoint->format_details,
            'nav_system' => $mountpoint->nav_system,
            'latitude' => $mountpoint->latitude,
            'longitude' => $mountpoint->longitude,
            'country' => $mountpoint->country,
            'enabled' => $mountpoint->enabled,
            'is_primary' => $mountpoint->is_primary,
            'access_mode' => $mountpoint->access_mode,
            'max_rover_connections' => $mountpoint->max_rover_connections,

            'station' => $station === null
                ? null
                : [
                    'id' => $station->id,
                    'device_id' => $station->device_id,
                    'name' => $station->name,
                    'enabled' => $station->enabled,
                    'source_connected' => $station->source_connected,
                ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionPayload(
        NtripSession $session,
    ): array {
        $mountpoint = $session->mountpoint;
        $station = $mountpoint?->station;

        return [
            'id' => $session->id,
            'mountpoint_id' => $session->mountpoint_id,
            'station_id' => $session->station_id,
            'rover_account_id' => $session->rover_account_id,

            'connection_type' => $session->connection_type,

            'authenticated_username' => $session->authenticated_username,

            'client_agent' => $session->client_agent,
            'ntrip_version' => $session->ntrip_version,
            'remote_ip' => $session->remote_ip,

            'connected_at' => $session
                ->connected_at
                ?->toIso8601String(),

            'disconnected_at' => $session
                ->disconnected_at
                ?->toIso8601String(),

            'bytes_transferred' => $session->bytes_transferred,

            'valid_rtcm_frames' => $session->valid_rtcm_frames,

            'rtcm_crc_errors' => $session->rtcm_crc_errors,

            'rtcm_message_counts' => $session->rtcm_message_counts ?? [],

            'mountpoint' => $mountpoint === null
                ? null
                : [
                    'id' => $mountpoint->id,
                    'station_id' => $mountpoint->station_id,
                    'name' => $mountpoint->name,

                    'station' => $station === null
                        ? null
                        : [
                            'id' => $station->id,
                            'device_id' => $station->device_id,
                            'name' => $station->name,
                        ],
                ],
        ];
    }

    /**
     * @param  Collection<int, Station>  $stations
     */
    private function sumTelemetryMetric(
        Collection $stations,
        string $path,
    ): int {
        return (int) $stations->sum(
            function (
                Station $station,
            ) use ($path): int {
                $payload =
                    $station->telemetry?->payload ?? [];

                $value = data_get(
                    $payload,
                    $path,
                    0,
                );

                if (! is_numeric($value)) {
                    return 0;
                }

                return (int) round(
                    (float) $value,
                );
            },
        );
    }
}
