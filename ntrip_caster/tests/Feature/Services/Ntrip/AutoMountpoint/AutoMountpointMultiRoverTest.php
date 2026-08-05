<?php

declare(strict_types=1);

use App\Models\Mountpoint;
use App\Models\NtripSession;
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
function autoMultiRuntimeClient(
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

function autoMultiGga(float $latitude, float $longitude): string
{
    $latitudeHemisphere = $latitude >= 0 ? 'N' : 'S';
    $longitudeHemisphere = $longitude >= 0 ? 'E' : 'W';

    $latitude = abs($latitude);
    $longitude = abs($longitude);

    $latitudeDegrees = (int) floor($latitude);
    $longitudeDegrees = (int) floor($longitude);

    $latitudeNmea = sprintf(
        '%02d%07.4f',
        $latitudeDegrees,
        ($latitude - $latitudeDegrees) * 60,
    );

    $longitudeNmea = sprintf(
        '%03d%07.4f',
        $longitudeDegrees,
        ($longitude - $longitudeDegrees) * 60,
    );

    $body = sprintf(
        'GPGGA,120000.00,%s,%s,%s,%s,4,15,0.8,10.0,M,0.0,M,,',
        $latitudeNmea,
        $latitudeHemisphere,
        $longitudeNmea,
        $longitudeHemisphere,
    );

    $checksum = 0;

    foreach (str_split($body) as $character) {
        $checksum ^= ord($character);
    }

    return sprintf('$%s*%02X', $body, $checksum);
}

it('routes multiple AUTO Rovers independently to their nearest Base', function (): void {
    config([
        'ntrip.auto_mountpoint.enabled' => true,
        'ntrip.auto_mountpoint.name' => 'AUTO',
        'ntrip.auto_mountpoint.service_radius_meters' => 10_000,
        'ntrip.auto_mountpoint.switch_confirmation_seconds' => 0,
        'ntrip.auto_mountpoint.switch_cooldown_seconds' => 0,
        'ntrip.rover_gga_min_interval_ms' => 1000,
    ]);

    $baseOne = Mountpoint::factory()->create([
        'name' => 'BASE_01',
        'enabled' => true,
        'latitude' => 10.9800000,
        'longitude' => 106.6740000,
    ]);

    $baseTwo = Mountpoint::factory()->create([
        'name' => 'BASE_02',
        'enabled' => true,
        'latitude' => 11.1800000,
        'longitude' => 106.6740000,
    ]);

    $account = RoverAccount::factory()->create([
        'max_connections' => 10,
    ]);

    foreach ([$baseOne, $baseTwo] as $base) {
        $account->mountpoints()->attach($base->id, [
            'enabled' => true,
            'max_connections' => null,
            'starts_at' => null,
            'expires_at' => null,
        ]);
    }

    $sessionService = app(NtripSessionService::class);
    $sessions = [];

    for ($index = 0; $index < 4; $index++) {
        $sessions[] = $sessionService->createAutoRover(
            requestedMountpoint: 'AUTO',
            account: $account,
            remoteIp: '127.0.0.'.($index + 10),
        );
    }

    $pairs = [];

    for ($index = 0; $index < 6; $index++) {
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
        [$roverASocket] = $pairs[2];
        [$roverBSocket] = $pairs[3];
        [$roverCSocket] = $pairs[4];
        [$roverDSocket] = $pairs[5];

        $sourceOneId = (int) $sourceOneSocket;
        $sourceTwoId = (int) $sourceTwoSocket;
        $roverAId = (int) $roverASocket;
        $roverBId = (int) $roverBSocket;
        $roverCId = (int) $roverCSocket;
        $roverDId = (int) $roverDSocket;

        $clients = [
            $sourceOneId => autoMultiRuntimeClient(
                $sourceOneSocket,
                'source',
                $baseOne->id,
                $baseOne->name,
            ),
            $sourceTwoId => autoMultiRuntimeClient(
                $sourceTwoSocket,
                'source',
                $baseTwo->id,
                $baseTwo->name,
            ),
            $roverAId => autoMultiRuntimeClient(
                $roverASocket,
                'rover',
                roverAccountId: $account->id,
                sessionId: $sessions[0]->id,
            ),
            $roverBId => autoMultiRuntimeClient(
                $roverBSocket,
                'rover',
                roverAccountId: $account->id,
                sessionId: $sessions[1]->id,
            ),
            $roverCId => autoMultiRuntimeClient(
                $roverCSocket,
                'rover',
                roverAccountId: $account->id,
                sessionId: $sessions[2]->id,
            ),
            $roverDId => autoMultiRuntimeClient(
                $roverDSocket,
                'rover',
                roverAccountId: $account->id,
                sessionId: $sessions[3]->id,
            ),
        ];

        $clientsProperty = new ReflectionProperty($caster, 'clients');
        $clientsProperty->setValue($caster, $clients);

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

        $handleGga = new ReflectionMethod($caster, 'handleRoverGgaLine');
        $logger = static function (string $message): void {};

        $handleGga->invoke($caster, $roverAId, autoMultiGga(10.981, 106.674), $logger);
        $handleGga->invoke($caster, $roverBId, autoMultiGga(11.181, 106.674), $logger);
        $handleGga->invoke($caster, $roverCId, autoMultiGga(10.982, 106.674), $logger);
        $handleGga->invoke($caster, $roverDId, autoMultiGga(11.080, 106.674), $logger);

        /** @var array<int, array<string, mixed>> $runtime */
        $runtime = $clientsProperty->getValue($caster);

        expect($runtime[$roverAId]['mountpoint_id'])
            ->toBe($baseOne->id)
            ->and($runtime[$roverBId]['mountpoint_id'])
            ->toBe($baseTwo->id)
            ->and($runtime[$roverCId]['mountpoint_id'])
            ->toBe($baseOne->id)
            ->and($runtime[$roverDId]['mountpoint_id'])
            ->toBeNull();

        $relay = new ReflectionMethod($caster, 'relaySourceData');
        $baseOneRtcm = "\xD3\x00\x01\x11";
        $baseTwoRtcm = "\xD3\x00\x01\x22";

        $relay->invoke($caster, $sourceOneId, $baseOneRtcm, $logger);
        $relay->invoke($caster, $sourceTwoId, $baseTwoRtcm, $logger);

        /** @var array<int, array<string, mixed>> $runtime */
        $runtime = $clientsProperty->getValue($caster);

        expect($runtime[$roverAId]['output_buffer'])
            ->toContain($baseOneRtcm)
            ->not->toContain($baseTwoRtcm)
            ->and($runtime[$roverBId]['output_buffer'])
            ->toContain($baseTwoRtcm)
            ->not->toContain($baseOneRtcm)
            ->and($runtime[$roverCId]['output_buffer'])
            ->toContain($baseOneRtcm)
            ->not->toContain($baseTwoRtcm)
            ->and($runtime[$roverDId]['output_buffer'])
            ->toBe('');

        expect(
            NtripSession::query()
                ->whereKey($sessions[0]->id)
                ->value('mountpoint_id'),
        )->toBe($baseOne->id)
            ->and(
                NtripSession::query()
                    ->whereKey($sessions[1]->id)
                    ->value('mountpoint_id'),
            )->toBe($baseTwo->id);
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
