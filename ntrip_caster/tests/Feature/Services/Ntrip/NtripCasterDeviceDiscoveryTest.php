<?php

namespace Tests\Feature\Services\Ntrip;

use App\Events\Devices\PendingDeviceDiscovered;
use App\Events\Devices\PendingDeviceUpdated;
use App\Models\Mountpoint;
use App\Models\PendingDevice;
use App\Models\Station;
use App\Services\Devices\PendingDeviceService;
use App\Services\Ntrip\NtripCaster;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Group;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use Tests\TestCase;

#[Group('backend')]
#[Group('devices')]
#[Group('caster')]
final class NtripCasterDeviceDiscoveryTest extends TestCase
{
    use DatabaseMigrations;

    private NtripCaster $caster;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $this->caster = app(
            NtripCaster::class,
        );
    }

    public function test_new_esp32_receives_device_pending_response(): void
    {
        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.50',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: "POST /CTUAV-RTCM-REAL-001 HTTP/1.1\r\n"
                ."Host: 192.168.1.10:2101\r\n"
                ."X-Hardware-ID: ESP32-F024F90E449C\r\n"
                ."X-Device-ID: CTUAV-BASE-REAL-001\r\n"
                ."X-Mountpoint: CTUAV-RTCM-REAL-001\r\n"
                ."X-Firmware-Version: 1.1.0\r\n"
                ."X-Provisioning-State: bootstrap\r\n"
                ."Authorization: Bearer bootstrap-token\r\n"
                ."\r\n",
        );

        $response = $this->readPeer(
            $peer,
        );

        $this->assertStringContainsString(
            'HTTP/1.1 403 Forbidden',
            $response,
        );

        $this->assertStringContainsString(
            'X-Device-Code: DEVICE_PENDING',
            $response,
        );

        $this->assertStringContainsString(
            'X-Device-Status: pending',
            $response,
        );

        $this->assertDatabaseHas(
            'pending_devices',
            [
                'hardware_id' => 'ESP32-F024F90E449C',

                'status' => PendingDevice::STATUS_PENDING,

                'reported_device_id' => 'CTUAV-BASE-REAL-001',

                'reported_mountpoint' => 'CTUAV-RTCM-REAL-001',

                'remote_ip' => '192.168.1.50',
            ],
        );

        $this->assertArrayNotHasKey(
            $clientId,
            $this->clients(),
        );
    }

    public function test_rejected_esp32_receives_device_rejected_response(): void
    {
        $device = app(
            PendingDeviceService::class,
        )->discover(
            hardwareId: 'ESP32-F024F90E449C',

            reportedDeviceId: 'CTUAV-BASE-REAL-001',

            reportedMountpoint: 'CTUAV-RTCM-REAL-001',

            reportedProvisioningState: 'bootstrap',

            firmwareVersion: '1.1.0',

            remoteIp: '192.168.1.50',
        )->device;

        $device->update([
            'status' => PendingDevice::STATUS_REJECTED,

            'rejected_at' => now(),

            'rejection_reason' => 'Rejected by operator',
        ]);

        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.51',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: $this->managedSourceRequest(
                provisioningState: 'bootstrap',
            ),
        );

        $response = $this->readPeer(
            $peer,
        );

        $this->assertStringContainsString(
            'X-Device-Code: DEVICE_REJECTED',
            $response,
        );

        $this->assertStringContainsString(
            'X-Device-Status: rejected',
            $response,
        );
    }

    public function test_approved_bootstrap_device_must_fetch_configuration(): void
    {
        $device = app(
            PendingDeviceService::class,
        )->discover(
            hardwareId: 'ESP32-F024F90E449C',

            reportedDeviceId: 'CTUAV-BASE-REAL-001',

            reportedMountpoint: 'CTUAV-RTCM-REAL-001',

            reportedProvisioningState: 'bootstrap',

            firmwareVersion: '1.1.0',

            remoteIp: '192.168.1.50',
        )->device;

        $device->update([
            'status' => PendingDevice::STATUS_APPROVED,

            'approved_at' => now(),
        ]);

        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.52',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: $this->managedSourceRequest(
                provisioningState: 'bootstrap',
            ),
        );

        $response = $this->readPeer(
            $peer,
        );

        $this->assertStringContainsString(
            'X-Device-Code: PROVISIONING_REQUIRED',
            $response,
        );

        $this->assertStringContainsString(
            'X-Device-Status: approved',
            $response,
        );
    }

    public function test_empty_hardware_id_is_rejected_as_invalid(): void
    {
        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.53',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: "POST /CTUAV-RTCM-REAL-001 HTTP/1.1\r\n"
                ."X-Hardware-ID: \r\n"
                ."X-Provisioning-State: bootstrap\r\n"
                ."\r\n",
        );

        $response = $this->readPeer(
            $peer,
        );

        $this->assertStringContainsString(
            'HTTP/1.1 400 Bad Request',
            $response,
        );

        $this->assertStringContainsString(
            'X-Device-Code: INVALID_DEVICE_IDENTITY',
            $response,
        );

        $this->assertDatabaseCount(
            'pending_devices',
            0,
        );
    }

    public function test_legacy_source_still_uses_existing_registration_flow(): void
    {
        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.54',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: "POST /LEGACY-BASE HTTP/1.1\r\n"
                ."Authorization: Bearer legacy-token\r\n"
                ."User-Agent: Legacy-NTRIP-Source\r\n"
                ."\r\n",
        );

        $response = $this->readPeer(
            $peer,
        );

        /*
         * Catalog test đang rỗng nên luồng cũ trả 404.
         * Quan trọng là request không bị giữ ở discovery.
         */
        $this->assertStringContainsString(
            'HTTP/1.1 404 Not Found',
            $response,
        );

        $this->assertStringNotContainsString(
            'X-Device-Code',
            $response,
        );

        $this->assertDatabaseCount(
            'pending_devices',
            0,
        );
    }

    public function test_provisioned_header_continues_to_existing_source_authentication(): void
    {
        $device = app(
            PendingDeviceService::class,
        )->discover(
            hardwareId: 'ESP32-F024F90E449C',

            reportedDeviceId: 'CTUAV-BASE-REAL-001',

            reportedMountpoint: 'CTUAV-RTCM-REAL-001',

            reportedProvisioningState: 'bootstrap',

            firmwareVersion: '1.1.0',

            remoteIp: '192.168.1.50',
        )->device;

        $device->update([
            'status' => PendingDevice::STATUS_APPROVED,

            'approved_at' => now(),
        ]);

        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.55',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: $this->managedSourceRequest(
                provisioningState: 'provisioned',
            ),
        );

        $response = $this->readPeer(
            $peer,
        );

        /*
         * Catalog đang rỗng nên registerSource() trả 404.
         * Điều này chứng minh discovery đã cho request đi tiếp.
         */
        $this->assertStringContainsString(
            'HTTP/1.1 404 Not Found',
            $response,
        );

        $this->assertStringNotContainsString(
            'PROVISIONING_REQUIRED',
            $response,
        );
    }

    /**
     * @return array{0: int, 1: resource}
     */
    private function attachClient(
        string $remoteIp,
    ): array {
        $pair = stream_socket_pair(
            STREAM_PF_UNIX,
            STREAM_SOCK_STREAM,
            STREAM_IPPROTO_IP,
        );

        if ($pair === false) {
            throw new RuntimeException(
                'Cannot create test socket pair.',
            );
        }

        [$casterSocket, $peerSocket] = $pair;

        $clientId = (int) $casterSocket;
        $now = time();

        $clients = $this->clients();

        $clients[$clientId] = [
            'socket' => $casterSocket,
            'peer' => $remoteIp.':45000',
            'remote_ip' => $remoteIp,
            'state' => 'headers',
            'input_buffer' => '',
            'output_buffer' => '',
            'output_protocol_bytes' => 0,
            'rtcm_output_buffer_bytes' => 0,
            'rtcm_output_segments' => [],
            'mountpoint' => null,
            'mountpoint_id' => null,
            'station_id' => null,
            'pending_device_id' => null,
            'rover_account_id' => null,
            'authenticated_username' => null,
            'client_agent' => null,
            'ntrip_version' => null,
            'session_id' => null,
            'bytes_transferred' => 0,
            'connected_at' => $now,
            'last_stats_flush_at' => $now,
            'last_activity' => $now,
            'parser' => null,
        ];

        $this->setClients(
            $clients,
        );

        return [
            $clientId,
            $peerSocket,
        ];
    }

    private function invokeHandshake(
        int $clientId,
        string $rawHeader,
    ): void {
        $method = new ReflectionMethod(
            NtripCaster::class,
            'handleHandshake',
        );

        $method->setAccessible(true);

        $method->invoke(
            $this->caster,
            $clientId,
            $rawHeader,
            static function (
                string $message,
            ): void {},
        );
    }

    /**
     * @param  resource  $peer
     */
    private function readPeer(
        $peer,
    ): string {
        $response = stream_get_contents(
            $peer,
        );

        fclose($peer);

        if ($response === false) {
            throw new RuntimeException(
                'Cannot read test peer response.',
            );
        }

        return $response;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function clients(): array
    {
        $property = new ReflectionProperty(
            NtripCaster::class,
            'clients',
        );

        $property->setAccessible(true);

        /** @var array<int, array<string, mixed>> $clients */
        $clients = $property->getValue(
            $this->caster,
        );

        return $clients;
    }

    /**
     * @param  array<int, array<string, mixed>>  $clients
     */
    private function setClients(
        array $clients,
    ): void {
        $property = new ReflectionProperty(
            NtripCaster::class,
            'clients',
        );

        $property->setAccessible(true);

        $property->setValue(
            $this->caster,
            $clients,
        );
    }

    private function managedSourceRequest(
        string $provisioningState,
    ): string {
        return
            "POST /CTUAV-RTCM-REAL-001 HTTP/1.1\r\n"
            ."Host: 192.168.1.10:2101\r\n"
            ."X-Hardware-ID: ESP32-F024F90E449C\r\n"
            ."X-Device-ID: CTUAV-BASE-REAL-001\r\n"
            ."X-Mountpoint: CTUAV-RTCM-REAL-001\r\n"
            ."X-Firmware-Version: 1.1.0\r\n"
            ."X-Provisioning-State: {$provisioningState}\r\n"
            ."Authorization: Bearer bootstrap-token\r\n"
            ."\r\n";
    }

    public function test_authenticated_esp32_is_marked_as_provisioned(): void
    {
        $sourceToken = 'managed-source-token';

        $station = Station::factory()->create([
            'device_id' => 'CTUAV-BASE-REAL-001',

            'name' => 'RTK Base CTUAV-BASE-REAL-001',

            'source_token_hash' => Hash::make($sourceToken),

            'enabled' => true,
        ]);

        $mountpoint = Mountpoint::factory()
            ->for($station)
            ->create([
                'name' => 'CTUAV-RTCM-REAL-001',

                'identifier' => 'RTK Base CTUAV-BASE-REAL-001',

                'enabled' => true,
                'is_primary' => true,
            ]);

        $device = PendingDevice::query()->create([
            'hardware_id' => 'ESP32-F024F90E449C',

            'reported_device_id' => 'CTUAV-BASE-REAL-001',

            'reported_mountpoint' => $mountpoint->name,

            'reported_provisioning_state' => 'bootstrap',

            'firmware_version' => '1.1.0',

            'remote_ip' => '192.168.1.60',

            'status' => PendingDevice::STATUS_APPROVED,

            'connection_attempts' => 1,

            'first_seen_at' => now(),
            'last_seen_at' => now(),
            'approved_at' => now(),

            'station_id' => $station->id,
        ]);

        $this->refreshCatalog();

        [$clientId, $peer] =
            $this->attachClient(
                remoteIp: '192.168.1.60',
            );

        $this->invokeHandshake(
            clientId: $clientId,
            rawHeader: "POST /{$mountpoint->name} HTTP/1.1\r\n"
                ."Host: 192.168.1.10:2101\r\n"
                ."X-Hardware-ID: {$device->hardware_id}\r\n"
                ."X-Device-ID: {$station->device_id}\r\n"
                ."X-Mountpoint: {$mountpoint->name}\r\n"
                ."X-Firmware-Version: 1.1.0\r\n"
                ."X-Provisioning-State: provisioned\r\n"
                ."Authorization: Bearer {$sourceToken}\r\n"
                ."\r\n",
        );

        /*
        * Kết nối Source thành công vẫn được giữ mở,
        * vì vậy đọc response từ output_buffer thay vì
        * stream_get_contents() chờ socket đóng.
        */
        $clients = $this->clients();

        $this->assertArrayHasKey(
            $clientId,
            $clients,
        );

        $this->assertStringContainsString(
            'HTTP/1.1 200 OK',
            $clients[$clientId]['output_buffer'],
        );

        $this->assertSame(
            'source',
            $clients[$clientId]['state'],
        );

        $device->refresh();

        $this->assertSame(
            PendingDevice::STATUS_PROVISIONED,
            $device->status,
        );

        $this->assertSame(
            'provisioned',
            $device->reported_provisioning_state,
        );

        $this->assertNotNull(
            $device->provisioned_at,
        );

        fclose($peer);
    }

    private function refreshCatalog(): void
    {
        $method = new ReflectionMethod(
            NtripCaster::class,
            'refreshCatalog',
        );

        $method->setAccessible(true);

        $method->invoke(
            $this->caster,
            static function (
                string $message,
            ): void {},
        );
    }
}
