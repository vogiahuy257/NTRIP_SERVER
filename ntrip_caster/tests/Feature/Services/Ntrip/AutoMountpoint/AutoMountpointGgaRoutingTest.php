<?php

declare(strict_types=1);

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Services\Ntrip\NtripCaster;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('assigns AUTO rover from GGA and relays RTCM', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,

        'ntrip.auto_mountpoint.name' => 'AUTO',

        'ntrip.auto_mountpoint.service_radius_meters' => 10_000,

        'ntrip.auto_mountpoint.access_refresh_seconds' => 1,
    ]);

    $base = Mountpoint::factory()->create([
        'name' => 'BASE_NEAR',
        'enabled' => true,
        'latitude' => 10.9800000,
        'longitude' => 106.6740000,
    ]);

    $account = RoverAccount::factory()->create();

    $account->mountpoints()->attach(
        $base->id,
        [
            'enabled' => true,
            'max_connections' => null,
            'starts_at' => null,
            'expires_at' => null,
        ],
    );

    $session = app(
        NtripSessionService::class,
    )->createAutoRover(
        requestedMountpoint: 'AUTO',
        account: $account,
        remoteIp: '127.0.0.1',
        clientAgent: 'AUTO Test',
        ntripVersion: 'Ntrip/2.0',
    );

    $sourcePair = stream_socket_pair(
        STREAM_PF_UNIX,
        STREAM_SOCK_STREAM,
        STREAM_IPPROTO_IP,
    );

    $roverPair = stream_socket_pair(
        STREAM_PF_UNIX,
        STREAM_SOCK_STREAM,
        STREAM_IPPROTO_IP,
    );

    expect($sourcePair)->not->toBeFalse()
        ->and($roverPair)->not->toBeFalse();

    [$sourceSocket, $sourcePeer] = $sourcePair;
    [$roverSocket, $roverPeer] = $roverPair;

    try {
        $caster = app(NtripCaster::class);

        $sourceId = (int) $sourceSocket;
        $roverId = (int) $roverSocket;

        $baseClient = [
            'socket' => $sourceSocket,
            'peer' => 'source-test',
            'remote_ip' => '127.0.0.2',

            'state' => 'source',

            'input_buffer' => '',
            'output_buffer' => '',
            'output_protocol_bytes' => 0,

            'rtcm_output_buffer_bytes' => 0,
            'rtcm_output_segments' => [],

            'mountpoint' => $base->name,
            'mountpoint_id' => $base->id,

            'requested_mountpoint' => null,
            'auto_mountpoint' => false,
            'auto_outside_since' => null,
            'auto_last_switch_at' => null,

            'station_id' => $base->station_id,
            'pending_device_id' => null,

            'rover_account_id' => null,
            'authenticated_username' => null,

            'client_agent' => null,
            'ntrip_version' => null,
            'session_id' => null,
            'parser' => null,

            'bytes_transferred' => 0,

            'connected_at' => time(),
            'last_activity' => time(),
            'last_stats_flush_at' => time(),
            'last_gga_persisted_at_ns' => 0,
        ];

        $roverClient = [
            'socket' => $roverSocket,
            'peer' => 'rover-test',
            'remote_ip' => '127.0.0.3',

            'state' => 'rover',

            'input_buffer' => '',
            'output_buffer' => '',
            'output_protocol_bytes' => 0,

            'rtcm_output_buffer_bytes' => 0,
            'rtcm_output_segments' => [],

            'mountpoint' => null,
            'mountpoint_id' => null,

            'requested_mountpoint' => 'AUTO',
            'auto_mountpoint' => true,
            'auto_outside_since' => null,
            'auto_last_switch_at' => null,

            'station_id' => null,
            'pending_device_id' => null,

            'rover_account_id' => $account->id,

            'authenticated_username' => $account->username,

            'client_agent' => 'AUTO Test',
            'ntrip_version' => 'Ntrip/2.0',

            'session_id' => $session->id,
            'parser' => null,

            'bytes_transferred' => 0,

            'connected_at' => time(),
            'last_activity' => time(),
            'last_stats_flush_at' => time(),
            'last_gga_persisted_at_ns' => 0,
        ];

        $clientsProperty = new ReflectionProperty(
            $caster,
            'clients',
        );

        $clientsProperty->setAccessible(true);

        $clientsProperty->setValue(
            $caster,
            [
                $sourceId => $baseClient,
                $roverId => $roverClient,
            ],
        );

        $catalogProperty = new ReflectionProperty(
            $caster,
            'catalog',
        );

        $catalogProperty->setAccessible(true);

        $catalogProperty->setValue(
            $caster,
            [
                $base->name => [
                    'mountpoint_id' => $base->id,
                    'station_id' => $base->station_id,

                    'name' => $base->name,

                    'latitude' => $base->latitude,
                    'longitude' => $base->longitude,

                    'mountpoint_enabled' => true,
                    'station_enabled' => true,
                ],
            ],
        );

        $body =
            'GPGGA,120000.00,1058.8000,N,'
            .'10640.4400,E,4,15,0.8,'
            .'10.0,M,0.0,M,,';

        $checksum = 0;

        foreach (str_split($body) as $character) {
            $checksum ^= ord($character);
        }

        $gga = sprintf(
            '$%s*%02X',
            $body,
            $checksum,
        );

        $handleGga = new ReflectionMethod(
            $caster,
            'handleRoverGgaLine',
        );

        $handleGga->setAccessible(true);

        $handleGga->invoke(
            $caster,
            $roverId,
            $gga,
            static function (string $message): void {
                //
            },
        );

        /** @var array<int, array<string, mixed>> $clients */
        $clients =
            $clientsProperty->getValue($caster);

        $updatedSession = NtripSession::query()
            ->findOrFail($session->id)
            ->fresh();

        expect($clients[$roverId]['mountpoint_id'])
            ->toBe($base->id)
            ->and($clients[$roverId]['mountpoint'])
            ->toBe('BASE_NEAR')
            ->and($updatedSession->mountpoint_id)
            ->toBe($base->id)
            ->and($updatedSession->rover_latitude)
            ->toBe(10.98)
            ->and($updatedSession->rover_longitude)
            ->toBe(106.674);

        $rtcm = "\xD3\x00\x03\x01\x02\x03";

        $relay = new ReflectionMethod(
            $caster,
            'relaySourceData',
        );

        $relay->setAccessible(true);

        $relay->invoke(
            $caster,
            $sourceId,
            $rtcm,
            static function (string $message): void {
                //
            },
        );

        /** @var array<int, array<string, mixed>> $clients */
        $clients =
            $clientsProperty->getValue($caster);

        expect($clients[$roverId]['output_buffer'])
            ->toContain($rtcm)
            ->and(
                $clients[$roverId][
                    'rtcm_output_buffer_bytes'
                ],
            )
            ->toBe(strlen($rtcm));
    } finally {
        fclose($sourceSocket);
        fclose($sourcePeer);
        fclose($roverSocket);
        fclose($roverPeer);
    }
})->group('backend');
