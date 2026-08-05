<?php

declare(strict_types=1);

use App\Services\Ntrip\AutoMountpoint\AutoMountpointCandidate;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointSelector;

it('selects the nearest base inside the service radius', function (): void {
    $selector = new AutoMountpointSelector;

    $selection = $selector->nearest(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 1,
                mountpointName: 'BASE_NEAR',
                latitude: 10.9900000,
                longitude: 106.6740000,
            ),
            new AutoMountpointCandidate(
                mountpointId: 2,
                mountpointName: 'BASE_FAR',
                latitude: 11.0300000,
                longitude: 106.6740000,
            ),
        ],
        maximumDistanceMeters: 10_000,
    );

    expect($selection)->not->toBeNull()
        ->and($selection?->candidate->mountpointId)->toBe(1)
        ->and($selection?->candidate->mountpointName)->toBe('BASE_NEAR')
        ->and($selection?->distanceMeters)
        ->toBeGreaterThan(1_000)
        ->toBeLessThan(1_200);
})->group('backend');

it('returns null when every base is outside the service radius', function (): void {
    $selector = new AutoMountpointSelector;

    $selection = $selector->nearest(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 1,
                mountpointName: 'BASE_OUTSIDE',
                latitude: 11.1000000,
                longitude: 106.6740000,
            ),
        ],
        maximumDistanceMeters: 10_000,
    );

    expect($selection)->toBeNull();
})->group('backend');

it('returns zero distance for identical coordinates', function (): void {
    $selector = new AutoMountpointSelector;

    $distance = $selector->distanceMeters(
        latitudeA: 10.9801234,
        longitudeA: 106.6745678,
        latitudeB: 10.9801234,
        longitudeB: 106.6745678,
    );

    expect($distance)->toBe(0.0);
})->group('backend');

it('rejects an invalid service radius', function (): void {
    $selector = new AutoMountpointSelector;

    $selector->nearest(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        candidates: [],
        maximumDistanceMeters: 0,
    );
})
    ->throws(
        InvalidArgumentException::class,
        'Maximum distance must be greater than zero.',
    )
    ->group('backend');
