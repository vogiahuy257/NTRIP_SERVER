<?php

use App\Models\Alert;
use App\Models\Station;
use App\Models\User;
use App\Services\Alerts\AlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it(
    'opens touches acknowledges resolves and reopens an alert',
    function (): void {
        $station =
            Station::query()->create([
                'device_id' => 'CTUAV-ALERT-001',

                'name' => 'Alert Test Station',

                'enabled' => true,

                'source_token_hash' => Hash::make(
                    'alert-test-token',
                ),

                'source_connected' => false,
            ]);

        $service = app(
            AlertService::class,
        );

        $fingerprint =
            'source_disconnected:station:'.
            $station->id;

        $first = $service->openOrTouch(
            type: Alert::TYPE_SOURCE_DISCONNECTED,

            severity: Alert::SEVERITY_CRITICAL,

            fingerprint: $fingerprint,

            title: 'Source disconnected',

            message: 'The station source connection is unavailable.',

            stationId: $station->id,

            metadata: [
                'offline_seconds' => 10,
            ],
        );

        expect($first->status)
            ->toBe(Alert::STATUS_OPEN)
            ->and($first->active_key)
            ->toBe($fingerprint)
            ->and($first->occurrence_count)
            ->toBe(1);

        $second = $service->openOrTouch(
            type: Alert::TYPE_SOURCE_DISCONNECTED,

            severity: Alert::SEVERITY_CRITICAL,

            fingerprint: $fingerprint,

            title: 'Source disconnected',

            message: 'The station source connection is unavailable.',

            stationId: $station->id,

            metadata: [
                'offline_seconds' => 20,
            ],
        );

        expect($second->id)
            ->toBe($first->id)
            ->and($second->occurrence_count)
            ->toBe(2)
            ->and(
                Alert::query()->count(),
            )
            ->toBe(1);

        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $acknowledged =
            $service->acknowledge(
                alert: $second,
                user: $user,
            );

        expect($acknowledged->status)
            ->toBe(
                Alert::STATUS_ACKNOWLEDGED,
            )
            ->and(
                $acknowledged
                    ->acknowledged_by_user_id,
            )
            ->toBe($user->id)
            ->and(
                $acknowledged
                    ->acknowledged_at,
            )
            ->not
            ->toBeNull();

        $resolved =
            $service
                ->resolveByFingerprint(
                    fingerprint: $fingerprint,

                    resolutionNote: 'Source connection recovered.',
                );

        expect($resolved)
            ->not
            ->toBeNull()
            ->and($resolved->status)
            ->toBe(
                Alert::STATUS_RESOLVED,
            )
            ->and($resolved->active_key)
            ->toBeNull()
            ->and($resolved->resolved_at)
            ->not
            ->toBeNull();

        $reopened =
            $service->openOrTouch(
                type: Alert::TYPE_SOURCE_DISCONNECTED,

                severity: Alert::SEVERITY_CRITICAL,

                fingerprint: $fingerprint,

                title: 'Source disconnected',

                message: 'The source connection failed again.',

                stationId: $station->id,
            );

        expect($reopened->id)
            ->not
            ->toBe($first->id)
            ->and($reopened->status)
            ->toBe(Alert::STATUS_OPEN)
            ->and(
                Alert::query()->count(),
            )
            ->toBe(2);
    },
)->group('backend');
