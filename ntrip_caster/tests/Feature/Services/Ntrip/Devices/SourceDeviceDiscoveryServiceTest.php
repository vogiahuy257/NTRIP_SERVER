<?php

namespace Tests\Feature\Services\Ntrip\Devices;

use App\Events\Devices\PendingDeviceDiscovered;
use App\Events\Devices\PendingDeviceUpdated;
use App\Models\PendingDevice;
use App\Services\Devices\PendingDeviceService;
use App\Services\Ntrip\Devices\SourceDeviceDiscoveryOutcome;
use App\Services\Ntrip\Devices\SourceDeviceDiscoveryService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Event;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('backend')]
#[Group('devices')]
final class SourceDeviceDiscoveryServiceTest extends TestCase
{
    use DatabaseMigrations;

    private SourceDeviceDiscoveryService $service;

    private PendingDeviceService $pendingDevices;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $this->service = app(
            SourceDeviceDiscoveryService::class,
        );

        $this->pendingDevices = app(
            PendingDeviceService::class,
        );
    }

    public function test_legacy_source_bypasses_device_discovery(): void
    {
        $decision = $this->service->evaluate(
            headers: [
                'authorization' => 'Bearer legacy-token',

                'user-agent' => 'Legacy-NTRIP-Source',
            ],
            requestMountpoint: 'LEGACY-BASE',
            remoteIp: '192.168.1.50',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::LEGACY_SOURCE,
            $decision->outcome,
        );

        $this->assertTrue(
            $decision->shouldContinueAuthentication(),
        );

        $this->assertFalse(
            $decision->isManagedDevice(),
        );

        $this->assertNull(
            $decision->identity,
        );

        $this->assertNull(
            $decision->pendingDeviceId,
        );

        $this->assertDatabaseCount(
            'pending_devices',
            0,
        );
    }

    public function test_new_esp32_is_registered_as_pending(): void
    {
        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.51',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::DEVICE_PENDING,
            $decision->outcome,
        );

        $this->assertFalse(
            $decision->shouldContinueAuthentication(),
        );

        $this->assertTrue(
            $decision->isManagedDevice(),
        );

        $this->assertNotNull(
            $decision->pendingDeviceId,
        );

        $this->assertSame(
            'ESP32-F024F90E449C',
            $decision->identity?->hardwareId,
        );

        $this->assertDatabaseHas(
            'pending_devices',
            [
                'hardware_id' => 'ESP32-F024F90E449C',

                'reported_device_id' => 'CTUAV-BASE-REAL-001',

                'reported_mountpoint' => 'CTUAV-RTCM-REAL-001',

                'reported_provisioning_state' => 'bootstrap',

                'firmware_version' => '1.1.0',

                'remote_ip' => '192.168.1.51',

                'status' => PendingDevice::STATUS_PENDING,
            ],
        );
    }

    public function test_rejected_device_is_denied(): void
    {
        $device = $this->discoverDevice();

        $device->update([
            'status' => PendingDevice::STATUS_REJECTED,

            'rejected_at' => now(),

            'rejection_reason' => 'Rejected by operator',
        ]);

        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.52',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::DEVICE_REJECTED,
            $decision->outcome,
        );

        $this->assertFalse(
            $decision->shouldContinueAuthentication(),
        );
    }

    public function test_approved_bootstrap_device_must_fetch_provisioning(): void
    {
        $device = $this->discoverDevice();

        $device->update([
            'status' => PendingDevice::STATUS_APPROVED,

            'approved_at' => now(),
        ]);

        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(
                provisioningState: 'bootstrap',
            ),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.53',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::PROVISIONING_REQUIRED,
            $decision->outcome,
        );

        $this->assertFalse(
            $decision->shouldContinueAuthentication(),
        );
    }

    public function test_approved_provisioned_device_may_authenticate(): void
    {
        $device = $this->discoverDevice();

        $device->update([
            'status' => PendingDevice::STATUS_APPROVED,

            'approved_at' => now(),
        ]);

        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(
                provisioningState: 'provisioned',
            ),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.54',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::READY_FOR_AUTHENTICATION,
            $decision->outcome,
        );

        $this->assertTrue(
            $decision->shouldContinueAuthentication(),
        );

        $this->assertSame(
            $device->id,
            $decision->pendingDeviceId,
        );
    }

    public function test_provisioned_device_may_authenticate_again(): void
    {
        $device = $this->discoverDevice();

        $device->update([
            'status' => PendingDevice::STATUS_PROVISIONED,

            'approved_at' => now(),
            'provisioned_at' => now(),
        ]);

        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(
                provisioningState: 'provisioned',
            ),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.55',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::READY_FOR_AUTHENTICATION,
            $decision->outcome,
        );

        $this->assertTrue(
            $decision->shouldContinueAuthentication(),
        );
    }

    public function test_provisioned_device_in_bootstrap_state_requires_config_again(): void
    {
        $device = $this->discoverDevice();

        $device->update([
            'status' => PendingDevice::STATUS_PROVISIONED,

            'approved_at' => now(),
            'provisioned_at' => now(),
        ]);

        $decision = $this->service->evaluate(
            headers: $this->managedHeaders(
                provisioningState: 'bootstrap',
            ),
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.56',
        );

        $this->assertSame(
            SourceDeviceDiscoveryOutcome::PROVISIONING_REQUIRED,
            $decision->outcome,
        );

        $this->assertFalse(
            $decision->shouldContinueAuthentication(),
        );
    }

    public function test_invalid_identity_header_is_rejected(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'X-Provisioning-State must be bootstrap or provisioned.',
        );

        $headers = $this->managedHeaders();

        $headers['X-Provisioning-State'] =
            'invalid';

        $this->service->evaluate(
            headers: $headers,
            requestMountpoint: 'CTUAV-RTCM-REAL-001',
            remoteIp: '192.168.1.57',
        );
    }

    private function discoverDevice(): PendingDevice
    {
        return $this->pendingDevices->discover(
            hardwareId: 'ESP32-F024F90E449C',

            reportedDeviceId: 'CTUAV-BASE-REAL-001',

            reportedMountpoint: 'CTUAV-RTCM-REAL-001',

            reportedProvisioningState: 'bootstrap',

            firmwareVersion: '1.1.0',

            remoteIp: '192.168.1.50',
        )->device;
    }

    /**
     * @return array<string, string>
     */
    private function managedHeaders(
        string $provisioningState = 'bootstrap',
    ): array {
        return [
            'X-Hardware-ID' => 'ESP32-F024F90E449C',

            'X-Device-ID' => 'CTUAV-BASE-REAL-001',

            'X-Mountpoint' => 'CTUAV-RTCM-REAL-001',

            'X-Firmware-Version' => '1.1.0',

            'X-Provisioning-State' => $provisioningState,

            'Authorization' => 'Bearer bootstrap-token',
        ];
    }
}
