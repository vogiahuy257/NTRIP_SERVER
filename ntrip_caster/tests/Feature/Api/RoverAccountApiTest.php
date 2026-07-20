<?php

use App\Models\Mountpoint;
use App\Models\RoverAccount;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

pest()->group('backend');

function createTestMountpoint(
    string $deviceId,
    string $mountpointName
): Mountpoint {
    $station = Station::query()->create([
        'device_id' => $deviceId,
        'name' => "Station {$deviceId}",
        'enabled' => true,
        'source_token_hash' => Hash::make('source-token-test'),
        'source_connected' => false,
    ]);

    return $station->mountpoints()->create([
        'name' => $mountpointName,
        'identifier' => $mountpointName,
        'format' => 'RTCM 3.3',
        'nav_system' => 'GPS+GLO+GAL+BDS',
        'country' => 'VNM',
        'enabled' => true,
        'is_primary' => true,
        'access_mode' => 'authenticated',
    ]);
}

test(
    'unauthenticated user cannot access rover account API',
    function (): void {
        $this
            ->getJson('/api/v1/rover-accounts')
            ->assertUnauthorized();
    }
);

test(
    'administrator can create rover account',
    function (): void {
        Sanctum::actingAs(
            User::factory()->create()
        );

        $response = $this->postJson(
            '/api/v1/rover-accounts',
            [
                'username' => 'rover-uav-001',
                'display_name' => 'UAV Rover 001',
                'password' => 'StrongPassword@123',
                'password_confirmation' => 'StrongPassword@123',
                'enabled' => true,
                'max_connections' => 2,
            ]
        );

        $response
            ->assertCreated()
            ->assertJsonPath(
                'data.username',
                'rover-uav-001'
            )
            ->assertJsonMissingPath(
                'data.password_hash'
            );

        $account = RoverAccount::query()
            ->where(
                'username',
                'rover-uav-001'
            )
            ->firstOrFail();

        expect(
            Hash::check(
                'StrongPassword@123',
                $account->password_hash
            )
        )->toBeTrue();
    }
);

test(
    'administrator can assign multiple mountpoints',
    function (): void {
        Sanctum::actingAs(
            User::factory()->create()
        );

        $account = RoverAccount::query()->create([
            'username' => 'rover-team-a',
            'display_name' => 'Rover Team A',
            'password_hash' => Hash::make('StrongPassword@123'),
            'enabled' => true,
            'max_connections' => 3,
        ]);

        $first = createTestMountpoint(
            'TEST-BASE-001',
            'TEST-RTCM-001'
        );

        $second = createTestMountpoint(
            'TEST-BASE-002',
            'TEST-RTCM-002'
        );

        $response = $this->putJson(
            '/api/v1/rover-accounts/'
                ."{$account->id}/mountpoints",
            [
                'mountpoints' => [
                    [
                        'id' => $first->id,
                        'enabled' => true,
                        'max_connections' => 1,
                    ],
                    [
                        'id' => $second->id,
                        'enabled' => true,
                        'max_connections' => 2,
                    ],
                ],
            ]
        );

        $response
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertDatabaseHas(
            'mountpoint_rover_account',
            [
                'rover_account_id' => $account->id,
                'mountpoint_id' => $first->id,
                'enabled' => true,
                'max_connections' => 1,
            ]
        );

        $this->assertDatabaseHas(
            'mountpoint_rover_account',
            [
                'rover_account_id' => $account->id,
                'mountpoint_id' => $second->id,
                'enabled' => true,
                'max_connections' => 2,
            ]
        );
    }
);

test(
    'mountpoint limit cannot exceed account limit',
    function (): void {
        Sanctum::actingAs(
            User::factory()->create()
        );

        $account = RoverAccount::query()->create([
            'username' => 'limited-rover',
            'password_hash' => Hash::make('StrongPassword@123'),
            'enabled' => true,
            'max_connections' => 1,
        ]);

        $mountpoint = createTestMountpoint(
            'TEST-BASE-003',
            'TEST-RTCM-003'
        );

        $this->putJson(
            '/api/v1/rover-accounts/'
                ."{$account->id}/mountpoints",
            [
                'mountpoints' => [
                    [
                        'id' => $mountpoint->id,
                        'enabled' => true,
                        'max_connections' => 2,
                    ],
                ],
            ]
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'mountpoints.0.max_connections',
            ]);
    }
);
