<?php

namespace Database\Seeders;

use App\Models\NtripSession;
use App\Models\Station;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class NtripDemoSeeder extends Seeder
{
    private const DEMO_STATION_COUNT = 20;

    private const REAL_DEVICE_ID = 'CTUAV-BASE-REAL-001';

    private const REAL_STATION_NAME = 'CTUAV Real Base Station 001';

    private const REAL_MOUNTPOINT = 'CTUAV-RTCM-REAL-001';

    private const REAL_SOURCE_TOKEN = 'ctuav-real-base-001-development-token';

    private const REAL_CASTER_HOST = 'ctuav-ntrip.local';

    public function run(): void
    {
        $profiles = collect(range(1, self::DEMO_STATION_COUNT))
            ->map(fn (int $number): array => $this->profile($number));

        DB::transaction(function () use ($profiles): void {
            $this->seedRealStation();

            $mountpointIds = [];

            foreach ($profiles as $profile) {
                $station = Station::query()->updateOrCreate(
                    ['device_id' => $profile['device_id']],
                    [
                        'name' => $profile['name'],
                        'enabled' => true,
                        'source_token_hash' => Hash::make($profile['token']),
                        'source_connected' => $profile['source_connected'],
                        'last_seen_at' => $profile['last_seen_at'],
                        'last_ip' => $profile['ip'],
                        'firmware_version' => '1.0.0-sim',
                    ],
                );

                $station->config()->updateOrCreate(
                    ['station_id' => $station->id],
                    [
                        'revision' => $profile['revision'],
                        'caster_host' => 'ctuav-ntrip.local',
                        'caster_port' => 2101,
                        'uart_baud' => 115200,
                        'telemetry_interval_ms' => 2000,
                        'config_poll_interval_ms' => 30000,
                        'max_rtcm_age_ms' => 1500,
                    ],
                );

                $mountpoint = $station->mountpoint()->updateOrCreate(
                    ['station_id' => $station->id],
                    [
                        'name' => $profile['mountpoint'],
                        'identifier' => $profile['name'],
                        'format' => 'RTCM 3.3',
                        'format_details' =>
                            '1005(10),1074(1),1084(1),1094(1),1124(1),1230(10)',
                        'nav_system' => 'GPS+GLO+GAL+BDS',
                        'latitude' => $profile['latitude'],
                        'longitude' => $profile['longitude'],
                        'country' => 'VNM',
                        'enabled' => true,
                        'rover_username' => null,
                        'rover_password_hash' => null,
                    ],
                );

                $mountpointIds[] = $mountpoint->id;

                $station->telemetry()->updateOrCreate(
                    ['station_id' => $station->id],
                    [
                        'payload' => $this->telemetryPayload($profile),
                        'received_at' => $profile['last_seen_at'],
                    ],
                );
            }

            NtripSession::query()
                ->whereIn('mountpoint_id', $mountpointIds)
                ->delete();

            foreach ($profiles as $index => $profile) {
                $station = Station::query()
                    ->where('device_id', $profile['device_id'])
                    ->with('mountpoint:id,station_id')
                    ->firstOrFail();

                NtripSession::query()->create(
                    $this->sessionData(
                        mountpointId: $station->mountpoint->id,
                        profile: $profile,
                        index: $index,
                    ),
                );
            }
        });
    }

    private function seedRealStation(): void
    {
        $station = Station::query()->updateOrCreate(
            ['device_id' => self::REAL_DEVICE_ID],
            [
                'name' => self::REAL_STATION_NAME,
                'enabled' => true,
                'source_token_hash' => Hash::make(self::REAL_SOURCE_TOKEN),
                'source_connected' => false,
                'last_seen_at' => null,
                'last_ip' => null,
                'firmware_version' => '1.0.0',
            ],
        );

        $station->config()->updateOrCreate(
            ['station_id' => $station->id],
            [
                'revision' => 1,
                'caster_host' => self::REAL_CASTER_HOST,
                'caster_port' => 2101,
                'uart_baud' => 115200,
                'telemetry_interval_ms' => 2000,
                'config_poll_interval_ms' => 30000,
                'max_rtcm_age_ms' => 1500,
            ],
        );

        $station->mountpoint()->updateOrCreate(
            ['station_id' => $station->id],
            [
                'name' => self::REAL_MOUNTPOINT,
                'identifier' => 'CTUAV Real GNSS Base 001',
                'format' => 'RTCM 3.3',
                'format_details' =>
                    '1005(10),1074(1),1084(1),1094(1),1124(1),1230(10)',
                'nav_system' => 'GPS+GLO+GAL+BDS',
                'latitude' => 10.9801234,
                'longitude' => 106.6745678,
                'country' => 'VNM',
                'enabled' => true,
                'rover_username' => null,
                'rover_password_hash' => null,
            ],
        );
    }

    private function profile(int $number): array
    {
        $row = intdiv($number - 1, 5);
        $column = ($number - 1) % 5;
        $sourceConnected = $number % 4 !== 0;
        $surveyValid = $number % 5 !== 0;
        $networkType = $number % 3 === 0 ? 'wifi' : 'ethernet';
        $lastSeenAt = CarbonImmutable::now()->subSeconds($number * 7);

        return [
            'number' => $number,
            'device_id' => sprintf('CTUAV-BASE-%03d', $number),
            'name' => sprintf('CTUAV Base Station %03d', $number),
            'token' => sprintf('ctuav-base-%03d-development-token', $number),
            'mountpoint' => sprintf('CTUAV-RTCM-%03d', $number),
            'latitude' => round(10.9801234 + ($row * 0.0022) + ($column * 0.00042), 7),
            'longitude' => round(106.6745678 + ($column * 0.0020) + ($row * 0.00038), 7),
            'altitude_m' => round(18.0 + ($number * 0.17), 2),
            'source_connected' => $sourceConnected,
            'survey_valid' => $surveyValid,
            'network_type' => $networkType,
            'ip' => sprintf('192.168.10.%d', 100 + $number),
            'revision' => 1 + intdiv($number - 1, 5),
            'last_seen_at' => $lastSeenAt,
        ];
    }

    private function telemetryPayload(array $profile): array
    {
        $number = $profile['number'];
        $sourceConnected = $profile['source_connected'];
        $surveyValid = $profile['survey_valid'];
        $uploadBps = $sourceConnected ? 3900 + ($number * 85) : 0;
        $framesValid = 12000 + ($number * 2100);
        $crcErrors = $number % 6 === 0 ? intdiv($number, 6) : 0;

        return [
            'firmware_version' => '1.0.0-sim',
            'source_connected' => $sourceConnected,
            'network' => [
                'connected' => true,
                'type' => $profile['network_type'],
                'ip' => $profile['ip'],
                'rssi' => $profile['network_type'] === 'wifi' ? -48 - $number : null,
                'link_speed_mbps' => $profile['network_type'] === 'wifi' ? 72 : 100,
                'management_url' => 'http://ctuav-ntrip.local:8000',
            ],
            'survey_in' => [
                'active' => ! $surveyValid,
                'valid' => $surveyValid,
                'duration_s' => $surveyValid ? 900 + ($number * 30) : 40 + $number,
                'mean_accuracy_m' => $surveyValid ? 0.012 + ($number * 0.0002) : 0.18 + ($number * 0.003),
                'observations' => 1800 + ($number * 120),
                'latitude' => $profile['latitude'],
                'longitude' => $profile['longitude'],
                'altitude_m' => $profile['altitude_m'],
            ],
            'rtcm' => [
                'format' => 'RTCM 3.3',
                'receiver' => 'u-blox ZED-F9P',
                'uart_baud' => 115200,
                'caster_host' => 'ctuav-ntrip.local',
                'caster_port' => 2101,
                'mountpoint' => $profile['mountpoint'],
                'connected' => $sourceConnected,
                'reconnect_count' => $number % 4,
                'bytes_sent' => 900000 * $number,
                'frames_valid' => $framesValid,
                'crc_errors' => $crcErrors,
                'queue_drops' => $number % 7 === 0 ? 2 : 0,
                'stale_drops' => $number % 8 === 0 ? 1 : 0,
                'age_ms' => $sourceConnected ? 120 + ($number * 11) : null,
                'upload_bps' => $uploadBps,
                'message_counts' => [
                    '1005' => 120 + $number,
                    '1074' => 1200 + ($number * 10),
                    '1084' => 1200 + ($number * 10),
                    '1094' => 1200 + ($number * 10),
                    '1124' => 1200 + ($number * 10),
                    '1230' => 120 + $number,
                ],
            ],
            'system' => [
                'uptime_s' => 3600 * $number,
                'free_heap_bytes' => 190000 - ($number * 1800),
                'minimum_free_heap_bytes' => 174000 - ($number * 900),
                'temperature_c' => round(42.0 + ($number * 0.28), 1),
                'cpu_frequency_mhz' => 240,
                'sdk_version' => 'ESP-IDF v6.0.2',
                'reset_reason' => 'POWERON_RESET',
            ],
        ];
    }

    private function sessionData(
        int $mountpointId,
        array $profile,
        int $index,
    ): array {
        $active = $profile['source_connected'];
        $connectedAt = now()->subMinutes(15 + ($index * 3));

        return [
            'mountpoint_id' => $mountpointId,
            'connection_type' => $index % 5 === 4 ? 'rover' : 'source',
            'remote_ip' => $profile['ip'],
            'connected_at' => $connectedAt,
            'disconnected_at' => $active ? null : $connectedAt->copy()->addMinutes(8),
            'bytes_transferred' => 750000 * ($index + 1),
            'disconnect_reason' => $active ? null : 'demo_seed',
            'valid_rtcm_frames' => 10000 * ($index + 1),
            'rtcm_crc_errors' => ($index + 1) % 6 === 0 ? 2 : 0,
            'rtcm_message_counts' => [
                '1005' => 120,
                '1074' => 1200,
                '1084' => 1200,
                '1094' => 1200,
                '1124' => 1200,
                '1230' => 120,
            ],
        ];
    }
}
