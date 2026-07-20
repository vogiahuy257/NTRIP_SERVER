<?php

use App\Events\StationTelemetryUpdated;
use App\Models\Station;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it(
    'broadcasts station telemetry to dashboard and station channels',
    function (): void {
        $station = Station::factory()->create([
            'device_id' => 'CTUAV-BASE-REALTIME-001',
            'name' => 'Realtime Test Station',
            'enabled' => true,
            'source_connected' => true,
            'last_seen_at' => now(),
            'firmware_version' => '1.0.0-test',
        ]);

        $receivedAt = now()->toIso8601String();

        $telemetry = [
            'firmware_version' => '1.0.0-test',
            'source_connected' => true,

            'network' => [
                'connected' => true,
                'type' => 'wifi',
                'ip_address' => '192.168.10.100',
            ],

            'survey_in' => [
                'active' => false,
                'valid' => true,
                'latitude' => 10.9801234,
                'longitude' => 106.6745678,
            ],

            'rtcm' => [
                'upload_bps' => 5400,
                'valid_frames' => 1200,
                'crc_errors' => 0,
                'age_ms' => 20,
                'message_counts' => [
                    '1005' => 12,
                    '1074' => 120,
                    '1084' => 120,
                ],
            ],

            'system' => [
                'temperature_c' => 43.2,
                'free_heap_bytes' => 184320,
            ],
        ];

        $event = new StationTelemetryUpdated(
            station: $station,
            telemetry: $telemetry,
            receivedAt: $receivedAt,
        );

        $channels = $event->broadcastOn();
        $payload = $event->broadcastWith();

        expect($event->broadcastAs())
            ->toBe('station.telemetry.updated');

        expect($channels)
            ->toHaveCount(2);

        expect($channels[0])
            ->toBeInstanceOf(PrivateChannel::class);

        expect($channels[0]->name)
            ->toBe('private-ntrip.dashboard');

        expect($channels[1])
            ->toBeInstanceOf(PrivateChannel::class);

        expect($channels[1]->name)
            ->toBe(
                'private-stations.CTUAV-BASE-REALTIME-001',
            );

        expect($payload['version'])
            ->toBe(1);

        expect($payload['entity'])
            ->toBe('station');

        expect($payload['action'])
            ->toBe('telemetry.updated');

        expect($payload['occurred_at'])
            ->toBe($receivedAt);

        expect($payload['station']['id'])
            ->toBe($station->id);

        expect($payload['station']['device_id'])
            ->toBe('CTUAV-BASE-REALTIME-001');

        expect($payload['station']['name'])
            ->toBe('Realtime Test Station');

        expect($payload['station']['enabled'])
            ->toBeTrue();

        expect(
            $payload['station']['source_connected'],
        )->toBeTrue();

        expect($payload['station']['firmware_version'])
            ->toBe('1.0.0-test');

        expect($payload['telemetry'])
            ->toBe($telemetry);

        expect($payload['received_at'])
            ->toBe($receivedAt);
    },
)->group('backend');
