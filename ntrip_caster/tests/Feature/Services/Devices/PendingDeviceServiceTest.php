<?php

namespace Tests\Feature\Services\Devices;

use App\Events\Devices\PendingDeviceDiscovered;
use App\Events\Devices\PendingDeviceUpdated;
use App\Models\PendingDevice;
use App\Services\Devices\PendingDeviceService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Event;
use InvalidArgumentException;
use Tests\TestCase;

final class PendingDeviceServiceTest extends TestCase
{
    use DatabaseMigrations;

    private PendingDeviceService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $this->service = app(
            PendingDeviceService::class,
        );
    }

    public function test_it_discovers_a_new_esp32_device(): void
    {
        $seenAt = CarbonImmutable::parse(
            '2026-07-20 08:00:00',
            'UTC',
        );

        $result = $this->service->discover(
            hardwareId: 'esp32-f024f90e449c',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
            seenAt: $seenAt,
        );

        $this->assertTrue(
            $result->discovered,
        );

        $this->assertTrue(
            $result->changed,
        );

        $this->assertSame(
            'ESP32-F024F90E449C',
            $result->device->hardware_id,
        );

        $this->assertSame(
            PendingDevice::STATUS_PENDING,
            $result->device->status,
        );

        $this->assertSame(
            1,
            $result->device->connection_attempts,
        );

        $this->assertDatabaseHas(
            'pending_devices',
            [
                'hardware_id' => 'ESP32-F024F90E449C',

                'reported_device_id' => 'CTUAV-BASE-REAL-001',

                'reported_mountpoint' => 'CTUAV-RTCM-REAL-001',

                'reported_provisioning_state' => 'bootstrap',

                'firmware_version' => '1.1.0',

                'remote_ip' => '192.168.1.50',

                'status' => PendingDevice::STATUS_PENDING,

                'connection_attempts' => 1,
            ],
        );

        Event::assertDispatched(
            PendingDeviceDiscovered::class,
            function (
                PendingDeviceDiscovered $event,
            ): bool {
                return $event->device['hardware_id']
                        === 'ESP32-F024F90E449C'
                    && $event->device['status']
                        === PendingDevice::STATUS_PENDING;
            },
        );

        Event::assertNotDispatched(
            PendingDeviceUpdated::class,
        );
    }

    public function test_reconnect_does_not_create_a_duplicate_device(): void
    {
        $firstSeenAt = CarbonImmutable::parse(
            '2026-07-20 08:00:00',
            'UTC',
        );

        $lastSeenAt = CarbonImmutable::parse(
            '2026-07-20 08:05:00',
            'UTC',
        );

        $first = $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
            seenAt: $firstSeenAt,
        );

        /*
         * Xóa lịch sử fake event của lần discovery đầu tiên,
         * sau đó chỉ kiểm tra event của lần reconnect.
         */
        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $second = $this->service->discover(
            hardwareId: 'esp32-f024f90e449c',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
            seenAt: $lastSeenAt,
        );

        $this->assertFalse(
            $second->discovered,
        );

        $this->assertFalse(
            $second->changed,
        );

        $this->assertSame(
            $first->device->id,
            $second->device->id,
        );

        $this->assertSame(
            1,
            PendingDevice::query()->count(),
        );

        $device = $second->device->fresh();

        $this->assertNotNull($device);

        $this->assertSame(
            2,
            $device->connection_attempts,
        );

        $this->assertEquals(
            $firstSeenAt,
            $device->first_seen_at,
        );

        $this->assertEquals(
            $lastSeenAt,
            $device->last_seen_at,
        );

        Event::assertNotDispatched(
            PendingDeviceDiscovered::class,
        );

        Event::assertNotDispatched(
            PendingDeviceUpdated::class,
        );
    }

    public function test_it_updates_changed_device_information(): void
    {
        $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
        );

        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $result = $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.1',
            remoteIp: '192.168.1.51',
        );

        $this->assertFalse(
            $result->discovered,
        );

        $this->assertTrue(
            $result->changed,
        );

        $this->assertSame(
            1,
            PendingDevice::query()->count(),
        );

        $this->assertDatabaseHas(
            'pending_devices',
            [
                'hardware_id' => 'ESP32-F024F90E449C',

                'firmware_version' => '1.1.1',

                'remote_ip' => '192.168.1.51',

                'connection_attempts' => 2,
            ],
        );

        Event::assertNotDispatched(
            PendingDeviceDiscovered::class,
        );

        Event::assertDispatched(
            PendingDeviceUpdated::class,
            function (
                PendingDeviceUpdated $event,
            ): bool {
                return $event->device[
                    'firmware_version'
                ] === '1.1.1'
                    && $event->device[
                        'remote_ip'
                    ] === '192.168.1.51';
            },
        );
    }

    public function test_missing_optional_headers_do_not_erase_old_values(): void
    {
        $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
        );

        Event::fake([
            PendingDeviceDiscovered::class,
            PendingDeviceUpdated::class,
        ]);

        $result = $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
        );

        $device = $result->device->fresh();

        $this->assertNotNull($device);

        $this->assertSame(
            'CTUAV-BASE-REAL-001',
            $device->reported_device_id,
        );

        $this->assertSame(
            'CTUAV-RTCM-REAL-001',
            $device->reported_mountpoint,
        );

        $this->assertSame(
            'bootstrap',
            $device->reported_provisioning_state,
        );

        $this->assertSame(
            '1.1.0',
            $device->firmware_version,
        );

        $this->assertSame(
            '192.168.1.50',
            $device->remote_ip,
        );

        $this->assertFalse(
            $result->changed,
        );

        Event::assertNotDispatched(
            PendingDeviceUpdated::class,
        );
    }

    public function test_reconnect_does_not_reset_device_lifecycle_status(): void
    {
        $result = $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.50',
        );

        $rejectedAt = now();

        $result->device->update([
            'status' => PendingDevice::STATUS_REJECTED,

            'rejected_at' => $rejectedAt,

            'rejection_reason' => 'Rejected for automated test',
        ]);

        $reconnected = $this->service->discover(
            hardwareId: 'ESP32-F024F90E449C',
            reportedDeviceId: 'CTUAV-BASE-REAL-001',
            reportedMountpoint: 'CTUAV-RTCM-REAL-001',
            reportedProvisioningState: 'bootstrap',
            firmwareVersion: '1.1.0',
            remoteIp: '192.168.1.51',
        );

        $device = $reconnected->device->fresh();

        $this->assertNotNull($device);

        $this->assertSame(
            PendingDevice::STATUS_REJECTED,
            $device->status,
        );

        $this->assertSame(
            'Rejected for automated test',
            $device->rejection_reason,
        );

        $this->assertNotNull(
            $device->rejected_at,
        );
    }

    public function test_it_rejects_an_empty_hardware_id(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'hardware_id cannot be empty.',
        );

        $this->service->discover(
            hardwareId: '   ',
        );
    }

    public function test_it_rejects_a_hardware_id_that_is_too_long(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'hardware_id cannot exceed 64 characters.',
        );

        $this->service->discover(
            hardwareId: str_repeat(
                'A',
                65,
            ),
        );
    }
}
