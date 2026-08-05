<?php

declare(strict_types=1);

use App\Enums\Ntrip\AutoMountpointAction;
use App\Models\Mountpoint;
use App\Models\RoverAccount;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointCoordinator;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

/**
 * @return array{
 *     0: RoverAccount,
 *     1: Mountpoint,
 *     2: Mountpoint,
 *     3: array<string, array<string, mixed>>
 * }
 */
function autoCapacityFixture(
    ?int $nearMountpointLimit = null,
    ?int $nearGrantLimit = null,
): array {
    $near = Mountpoint::factory()->create([
        'name' => 'BASE_NEAR',
        'enabled' => true,
        'latitude' => 10.9800000,
        'longitude' => 106.6740000,
        'max_rover_connections' => $nearMountpointLimit,
    ]);

    $far = Mountpoint::factory()->create([
        'name' => 'BASE_FAR',
        'enabled' => true,
        'latitude' => 10.9900000,
        'longitude' => 106.6740000,
        'max_rover_connections' => null,
    ]);

    $account = RoverAccount::factory()->create();

    $account->mountpoints()->attach($near->id, [
        'enabled' => true,
        'max_connections' => $nearGrantLimit,
        'starts_at' => null,
        'expires_at' => null,
    ]);

    $account->mountpoints()->attach($far->id, [
        'enabled' => true,
        'max_connections' => null,
        'starts_at' => null,
        'expires_at' => null,
    ]);

    $catalog = [
        $near->name => [
            'mountpoint_id' => $near->id,
            'name' => $near->name,
            'latitude' => $near->latitude,
            'longitude' => $near->longitude,
            'mountpoint_enabled' => true,
            'station_enabled' => true,
        ],
        $far->name => [
            'mountpoint_id' => $far->id,
            'name' => $far->name,
            'latitude' => $far->latitude,
            'longitude' => $far->longitude,
            'mountpoint_enabled' => true,
            'station_enabled' => true,
        ],
    ];

    return [$account, $near, $far, $catalog];
}

it('skips a full nearest mountpoint and selects the next eligible base', function (): void {
    [$account, $near, $far, $catalog] = autoCapacityFixture(
        nearMountpointLimit: 1,
    );

    $decision = app(AutoMountpointCoordinator::class)->decide(
        roverAccountId: $account->id,
        roverLatitude: 10.9801000,
        roverLongitude: 106.6740000,
        currentMountpointId: null,
        catalog: $catalog,
        connectedMountpoints: [$near->name, $far->name],
        activeMountpointCounts: [$near->id => 1],
        activeGrantCounts: [],
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::ASSIGN)
        ->and($decision->mountpointId())
        ->toBe($far->id);
});

it('skips a Base when the account grant connection limit is full', function (): void {
    [$account, $near, $far, $catalog] = autoCapacityFixture(
        nearGrantLimit: 1,
    );

    $decision = app(AutoMountpointCoordinator::class)->decide(
        roverAccountId: $account->id,
        roverLatitude: 10.9801000,
        roverLongitude: 106.6740000,
        currentMountpointId: null,
        catalog: $catalog,
        connectedMountpoints: [$near->name, $far->name],
        activeMountpointCounts: [],
        activeGrantCounts: [$near->id => 1],
    );

    expect($decision->mountpointId())
        ->toBe($far->id);
});

it('keeps the current Base even when its capacity is fully occupied', function (): void {
    [$account, $near, $far, $catalog] = autoCapacityFixture(
        nearMountpointLimit: 1,
        nearGrantLimit: 1,
    );

    $decision = app(AutoMountpointCoordinator::class)->decide(
        roverAccountId: $account->id,
        roverLatitude: 10.9801000,
        roverLongitude: 106.6740000,
        currentMountpointId: $near->id,
        catalog: $catalog,
        connectedMountpoints: [$near->name, $far->name],
        activeMountpointCounts: [$near->id => 1],
        activeGrantCounts: [$near->id => 1],
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::KEEP)
        ->and($decision->mountpointId())
        ->toBe($near->id);
});
