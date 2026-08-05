<?php

declare(strict_types=1);

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Services\Ntrip\NtripCaster;
use Database\Factories\RoverAccountFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('registers an AUTO rover and waits for a base assignment', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
    ]);

    $mountpoint = Mountpoint::factory()->create();
    $account = RoverAccount::factory()->create();

    $account->mountpoints()->attach(
        $mountpoint->id,
        [
            'enabled' => true,
            'max_connections' => null,
            'starts_at' => null,
            'expires_at' => null,
        ],
    );

    $sockets = stream_socket_pair(
        STREAM_PF_UNIX,
        STREAM_SOCK_STREAM,
        STREAM_IPPROTO_IP,
    );

    expect($sockets)->not->toBeFalse();

    [$serverSocket, $peerSocket] = $sockets;

    stream_set_blocking($serverSocket, false);
    stream_set_blocking($peerSocket, false);

    try {
        $caster = app(NtripCaster::class);
        $clientId = (int) $serverSocket;

        $clients = [
            $clientId => [
                'socket' => $serverSocket,
                'peer' => 'local-test',
                'remote_ip' => '127.0.0.1',

                'state' => 'headers',

                'input_buffer' => '',
                'output_buffer' => '',
                'output_protocol_bytes' => 0,

                'rtcm_output_buffer_bytes' => 0,
                'rtcm_output_segments' => [],

                'mountpoint' => null,
                'mountpoint_id' => null,

                'requested_mountpoint' => null,
                'auto_mountpoint' => false,
                'auto_outside_since' => null,
                'auto_last_switch_at' => null,

                'station_id' => null,
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
            ],
        ];

        $clientsProperty = new ReflectionProperty(
            $caster,
            'clients',
        );

        $clientsProperty->setAccessible(true);
        $clientsProperty->setValue(
            $caster,
            $clients,
        );

        $registerRover = new ReflectionMethod(
            $caster,
            'registerRover',
        );

        $registerRover->setAccessible(true);

        $registerRover->invoke(
            $caster,
            $clientId,
            'AUTO',
            [
                'authorization' => 'Basic '.base64_encode(
                    $account->username
                    .':'
                    .RoverAccountFactory::PASSWORD,
                ),
                'user-agent' => 'AUTO Caster Test',
                'ntrip-version' => 'Ntrip/2.0',
            ],
            static function (string $message): void {
                //
            },
        );

        /** @var array<int, array<string, mixed>> $runtimeClients */
        $runtimeClients =
            $clientsProperty->getValue($caster);

        $runtimeClient =
            $runtimeClients[$clientId];

        $session = NtripSession::query()
            ->sole()
            ->fresh();

        expect($runtimeClient['state'])
            ->toBe('rover')
            ->and($runtimeClient['requested_mountpoint'])
            ->toBe('AUTO')
            ->and($runtimeClient['auto_mountpoint'])
            ->toBeTrue()
            ->and($runtimeClient['mountpoint'])
            ->toBeNull()
            ->and($runtimeClient['mountpoint_id'])
            ->toBeNull()
            ->and($runtimeClient['session_id'])
            ->toBe($session->id)
            ->and($runtimeClient['output_buffer'])
            ->toContain('HTTP/1.1 200 OK')
            ->and($session->requested_mountpoint)
            ->toBe('AUTO')
            ->and($session->auto_mountpoint)
            ->toBeTrue()
            ->and($session->mountpoint_id)
            ->toBeNull();
    } finally {
        fclose($serverSocket);
        fclose($peerSocket);
    }
})->group('backend');
