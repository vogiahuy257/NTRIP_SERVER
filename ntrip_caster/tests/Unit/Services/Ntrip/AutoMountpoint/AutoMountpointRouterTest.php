<?php

declare(strict_types=1);

use App\Enums\Ntrip\AutoMountpointAction;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointCandidate;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointRouter;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointSelector;

function autoMountpointRouter(): AutoMountpointRouter
{
    return new AutoMountpointRouter(
        selector: new AutoMountpointSelector,
    );
}

it('assigns the nearest base for the initial position', function (): void {
    $decision = autoMountpointRouter()->decide(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        currentMountpointId: null,
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
        serviceRadiusMeters: 10_000,
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::ASSIGN)
        ->and($decision->mountpointId())
        ->toBe(1)
        ->and($decision->reason)
        ->toBe('initial_assignment');
})->group('backend');

it('keeps the current base while rover remains inside its radius', function (): void {
    $decision = autoMountpointRouter()->decide(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        currentMountpointId: 1,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 1,
                mountpointName: 'BASE_CURRENT',
                latitude: 11.0200000,
                longitude: 106.6740000,
            ),
            new AutoMountpointCandidate(
                mountpointId: 2,
                mountpointName: 'BASE_CLOSER',
                latitude: 10.9850000,
                longitude: 106.6740000,
            ),
        ],
        serviceRadiusMeters: 10_000,
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::KEEP)
        ->and($decision->mountpointId())
        ->toBe(1)
        ->and($decision->reason)
        ->toBe('inside_service_radius');
})->group('backend');

it('switches when rover leaves the current base radius', function (): void {
    $decision = autoMountpointRouter()->decide(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        currentMountpointId: 1,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 1,
                mountpointName: 'BASE_CURRENT',
                latitude: 11.0800000,
                longitude: 106.6740000,
            ),
            new AutoMountpointCandidate(
                mountpointId: 2,
                mountpointName: 'BASE_NEXT',
                latitude: 10.9900000,
                longitude: 106.6740000,
            ),
        ],
        serviceRadiusMeters: 10_000,
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::SWITCH)
        ->and($decision->mountpointId())
        ->toBe(2)
        ->and($decision->reason)
        ->toBe('outside_service_radius')
        ->and($decision->currentDistanceMeters)
        ->toBeGreaterThan(10_000);
})->group('backend');

it('switches when the current base becomes unavailable', function (): void {
    $decision = autoMountpointRouter()->decide(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        currentMountpointId: 99,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 2,
                mountpointName: 'BASE_AVAILABLE',
                latitude: 10.9900000,
                longitude: 106.6740000,
            ),
        ],
        serviceRadiusMeters: 10_000,
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::SWITCH)
        ->and($decision->mountpointId())
        ->toBe(2)
        ->and($decision->reason)
        ->toBe('current_base_unavailable');
})->group('backend');

it('waits when no base is available inside the radius', function (): void {
    $decision = autoMountpointRouter()->decide(
        roverLatitude: 10.9800000,
        roverLongitude: 106.6740000,
        currentMountpointId: 1,
        candidates: [
            new AutoMountpointCandidate(
                mountpointId: 1,
                mountpointName: 'BASE_OUTSIDE',
                latitude: 11.1000000,
                longitude: 106.6740000,
            ),
        ],
        serviceRadiusMeters: 10_000,
    );

    expect($decision->action)
        ->toBe(AutoMountpointAction::WAIT)
        ->and($decision->mountpointId())
        ->toBeNull()
        ->and($decision->reason)
        ->toBe('no_available_base');
})->group('backend');
