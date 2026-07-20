<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStationRequest;
use App\Http\Requests\UpdateStationRequest;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class StationController extends Controller
{
    public function index(): JsonResponse
    {
        $stations = Station::query()
            ->with([
                'config',
                'mountpoint',
                'telemetry',
            ])
            ->orderBy('device_id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $stations,
        ]);
    }

    public function store(StoreStationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $station = DB::transaction(
            function () use ($data): Station {
                $station = Station::create([
                    'device_id' => $data['device_id'],
                    'name' => $data['name'],
                    'enabled' => $data['enabled'] ?? true,
                    'source_token_hash' => Hash::make(
                        $data['source_token']
                    ),
                ]);

                $station->config()->create([
                    'revision' => 1,
                    'caster_host' => $data['caster_host'],
                    'caster_port' => $data['caster_port'] ?? 2101,
                    'uart_baud' => $data['uart_baud'] ?? 115200,
                    'telemetry_interval_ms' => $data['telemetry_interval_ms'] ?? 2000,
                    'config_poll_interval_ms' => $data['config_poll_interval_ms'] ?? 30000,
                    'max_rtcm_age_ms' => $data['max_rtcm_age_ms'] ?? 1500,
                ]);

                $station->mountpoint()->create([
                    'name' => $data['mountpoint'],
                    'identifier' => $station->name,
                ]);

                return $station->load([
                    'config',
                    'mountpoint',
                ]);
            }
        );

        return response()->json([
            'success' => true,
            'message' => 'Station created successfully.',
            'source_token' => $data['source_token'],
            'data' => $station,
        ], 201);
    }

    public function show(Station $station): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $station->load([
                'config',
                'mountpoint',
                'telemetry',
            ]),
        ]);
    }

    public function update(UpdateStationRequest $request, Station $station): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('source_token', $data)) {
            $data['source_token_hash'] = Hash::make(
                $data['source_token']
            );

            unset($data['source_token']);
        }

        $station->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Station updated successfully.',
            'data' => $station->fresh([
                'config',
                'mountpoint',
                'telemetry',
            ]),
        ]);
    }

    public function destroy(Station $station): JsonResponse
    {
        $station->delete();

        return response()->json([
            'success' => true,
            'message' => 'Station deleted successfully.',
        ]);
    }
}
