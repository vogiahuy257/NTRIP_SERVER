<?php

declare(strict_types=1);

use App\Services\Ntrip\NtripCaster;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

/**
 * @param  resource  $socket
 * @return array<string, mixed>
 */
function autoProtocolRuntimeClient($socket): array
{
    return [
        'socket' => $socket,
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
        'last_rover_latitude' => null,
        'last_rover_longitude' => null,
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
    ];
}

/**
 * @return array{0: NtripCaster, 1: resource, 2: resource, 3: int}
 */
function autoProtocolCasterWithClient(): array
{
    $sockets = stream_socket_pair(
        STREAM_PF_UNIX,
        STREAM_SOCK_STREAM,
        STREAM_IPPROTO_IP,
    );

    expect($sockets)->not->toBeFalse();

    [$serverSocket, $peerSocket] = $sockets;
    $caster = app(NtripCaster::class);
    $clientId = (int) $serverSocket;

    $clients = new ReflectionProperty($caster, 'clients');
    $clients->setValue($caster, [
        $clientId => autoProtocolRuntimeClient($serverSocket),
    ]);

    return [$caster, $serverSocket, $peerSocket, $clientId];
}

it('advertises AUTO as an authenticated GGA mountpoint', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
    ]);

    [$caster, $serverSocket, $peerSocket, $clientId] =
        autoProtocolCasterWithClient();

    try {
        $method = new ReflectionMethod($caster, 'sendSourcetable');
        $method->invoke(
            $caster,
            $clientId,
            static function (string $message): void {},
        );

        $response = stream_get_contents($peerSocket);

        expect($response)
            ->toContain('STR;AUTO;Automatic nearest RTK source;')
            ->toContain(';1;0;Laravel-NTRIP-Caster;none;B;N;0;');
    } finally {
        if (is_resource($serverSocket)) {
            fclose($serverSocket);
        }

        if (is_resource($peerSocket)) {
            fclose($peerSocket);
        }
    }
});

it('rejects NTRIP v2 Source on the reserved AUTO mountpoint', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
    ]);

    [$caster, $serverSocket, $peerSocket, $clientId] =
        autoProtocolCasterWithClient();

    try {
        $method = new ReflectionMethod($caster, 'handleHandshake');
        $method->invoke(
            $caster,
            $clientId,
            "POST /AUTO HTTP/1.1\r\nHost: localhost\r\n\r\n",
            static function (string $message): void {},
        );

        expect(stream_get_contents($peerSocket))
            ->toContain('HTTP/1.1 403 Forbidden');
    } finally {
        if (is_resource($serverSocket)) {
            fclose($serverSocket);
        }

        if (is_resource($peerSocket)) {
            fclose($peerSocket);
        }
    }
});

it('rejects NTRIP v1 Source on the reserved AUTO mountpoint', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
    ]);

    [$caster, $serverSocket, $peerSocket, $clientId] =
        autoProtocolCasterWithClient();

    try {
        $method = new ReflectionMethod($caster, 'handleHandshake');
        $method->invoke(
            $caster,
            $clientId,
            "SOURCE secret /AUTO\r\n\r\n",
            static function (string $message): void {},
        );

        expect(stream_get_contents($peerSocket))
            ->toContain('HTTP/1.1 403 Forbidden');
    } finally {
        if (is_resource($serverSocket)) {
            fclose($serverSocket);
        }

        if (is_resource($peerSocket)) {
            fclose($peerSocket);
        }
    }
});

it('keeps Rover connections open after a successful handshake', function (): void {
    $caster = app(NtripCaster::class);
    $method = new ReflectionMethod($caster, 'roverSuccessResponse');

    expect($method->invoke($caster))
        ->toContain('Connection: keep-alive');
});
