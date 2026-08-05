<?php

declare(strict_types=1);

use App\Models\NtripSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates an auto rover session before a base is assigned', function (): void {
    $session = NtripSession::query()->create([
        'mountpoint_id' => null,
        'requested_mountpoint' => 'AUTO',
        'auto_mountpoint' => true,
        'mountpoint_switch_count' => 0,

        'connection_type' => NtripSession::TYPE_ROVER,
        'authenticated_username' => 'rover-auto',
        'remote_ip' => '127.0.0.1',
        'connected_at' => now(),
        'bytes_transferred' => 0,
    ]);

    $session->refresh();

    expect($session->mountpoint_id)
        ->toBeNull()
        ->and($session->requested_mountpoint)
        ->toBe('AUTO')
        ->and($session->auto_mountpoint)
        ->toBeTrue()
        ->and($session->mountpoint_switch_count)
        ->toBe(0)
        ->and($session->last_mountpoint_switch_at)
        ->toBeNull();
})->group('backend');

it('keeps normal rover sessions compatible', function (): void {
    $session = NtripSession::query()->create([
        'mountpoint_id' => null,
        'requested_mountpoint' => 'BASE_01',
        'auto_mountpoint' => false,

        'connection_type' => NtripSession::TYPE_ROVER,
        'remote_ip' => '127.0.0.2',
        'connected_at' => now(),
        'bytes_transferred' => 0,
    ]);
    $session->refresh();

    expect($session->auto_mountpoint)
        ->toBeFalse()
        ->and($session->mountpoint_switch_count)
        ->toBe(0);
})->group('backend');
