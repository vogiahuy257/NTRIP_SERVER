<?php

declare(strict_types=1);

use App\Models\Mountpoint;
use App\Models\RoverAccount;
use App\Services\Ntrip\NtripCaster;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

/**
 * @param  resource  $socket
 * @return array<string, mixed>
 */
function autoFailoverRuntimeClient(
    $socket,
    string $state,
    ?int $mountpointId = null,
    ?string $mountpoint = null,
    ?int $roverAccountId = null,
    ?int $sessionId = null,
): array {
    return [
        'socket' => $socket,
        'peer' => 'local-test',
        'remote_ip' => '127.0.0.1',
        'state' => $state,
        'input_buffer' => '',
        'output_buffer' => '',
        'output_protocol_bytes' => 0,
        'rtcm_output_buffer_bytes' => 0,
        'rtcm_output_segments' => [],
        'mountpoint' => $mountpoint,
        'mountpoint_id' => $mountpointId,
        'requested_mountpoint' => $state === 'rover' ? 'AUTO' : null,
        'auto_mountpoint' => $state === 'rover',
        'auto_outside_since' => null,
        'auto_last_switch_at' => null,
        'last_rover_latitude' => null,
        'last_rover_longitude' => null,
        'station_id' => null,
        'pending_device_id' => null,
        'rover_account_id' => $roverAccountId,
        'authenticated_username' => null,
        'client_agent' => null,
        'ntrip_version' => 'Ntrip/2.0',
        'session_id' => $sessionId,
        'parser' => null,
        'bytes_transferred' => 0,
        'connected_at' => time(),
        'last_activity' => time(),
        'last_stats_flush_at' => time(),
        'last_gga_persisted_at_ns' => 0,
    ];
}

it('moves an AUTO Rover immediately when its Source disconnects', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
        'ntrip.auto_mountpoint.service_radius_meters' => 10_000,
        'ntrip.auto_mountpoint.switch_confirmation_seconds' => 10,
        'ntrip.auto_mountpoint.switch_cooldown_seconds' => 30,
    ]);

    $baseOne = Mountpoint::factory()->create([
        'name' => 'BASE_PRIMARY',
        'enabled' => true,
        'latitude' => 10.9800000,
        'longitude' => 106.6740000,
    ]);

    $baseTwo = Mountpoint::factory()->create([
        'name' => 'BASE_BACKUP',
        'enabled' => true,
        'latitude' => 11.0400000,
        'longitude' => 106.6740000,
    ]);

    $account = RoverAccount::factory()->create();

    foreach ([$baseOne, $baseTwo] as $base) {
        $account->mountpoints()->attach($base->id, [
            'enabled' => true,
            'max_connections' => null,
            'starts_at' => null,
            'expires_at' => null,
        ]);
    }

    $session = app(NtripSessionService::class)->createAutoRover(
        requestedMountpoint: 'AUTO',
        account: $account,
        remoteIp: '127.0.0.10',
    );

    $pairs = [];

    for ($index = 0; $index < 3; $index++) {
        $pair = stream_socket_pair(
            STREAM_PF_UNIX,
            STREAM_SOCK_STREAM,
            STREAM_IPPROTO_IP,
        );

        expect($pair)->not->toBeFalse();
        $pairs[] = $pair;
    }

    try {
        $caster = app(NtripCaster::class);
        [$sourceOneSocket] = $pairs[0];
        [$sourceTwoSocket] = $pairs[1];
        [$roverSocket] = $pairs[2];

        $sourceOneId = (int) $sourceOneSocket;
        $sourceTwoId = (int) $sourceTwoSocket;
        $roverId = (int) $roverSocket;

        $clientsProperty = new ReflectionProperty($caster, 'clients');
        $clientsProperty->setValue($caster, [
            $sourceOneId => autoFailoverRuntimeClient(
                $sourceOneSocket,
                'source',
                $baseOne->id,
                $baseOne->name,
            ),
            $sourceTwoId => autoFailoverRuntimeClient(
                $sourceTwoSocket,
                'source',
                $baseTwo->id,
                $baseTwo->name,
            ),
            $roverId => array_replace(
                autoFailoverRuntimeClient(
                    $roverSocket,
                    'rover',
                    $baseOne->id,
                    $baseOne->name,
                    $account->id,
                    $session->id,
                ),
                [
                    'last_rover_latitude' => 10.981,
                    'last_rover_longitude' => 106.674,
                ],
            ),
        ]);

        $catalogProperty = new ReflectionProperty($caster, 'catalog');
        $catalogProperty->setValue($caster, [
            $baseOne->name => [
                'mountpoint_id' => $baseOne->id,
                'name' => $baseOne->name,
                'latitude' => $baseOne->latitude,
                'longitude' => $baseOne->longitude,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],
            $baseTwo->name => [
                'mountpoint_id' => $baseTwo->id,
                'name' => $baseTwo->name,
                'latitude' => $baseTwo->latitude,
                'longitude' => $baseTwo->longitude,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],
        ]);

        $disconnect = new ReflectionMethod($caster, 'disconnectClient');
        $disconnect->invoke(
            $caster,
            $sourceOneId,
            'peer_closed',
            static function (string $message): void {},
        );

        /** @var array<int, array<string, mixed>> $runtime */
        $runtime = $clientsProperty->getValue($caster);

        expect($runtime)->not->toHaveKey($sourceOneId)
            ->and($runtime[$roverId]['mountpoint_id'])
            ->toBe($baseTwo->id)
            ->and($runtime[$roverId]['mountpoint'])
            ->toBe($baseTwo->name)
            ->and($session->fresh()->mountpoint_id)
            ->toBe($baseTwo->id);
    } finally {
        foreach ($pairs as $pair) {
            foreach ($pair as $socket) {
                if (is_resource($socket)) {
                    fclose($socket);
                }
            }
        }
    }
});
