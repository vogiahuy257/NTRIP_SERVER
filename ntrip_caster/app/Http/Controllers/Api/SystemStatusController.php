<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\Station;
use Illuminate\Http\JsonResponse;

class SystemStatusController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $activeSources = NtripSession::query()
            ->where('connection_type', 'source')
            ->whereNull('disconnected_at')
            ->count();

        $activeRovers = NtripSession::query()
            ->where('connection_type', 'rover')
            ->whereNull('disconnected_at')
            ->count();

        $sourceBytes = NtripSession::query()
            ->where('connection_type', 'source')
            ->sum('bytes_transferred');

        $roverBytes = NtripSession::query()
            ->where('connection_type', 'rover')
            ->sum('bytes_transferred');

        return response()->json([
            'success' => true,

            'service' => [
                'name' => 'NTRIP Caster Backend',
                'time' => now()->toIso8601String(),
            ],

            'caster' => [
                'host' => config('ntrip.host'),
                'port' => config('ntrip.port'),
            ],

            'stations' => [
                'total' => Station::query()->count(),

                'enabled' => Station::query()
                    ->where('enabled', true)
                    ->count(),

                'source_connected' => Station::query()
                    ->where('source_connected', true)
                    ->count(),
            ],

            'mountpoints' => [
                'total' => Mountpoint::query()->count(),

                'enabled' => Mountpoint::query()
                    ->where('enabled', true)
                    ->count(),
            ],

            'connections' => [
                'active_sources' => $activeSources,
                'active_rovers' => $activeRovers,
            ],

            'traffic' => [
                'source_bytes' => (int) $sourceBytes,
                'rover_bytes' => (int) $roverBytes,
            ],
        ]);
    }
}
