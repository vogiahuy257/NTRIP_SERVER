<?php

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test(
    'RTCM flow history API requires authentication',
    function (): void {
        $this->getJson(
            '/api/v1/observability/rtcm-flow/history'
            .'?mountpoint_id=1',
        )->assertUnauthorized();
    },
)->group('backend');

test(
    'it returns detailed RTCM flow history',
    function (): void {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $now =
            CarbonImmutable::now('UTC')
                ->startOfSecond();

        $timestamp =
            $now->subMinutes(5);

        $stationId = DB::table(
            'stations',
        )->insertGetId([
            'device_id' => 'TEST-RTCM-HISTORY',

            'name' => 'History Test Station',

            'enabled' => true,

            'source_token_hash' => Hash::make('secret'),

            'source_connected' => true,

            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $mountpointId = DB::table(
            'mountpoints',
        )->insertGetId([
            'station_id' => $stationId,
            'name' => 'HISTORY_TEST',
            'enabled' => true,
            'is_primary' => true,
            'access_mode' => 'public',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table(
            'rtcm_flow_samples',
        )->insert([
            'mountpoint_id' => $mountpointId,

            'sampled_at' => $timestamp->format(
                'Y-m-d H:i:s.v',
            ),

            'sample_interval_ms' => 5000,

            'source_connected' => true,

            'source_bytes_delta' => 500,
            'source_bps' => 100,
            'source_chunks_delta' => 5,

            'source_last_received_age_ms' => 25.0,

            'source_gap_max_ms' => 120.0,

            'active_rovers' => 2,

            'expected_egress_bytes_delta' => 1000,

            'queued_egress_bytes_delta' => 1000,

            'written_egress_bytes_delta' => 980,

            'expected_egress_bps' => 200,
            'queued_egress_bps' => 200,
            'written_egress_bps' => 196,

            'fanout_coverage' => 1.0,
            'socket_drain_ratio' => 0.98,

            'fanout_count' => 5,

            'fanout_duration_avg_ms' => 1.2,

            'fanout_duration_p95_ms' => 2.0,

            'fanout_duration_max_ms' => 3.0,

            'backlog_bytes' => 20,

            'maximum_rover_buffer_bytes' => 15,

            'maximum_buffer_age_ms' => 30.0,

            'partial_writes_delta' => 1,
            'zero_writes_delta' => 0,
            'write_failures_delta' => 0,

            'rolled_up_at' => null,

            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $query = http_build_query([
            'mountpoint_id' => $mountpointId,

            'resolution' => 'detail',

            'from' => $now
                ->subMinutes(10)
                ->toIso8601String(),

            'to' => $now->toIso8601String(),

            'max_points' => 1000,
        ]);

        $this->getJson(
            '/api/v1/observability/rtcm-flow/history'
            ."?{$query}",
        )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true,
            )
            ->assertJsonPath(
                'meta.resolution',
                'detail',
            )
            ->assertJsonPath(
                'meta.returned_point_count',
                1,
            )
            ->assertJsonPath(
                'data.0.source_bps',
                100,
            )
            ->assertJsonPath(
                'data.0.active_rovers',
                2,
            )
            ->assertJsonPath(
                'data.0.socket_drain_ratio',
                0.98,
            )
            ->assertJsonPath(
                'data.0.partial_writes',
                1,
            );
    },
)->group('backend');

test(
    'RTCM history validates the requested time range',
    function (): void {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $stationId = DB::table(
            'stations',
        )->insertGetId([
            'device_id' => 'TEST-INVALID-RANGE',

            'name' => 'Invalid Range Station',

            'enabled' => true,

            'source_token_hash' => Hash::make('secret'),

            'source_connected' => false,

            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $mountpointId = DB::table(
            'mountpoints',
        )->insertGetId([
            'station_id' => $stationId,
            'name' => 'INVALID_RANGE',
            'enabled' => true,
            'is_primary' => true,
            'access_mode' => 'public',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $time = now()->toIso8601String();

        $query = http_build_query([
            'mountpoint_id' => $mountpointId,

            'from' => $time,
            'to' => $time,
        ]);

        $this->getJson(
            '/api/v1/observability/rtcm-flow/history'
            ."?{$query}",
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'to',
            ]);
    },
)->group('backend');
