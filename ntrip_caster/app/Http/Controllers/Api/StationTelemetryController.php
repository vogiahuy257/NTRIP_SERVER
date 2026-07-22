<?php

namespace App\Http\Controllers\Api;

use App\Actions\Stations\UpdateMountpointPositionFromTelemetry;
use App\Events\StationTelemetryUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStationTelemetryRequest;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class StationTelemetryController extends Controller
{
    public function __construct(
        private readonly UpdateMountpointPositionFromTelemetry $updateMountpointPosition,
    ) {}

    public function store(
        StoreStationTelemetryRequest $request,
        string $deviceId,
    ): JsonResponse {
        $station = Station::query()
            ->where('device_id', $deviceId)
            ->first();

        if ($station === null) {
            return response()->json([
                'success' => false,
                'message' => 'Station not found.',
            ], 404);
        }

        if (! $station->enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Station is disabled.',
            ], 403);
        }

        $stationToken =
            $request->header(
                'X-Station-Token',
            );

        if (
            ! is_string($stationToken)
            || $stationToken === ''
            || ! Hash::check(
                $stationToken,
                $station->source_token_hash,
            )
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid station token.',
            ], 401);
        }

        $telemetry =
            $request->validated();

        $receivedAt = now();
        $remoteIp = $request->ip();

        DB::transaction(function () use (
            $station,
            $telemetry,
            $receivedAt,
            $remoteIp,
        ): void {
            /*
             * Giữ nguyên logic cập nhật Station
             * hiện tại.
             */
            $station->update([
                'last_seen_at' => $receivedAt,

                'last_ip' => $remoteIp,

                'firmware_version' => $telemetry[
                        'firmware_version'
                    ]
                    ?? $station
                        ->firmware_version,

                'source_connected' => $telemetry[
                        'source_connected'
                    ]
                    ?? $station
                        ->source_connected,
            ]);

            /*
             * Giữ duy nhất telemetry mới nhất
             * của mỗi Station.
             */
            $station->telemetry()
                ->updateOrCreate(
                    [
                        'station_id' => $station->id,
                    ],
                    [
                        'payload' => $telemetry,

                        'received_at' => $receivedAt,
                    ],
                );

            /*
             * Chỉ Action này chịu trách nhiệm
             * đồng bộ tọa độ sang Mountpoint.
             */
            $this
                ->updateMountpointPosition
                ->execute(
                    station: $station,
                    telemetry: $telemetry,
                );
        });

        /*
         * Broadcast sau khi transaction đã commit.
         */
        $station->refresh();

        broadcast(
            new StationTelemetryUpdated(
                station: $station,
                telemetry: $telemetry,
                receivedAt: $receivedAt
                    ->toIso8601String(),
            ),
        );

        /*
         * Giữ nguyên response contract hiện tại.
         */
        return response()->json([
            'success' => true,
            'message' => 'Telemetry accepted.',
            'received_at' => $receivedAt
                ->toIso8601String(),
        ], 202);
    }
}
