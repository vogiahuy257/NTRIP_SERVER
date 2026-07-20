<?php

use App\Models\Alert;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

function createAlertApiStation(): Station
{
    return Station::query()->create([
        'device_id' => 'CTUAV-ALERT-API-001',

        'name' => 'Alert API Station',

        'enabled' => true,

        'source_token_hash' => Hash::make(
            'alert-api-token',
        ),

        'source_connected' => false,
    ]);
}

it(
    'requires authentication for alert api',
    function (): void {
        $this
            ->getJson('/api/v1/alerts')
            ->assertUnauthorized();

        $this
            ->getJson(
                '/api/v1/alerts/summary',
            )
            ->assertUnauthorized();
    },
)->group('backend');

it(
    'lists and acknowledges active alerts',
    function (): void {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $station =
            createAlertApiStation();

        $alert =
            Alert::query()->create([
                'station_id' => $station->id,

                'type' => Alert::TYPE_SOURCE_DISCONNECTED,

                'severity' => Alert::SEVERITY_CRITICAL,

                'status' => Alert::STATUS_OPEN,

                'fingerprint' => 'source_disconnected:station:'.
                    $station->id,

                'active_key' => 'source_disconnected:station:'.
                    $station->id,

                'title' => 'Source disconnected',

                'message' => 'The source is unavailable.',

                'metadata' => [],

                'occurrence_count' => 1,

                'opened_at' => now(),

                'last_observed_at' => now(),
            ]);

        $this->actingAs($user);

        $this
            ->getJson(
                '/api/v1/alerts?status=active',
            )
            ->assertOk()
            ->assertJsonPath(
                'meta.total',
                1,
            )
            ->assertJsonPath(
                'data.0.id',
                $alert->id,
            )
            ->assertJsonPath(
                'data.0.severity',
                Alert::SEVERITY_CRITICAL,
            )
            ->assertJsonPath(
                'data.0.station.device_id',
                $station->device_id,
            );

        $this
            ->getJson(
                '/api/v1/alerts/summary',
            )
            ->assertOk()
            ->assertJsonPath(
                'data.active',
                1,
            )
            ->assertJsonPath(
                'data.unacknowledged',
                1,
            )
            ->assertJsonPath(
                'data.critical',
                1,
            )
            ->assertJsonPath(
                'data.highest_severity',
                Alert::SEVERITY_CRITICAL,
            );

        $this
            ->postJson(
                "/api/v1/alerts/{$alert->id}/acknowledge",
            )
            ->assertOk()
            ->assertJsonPath(
                'data.status',
                Alert::STATUS_ACKNOWLEDGED,
            )
            ->assertJsonPath(
                'data.acknowledged_by.id',
                $user->id,
            );

        $this->assertDatabaseHas(
            'alerts',
            [
                'id' => $alert->id,

                'status' => Alert::STATUS_ACKNOWLEDGED,

                'acknowledged_by_user_id' => $user->id,
            ],
        );
    },
)->group('backend');
