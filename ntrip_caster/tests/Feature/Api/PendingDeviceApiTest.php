<?php

use App\Models\PendingDevice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

pest()->group('backend', 'devices');

function pendingEsp32(): PendingDevice
{
    return PendingDevice::query()->create([
        'hardware_id' => 'ESP32-F024F90E449C',
        'reported_device_id' => 'CTUAV-BASE-REAL-001',
        'reported_mountpoint' => 'CTUAV-RTCM-REAL-001',
        'reported_provisioning_state' => 'bootstrap',
        'firmware_version' => '1.1.0',
        'remote_ip' => '192.168.1.50',
        'status' => PendingDevice::STATUS_PENDING,
        'connection_attempts' => 1,
        'first_seen_at' => now(),
        'last_seen_at' => now(),
    ]);
}

test(
    'pending device API requires authentication',
    function (): void {
        $this
            ->getJson('/api/v1/pending-devices')
            ->assertUnauthorized();
    },
);

test(
    'operator can approve device without entering config',
    function (): void {
        config([
            'ntrip.public_host' => '192.168.1.10',
            'ntrip.port' => 2101,
        ]);

        Sanctum::actingAs(
            User::factory()->create(),
        );

        $device = pendingEsp32();

        $this
            ->postJson(
                "/api/v1/pending-devices/{$device->id}/approve",
                [],
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                PendingDevice::STATUS_APPROVED,
            );

        $device->refresh();

        expect($device->station)->not->toBeNull();

        expect($device->station->device_id)
            ->toBe('CTUAV-BASE-REAL-001');

        expect($device->station->mountpoint?->name)
            ->toBe('CTUAV-RTCM-REAL-001');

        expect($device->station->mountpoint?->is_primary)
            ->toBeTrue();

        expect($device->source_token_encrypted)
            ->not->toBeNull();
    },
);

test(
    'operator can reject pending device',
    function (): void {
        Sanctum::actingAs(
            User::factory()->create(),
        );

        $device = pendingEsp32();

        $this
            ->postJson(
                "/api/v1/pending-devices/{$device->id}/reject",
                [
                    'reason' => 'Unknown device',
                ],
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                PendingDevice::STATUS_REJECTED,
            );

        $this->assertDatabaseHas(
            'pending_devices',
            [
                'id' => $device->id,
                'status' => PendingDevice::STATUS_REJECTED,
                'rejection_reason' => 'Unknown device',
            ],
        );
    },
);

test(
    'esp32 sees pending status before approval',
    function (): void {
        config([
            'ntrip.provisioning_key' => 'bootstrap-test-key',
        ]);

        pendingEsp32();

        $this
            ->withHeader(
                'X-Provisioning-Key',
                'bootstrap-test-key',
            )
            ->getJson(
                '/api/v1/device-provisioning/'
                .'ESP32-F024F90E449C',
            )
            ->assertOk()
            ->assertExactJson([
                'status' => 'pending',
            ]);
    },
);

test(
    'approved esp32 receives runtime configuration',
    function (): void {
        config([
            'ntrip.public_host' => '192.168.1.10',
            'ntrip.port' => 2101,
            'ntrip.management_port' => 8000,
            'ntrip.provisioning_key' => 'bootstrap-test-key',
        ]);

        Sanctum::actingAs(
            User::factory()->create(),
        );

        $device = pendingEsp32();

        $this->postJson(
            "/api/v1/pending-devices/{$device->id}/approve",
            [],
        )->assertOk();

        $device->refresh();

        $response = $this
            ->withHeader(
                'X-Provisioning-Key',
                'bootstrap-test-key',
            )
            ->getJson(
                '/api/v1/device-provisioning/'
                .$device->hardware_id,
            )
            ->assertOk()
            ->assertJsonPath(
                'status',
                PendingDevice::STATUS_APPROVED,
            )
            ->assertJsonPath(
                'data.device_id',
                'CTUAV-BASE-REAL-001',
            )
            ->assertJsonPath(
                'data.mountpoint',
                'CTUAV-RTCM-REAL-001',
            )
            ->assertJsonPath(
                'data.caster_host',
                '192.168.1.10',
            );

        $token = $response->json(
            'data.source_token',
        );

        expect($token)->toBeString();

        expect(
            Hash::check(
                $token,
                $device->station->source_token_hash,
            ),
        )->toBeTrue();
    },
);

test(
    'provisioning rejects wrong bootstrap key',
    function (): void {
        config([
            'ntrip.provisioning_key' => 'correct-key',
        ]);

        $this
            ->withHeader(
                'X-Provisioning-Key',
                'wrong-key',
            )
            ->getJson(
                '/api/v1/device-provisioning/'
                .'ESP32-F024F90E449C',
            )
            ->assertForbidden();
    },
);
