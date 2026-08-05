<?php

declare(strict_types=1);

use App\Enums\Ntrip\AutoMountpointAction;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointDecision;
use App\Services\Ntrip\AutoMountpoint\AutoMountpointSwitchPolicy;

function switchPolicyDecision(
    AutoMountpointAction $action,
    string $reason,
): AutoMountpointDecision {
    return new AutoMountpointDecision(
        action: $action,
        selection: null,
        currentDistanceMeters: null,
        reason: $reason,
    );
}

it('immediately applies an initial assignment', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::ASSIGN,
            'initial_assignment',
        ),
        currentMountpointId: null,
        outsideSince: null,
        lastSwitchAt: null,
        now: 100,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeTrue()
        ->and($transition->outsideSince)
        ->toBeNull();
})->group('backend');

it('resets outside timer while current base is valid', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::KEEP,
            'inside_service_radius',
        ),
        currentMountpointId: 1,
        outsideSince: 90,
        lastSwitchAt: null,
        now: 100,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeFalse()
        ->and($transition->outsideSince)
        ->toBeNull();
})->group('backend');

it('starts confirmation timer after leaving the radius', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::SWITCH,
            'outside_service_radius',
        ),
        currentMountpointId: 1,
        outsideSince: null,
        lastSwitchAt: null,
        now: 100,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeFalse()
        ->and($transition->outsideSince)
        ->toBe(100);
})->group('backend');

it('switches after confirmation time has passed', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::SWITCH,
            'outside_service_radius',
        ),
        currentMountpointId: 1,
        outsideSince: 100,
        lastSwitchAt: null,
        now: 111,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeTrue();
})->group('backend');

it('blocks switching during cooldown', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::SWITCH,
            'outside_service_radius',
        ),
        currentMountpointId: 1,
        outsideSince: 100,
        lastSwitchAt: 95,
        now: 111,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeFalse()
        ->and($transition->outsideSince)
        ->toBe(100);
})->group('backend');

it('immediately leaves an unavailable base', function (): void {
    $transition = (
        new AutoMountpointSwitchPolicy
    )->evaluate(
        decision: switchPolicyDecision(
            AutoMountpointAction::WAIT,
            'current_base_unavailable',
        ),
        currentMountpointId: 1,
        outsideSince: null,
        lastSwitchAt: 99,
        now: 100,
        confirmationSeconds: 10,
        cooldownSeconds: 30,
    );

    expect($transition->apply)
        ->toBeTrue()
        ->and($transition->outsideSince)
        ->toBeNull();
})->group('backend');
