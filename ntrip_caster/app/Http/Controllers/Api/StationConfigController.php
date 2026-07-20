<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStationConfigRequest;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StationConfigController extends Controller
{
    public function show(Request $request, string $deviceId): JsonResponse
    {
        $station = Station::query()
            ->where('device_id', $deviceId)
            ->with([
                'config',
                'mountpoint',
            ])
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

        if (
            $station->config === null
            || $station->mountpoint === null
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Station configuration is incomplete.',
            ], 409);
        }

        $clientRevision = $request->integer('revision', 0);
        $serverRevision = $station->config->revision;

        $station->update([
            'last_seen_at' => now(),
            'last_ip' => $request->ip(),
        ]);

        if ($clientRevision >= $serverRevision) {
            return response()->json(null, 204);
        }

        return response()->json([
            'revision' => $serverRevision,
            'enabled' => $station->enabled,
            'caster_host' => $station->config->caster_host,
            'caster_port' => $station->config->caster_port,
            'mountpoint' => $station->mountpoint->name,
            'uart_baud' => $station->config->uart_baud,
            'telemetry_interval_ms' => $station->config->telemetry_interval_ms,
            'config_poll_interval_ms' => $station->config->config_poll_interval_ms,
            'max_rtcm_age_ms' => $station->config->max_rtcm_age_ms,
        ]);
    }

    public function update(UpdateStationConfigRequest $request, Station $station): JsonResponse
    {
        $station->load([
            'config',
            'mountpoint',
        ]);

        if (
            $station->config === null
            || $station->mountpoint === null
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Station configuration is incomplete.',
            ], 409);
        }

        $data = $request->validated();

        DB::transaction(function () use (
            $station,
            $data
        ): void {
            $configData = collect($data)
                ->except('mountpoint')
                ->all();

            if ($configData !== []) {
                $configData['revision'] =
                    $station->config->revision + 1;

                $station->config->update($configData);
            }

            if (array_key_exists('mountpoint', $data)) {
                $station->mountpoint->update([
                    'name' => $data['mountpoint'],
                ]);

                if ($configData === []) {
                    $station->config->increment('revision');
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Station configuration updated.',
            'data' => $station->fresh([
                'config',
                'mountpoint',
            ]),
        ]);
    }
}
