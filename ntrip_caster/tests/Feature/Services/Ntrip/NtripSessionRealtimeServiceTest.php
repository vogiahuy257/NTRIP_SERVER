<?php

use App\Events\NtripSessionEnded;
use App\Events\NtripSessionStarted;
use App\Events\NtripSessionUpdated;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\Station;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it(
    'defines the realtime session event contract',
    function (): void {
        $occurredAt = now()->toIso8601String();

        $payload = [
            'id' => 10,
            'connection_type' => 'rover',
        ];

        $started = new NtripSessionStarted(
            session: $payload,
            occurredAt: $occurredAt,
        );

        $updated = new NtripSessionUpdated(
            session: $payload,
            occurredAt: $occurredAt,
        );

        $ended = new NtripSessionEnded(
            session: $payload,
            occurredAt: $occurredAt,
        );

        expect($started->broadcastAs())
            ->toBe('ntrip.session.started')
            ->and($updated->broadcastAs())
            ->toBe('ntrip.session.updated')
            ->and($ended->broadcastAs())
            ->toBe('ntrip.session.ended');

        foreach ([
            $started,
            $updated,
            $ended,
        ] as $event) {
            $channels = $event->broadcastOn();
            $broadcastPayload =
                $event->broadcastWith();

            expect($channels)
                ->toHaveCount(1)
                ->and($channels[0])
                ->toBeInstanceOf(
                    PrivateChannel::class,
                )
                ->and($channels[0]->name)
                ->toBe(
                    'private-ntrip.dashboard',
                )
                ->and($broadcastPayload['version'])
                ->toBe(1)
                ->and($broadcastPayload['entity'])
                ->toBe('ntrip_session')
                ->and($broadcastPayload['occurred_at'])
                ->toBe($occurredAt)
                ->and($broadcastPayload['session'])
                ->toBe($payload);
        }
    },
)->group('backend');

it(
    'creates updates and ends a source session',
    function (): void {
        $station = Station::query()->create([
            'device_id' => 'CTUAV-SESSION-REALTIME-001',
            'name' => 'Realtime Session Station',
            'enabled' => true,
            'source_token_hash' => Hash::make('source-token'),
            'source_connected' => true,
            'last_seen_at' => now(),
        ]);

        $mountpoint =
            Mountpoint::query()->create([
                'station_id' => $station->id,
                'name' => 'CTUAV-SESSION-REALTIME-001',
                'identifier' => 'Realtime Session Mountpoint',
                'format' => 'RTCM 3.2',
                'format_details' => '1005,1074,1084',
                'nav_system' => 'GPS+GLO+GAL+BDS',
                'latitude' => 10.9801234,
                'longitude' => 106.6745678,
                'country' => 'VNM',
                'enabled' => true,
                'is_primary' => true,
                'access_mode' => Mountpoint::ACCESS_PUBLIC,
                'max_rover_connections' => 10,
            ]);

        $service = app(
            NtripSessionService::class,
        );

        $session = $service->createSource(
            mountpointId: $mountpoint->id,
            stationId: $station->id,
            remoteIp: '192.168.10.10',
            clientAgent: 'Realtime Source Test',
            ntripVersion: 'Ntrip/2.0',
        );

        expect($session->connection_type)
            ->toBe(NtripSession::TYPE_SOURCE)
            ->and($session->disconnected_at)
            ->toBeNull()
            ->and($session->bytes_transferred)
            ->toBe(0);

        $updated = $service->updateStats(
            sessionId: $session->id,
            bytesTransferred: 128000,
            validRtcmFrames: 3200,
            rtcmCrcErrors: 3,
            rtcmMessageCounts: [
                '1005' => 32,
                '1074' => 320,
                '1084' => 320,
            ],
        );

        expect($updated)->toBeTrue();

        $session->refresh();

        expect($session->bytes_transferred)
            ->toBe(128000)
            ->and($session->valid_rtcm_frames)
            ->toBe(3200)
            ->and($session->rtcm_crc_errors)
            ->toBe(3)
            ->and($session->rtcm_message_counts)
            ->toBe([
                '1005' => 32,
                '1074' => 320,
                '1084' => 320,
            ]);

        $ended = $service->end(
            sessionId: $session->id,
            bytesTransferred: 130000,
            disconnectReason: 'peer_closed',
            validRtcmFrames: 3250,
            rtcmCrcErrors: 3,
            rtcmMessageCounts: [
                '1005' => 33,
                '1074' => 325,
                '1084' => 325,
            ],
        );

        expect($ended)->toBeTrue();

        $session->refresh();

        expect($session->disconnected_at)
            ->not
            ->toBeNull()
            ->and($session->disconnect_reason)
            ->toBe('peer_closed')
            ->and($session->bytes_transferred)
            ->toBe(130000)
            ->and($session->valid_rtcm_frames)
            ->toBe(3250);

        expect(
            NtripSession::query()
                ->active()
                ->whereKey($session->id)
                ->exists(),
        )->toBeFalse();

        expect(
            $service->end(
                sessionId: $session->id,
                bytesTransferred: 130000,
                disconnectReason: 'duplicate_disconnect',
            ),
        )->toBeFalse();
    },
)->group('backend');
