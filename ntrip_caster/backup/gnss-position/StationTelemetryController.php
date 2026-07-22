<?php

namespace App\Http\Controllers\Api;

use App\Events\StationTelemetryUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStationTelemetryRequest;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

class StationTelemetryController extends Controller
{
    public function store(
        StoreStationTelemetryRequest $request,
        string $deviceId,
    ): JsonResponse|Response {
        $station = Station::query()
            ->where(
                'device_id',
                $deviceId,
            )
            ->first();

        if ($station === null) {
            return response()->json([
                'success' => false,
                'message' => 'Station not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $station->enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Station is disabled.',
            ], Response::HTTP_FORBIDDEN);
        }

        $stationToken = $request->header(
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
            ], Response::HTTP_UNAUTHORIZED);
        }

        $telemetry = $request->validated();
        $receivedAt = now();

        $station->update([
            'last_seen_at' => $receivedAt,
            'last_ip' => $request->ip(),

            'firmware_version' => $telemetry['firmware_version']
                ?? $station->firmware_version,

            'source_connected' => $telemetry['source_connected']
                ?? $station->source_connected,
        ]);

        $station->telemetry()->updateOrCreate(
            [
                'station_id' => $station->id,
            ],
            [
                'payload' => $telemetry,
                'received_at' => $receivedAt,
            ],
        );

        $station->refresh();

        broadcast(
            new StationTelemetryUpdated(
                station: $station,
                telemetry: $telemetry,

                receivedAt: $receivedAt->toIso8601String(),
            ),
        );

        return $this->noContentResponse();
    }

    private function noContentResponse(): Response
    {
        $response = response(
            content: '',
            status: Response::HTTP_NO_CONTENT,
        );

        /*
         * Telemetry không cần response body.
         * ESP-IDF có thể kết thúc request ngay khi nhận 204.
         */
        $response->headers->set(
            'Content-Length',
            '0',
        );

        $response->headers->set(
            'Connection',
            'close',
        );

        $response->headers->remove(
            'Transfer-Encoding',
        );

        return $response;
    }
}
