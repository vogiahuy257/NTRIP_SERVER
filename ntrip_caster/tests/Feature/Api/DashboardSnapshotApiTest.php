<?php

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it(
    'rejects unauthenticated dashboard snapshot requests',
    function (): void {
        $this
            ->getJson('/api/v1/dashboard/snapshot')
            ->assertUnauthorized();
    },
)->group('backend');

it(
    'returns the complete dashboard snapshot',
    function (): void {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $station = Station::query()->create([
            'device_id' => 'CTUAV-SNAPSHOT-001',
            'name' => 'Snapshot Test Station',
            'enabled' => true,

            'source_token_hash' => Hash::make(
                'snapshot-source-token',
            ),

            'source_connected' => true,
            'last_seen_at' => now(),
            'last_ip' => '192.168.10.10',
            'firmware_version' => '1.0.0-test',
        ]);

        $mountpoint = Mountpoint::query()->create([
            'station_id' => $station->id,
            'name' => 'CTUAV-SNAPSHOT-001',
            'identifier' => 'Snapshot Test Station',
            'format' => 'RTCM 3.2',
            'format_details' => '1005,1074,1084,1094,1124,1230',
            'nav_system' => 'GPS+GLO+GAL+BDS',
            'latitude' => 10.9801234,
            'longitude' => 106.6745678,
            'country' => 'VNM',
            'enabled' => true,
            'is_primary' => true,
            'access_mode' => Mountpoint::ACCESS_PUBLIC,
            'max_rover_connections' => 10,
        ]);

        $station->telemetry()->create([
            'payload' => [
                'firmware_version' => '1.0.0-test',
                'source_connected' => true,

                'network' => [
                    'connected' => true,
                    'type' => 'ethernet',
                    'ip' => '192.168.10.10',
                ],

                'survey_in' => [
                    'active' => false,
                    'valid' => true,
                    'latitude' => 10.9801234,
                    'longitude' => 106.6745678,
                ],

                'rtcm' => [
                    'upload_bps' => 5480,
                    'frames_valid' => 3200,
                    'crc_errors' => 2,
                    'age_ms' => 25,

                    'message_counts' => [
                        '1005' => 32,
                        '1074' => 320,
                        '1084' => 320,
                    ],
                ],

                'system' => [
                    'temperature_c' => 43.5,
                    'free_heap_bytes' => 184320,
                ],
            ],

            'received_at' => now(),
        ]);

        NtripSession::query()->create([
            'mountpoint_id' => $mountpoint->id,
            'station_id' => $station->id,
            'rover_account_id' => null,
            'connection_type' => NtripSession::TYPE_SOURCE,
            'authenticated_username' => null,
            'client_agent' => 'NTRIP Source Test',
            'ntrip_version' => '2.0',
            'remote_ip' => '192.168.10.10',
            'connected_at' => now()->subMinutes(5),
            'disconnected_at' => null,
            'bytes_transferred' => 120000,
            'valid_rtcm_frames' => 3200,
            'rtcm_crc_errors' => 2,

            'rtcm_message_counts' => [
                '1005' => 32,
                '1074' => 320,
            ],
        ]);

        NtripSession::query()->create([
            'mountpoint_id' => $mountpoint->id,
            'station_id' => null,
            'rover_account_id' => null,
            'connection_type' => NtripSession::TYPE_ROVER,
            'authenticated_username' => null,
            'client_agent' => 'NTRIP Rover Test',
            'ntrip_version' => '2.0',
            'remote_ip' => '192.168.10.20',
            'connected_at' => now()->subMinutes(2),
            'disconnected_at' => null,
            'bytes_transferred' => 48000,
            'valid_rtcm_frames' => 0,
            'rtcm_crc_errors' => 0,
            'rtcm_message_counts' => [],
        ]);

        $response = $this
            ->getJson('/api/v1/dashboard/snapshot')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath(
                'data.summary.station_count',
                1,
            )
            ->assertJsonPath(
                'data.summary.enabled_stations',
                1,
            )
            ->assertJsonPath(
                'data.summary.mountpoint_count',
                1,
            )
            ->assertJsonPath(
                'data.summary.enabled_mountpoints',
                1,
            )
            ->assertJsonPath(
                'data.summary.active_sources',
                1,
            )
            ->assertJsonPath(
                'data.summary.active_rovers',
                1,
            )
            ->assertJsonPath(
                'data.summary.active_sessions',
                2,
            )
            ->assertJsonPath(
                'data.summary.total_traffic_bps',
                5480,
            )
            ->assertJsonPath(
                'data.summary.total_crc_errors',
                2,
            )
            ->assertJsonPath(
                'data.stations.0.device_id',
                'CTUAV-SNAPSHOT-001',
            )
            ->assertJsonPath(
                'data.stations.0.mountpoint.name',
                'CTUAV-SNAPSHOT-001',
            )
            ->assertJsonPath(
                'data.stations.0.telemetry.payload.rtcm.upload_bps',
                5480,
            );

        $snapshot = $response->json('data');

        expect($snapshot)
            ->toBeArray()
            ->and($snapshot['generated_at'])
            ->toBeString()
            ->and($snapshot['stations'])
            ->toHaveCount(1)
            ->and($snapshot['mountpoints'])
            ->toHaveCount(1)
            ->and($snapshot['active_sessions'])
            ->toHaveCount(2);

        expect($snapshot['stations'][0])
            ->not
            ->toHaveKey('source_token_hash');

        expect($snapshot['mountpoints'][0])
            ->not
            ->toHaveKey('rover_password_hash');
    },
)->group('backend');
