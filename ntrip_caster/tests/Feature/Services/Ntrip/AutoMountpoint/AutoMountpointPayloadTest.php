<?php

declare(strict_types=1);

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Services\Ntrip\Sessions\NtripSessionPayloadFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

it('exposes complete AUTO mountpoint state for realtime clients', function (): void {
    $account = RoverAccount::factory()->create();

    $session = NtripSession::query()->create([
        'mountpoint_id' => null,
        'requested_mountpoint' => 'AUTO',
        'auto_mountpoint' => true,
        'mountpoint_switch_count' => 0,
        'connection_type' => NtripSession::TYPE_ROVER,
        'rover_account_id' => $account->id,
        'authenticated_username' => $account->username,
        'remote_ip' => '127.0.0.1',
        'connected_at' => now(),
        'bytes_transferred' => 0,
    ]);

    $factory = app(NtripSessionPayloadFactory::class);

    expect($factory->make($session->fresh()))
        ->toMatchArray([
            'requested_mountpoint' => 'AUTO',
            'auto_mountpoint' => true,
            'auto_state' => 'waiting_for_gga',
            'mountpoint_switch_count' => 0,
            'mountpoint_id' => null,
        ]);

    $session->forceFill([
        'rover_latitude' => 10.98,
        'rover_longitude' => 106.674,
        'rover_position_received_at' => now(),
    ])->save();

    expect($factory->make($session->fresh())['auto_state'])
        ->toBe('waiting_for_base');

    $mountpoint = Mountpoint::factory()->create([
        'name' => 'BASE_SELECTED',
    ]);

    $session->forceFill([
        'mountpoint_id' => $mountpoint->id,
        'mountpoint_switch_count' => 2,
        'last_mountpoint_switch_at' => now(),
    ])->save();

    $payload = $factory->make($session->fresh());

    expect($payload)
        ->toMatchArray([
            'auto_state' => 'assigned',
            'mountpoint_id' => $mountpoint->id,
            'mountpoint_switch_count' => 2,
        ])
        ->and($payload['mountpoint']['name'])
        ->toBe('BASE_SELECTED')
        ->and($payload['last_mountpoint_switch_at'])
        ->not->toBeNull();
});
