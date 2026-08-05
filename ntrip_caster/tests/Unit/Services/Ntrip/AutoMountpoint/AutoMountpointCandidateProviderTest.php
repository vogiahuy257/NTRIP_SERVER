<?php

declare(strict_types=1);

use App\Services\Ntrip\AutoMountpoint\AutoMountpointCandidateProvider;

it('returns only enabled mountpoints with connected sources and valid coordinates', function (): void {
    $provider = new AutoMountpointCandidateProvider;

    $candidates = $provider->fromRuntimeCatalog(
        catalog: [
            'BASE_OK' => [
                'mountpoint_id' => 1,
                'name' => 'BASE_OK',
                'latitude' => '10.9800000',
                'longitude' => '106.6740000',
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],

            'BASE_DISCONNECTED' => [
                'mountpoint_id' => 2,
                'name' => 'BASE_DISCONNECTED',
                'latitude' => 10.9900000,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],

            'BASE_DISABLED' => [
                'mountpoint_id' => 3,
                'name' => 'BASE_DISABLED',
                'latitude' => 11.0000000,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => false,
                'station_enabled' => true,
            ],

            'BASE_INVALID_COORDINATE' => [
                'mountpoint_id' => 4,
                'name' => 'BASE_INVALID_COORDINATE',
                'latitude' => 200,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],

            'AUTO' => [
                'mountpoint_id' => 5,
                'name' => 'AUTO',
                'latitude' => 10.9800000,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],
        ],
        connectedMountpoints: [
            'BASE_OK',
            'BASE_DISABLED',
            'BASE_INVALID_COORDINATE',
            'AUTO',
        ],
    );

    expect($candidates)
        ->toHaveCount(1)
        ->and($candidates[0]->mountpointId)
        ->toBe(1)
        ->and($candidates[0]->mountpointName)
        ->toBe('BASE_OK')
        ->and($candidates[0]->latitude)
        ->toBe(10.98)
        ->and($candidates[0]->longitude)
        ->toBe(106.674);
})->group('backend');

it('returns an empty list when no source is connected', function (): void {
    $provider = new AutoMountpointCandidateProvider;

    $candidates = $provider->fromRuntimeCatalog(
        catalog: [
            'BASE_01' => [
                'mountpoint_id' => 1,
                'name' => 'BASE_01',
                'latitude' => 10.9800000,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],
        ],
        connectedMountpoints: [],
    );

    expect($candidates)->toBe([]);
})->group('backend');

it('excludes the configured virtual mountpoint name', function (): void {
    $provider = new AutoMountpointCandidateProvider;

    $candidates = $provider->fromRuntimeCatalog(
        catalog: [
            'NEAREST' => [
                'mountpoint_id' => 10,
                'name' => 'NEAREST',
                'latitude' => 10.9800000,
                'longitude' => 106.6740000,
                'mountpoint_enabled' => true,
                'station_enabled' => true,
            ],
        ],
        connectedMountpoints: ['NEAREST'],
        virtualMountpointName: 'NEAREST',
    );

    expect($candidates)->toBe([]);
})->group('backend');
