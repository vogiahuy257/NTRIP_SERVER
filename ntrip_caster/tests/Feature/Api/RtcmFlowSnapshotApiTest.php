<?php

use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test(
    'RTCM flow snapshot API requires authentication',
    function (): void {
        $this->getJson(
            '/api/v1/observability/rtcm-flow/snapshot',
        )->assertUnauthorized();
    },
)->group('backend');

test(
    'it returns the latest RTCM flow snapshot',
    function (): void {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $snapshot = [
            'version' => 1,
            'sequence' => 20,
            'process_id' => 100,
            'emitted_at_unix_ms' => 1000,
            'interval_ms' => 1000,
            'baseline' => false,
            'sequence_gap' => 0,
            'mountpoints' => [],
            'rovers' => [],
        ];

        $store = new class($snapshot) implements RtcmFlowLatestSnapshotStore
        {
            /**
             * @param  array<string, mixed>  $snapshot
             */
            public function __construct(
                private array $snapshot,
            ) {}

            public function put(
                array $snapshot,
            ): void {
                $this->snapshot = $snapshot;
            }

            public function get(): ?array
            {
                return $this->snapshot;
            }
        };

        $this->app->instance(
            RtcmFlowLatestSnapshotStore::class,
            $store,
        );

        $this->getJson(
            '/api/v1/observability/rtcm-flow/snapshot',
        )
            ->assertOk()
            ->assertJsonPath(
                'success',
                true,
            )
            ->assertJsonPath(
                'meta.available',
                true,
            )
            ->assertJsonPath(
                'data.sequence',
                20,
            )
            ->assertJsonPath(
                'data.version',
                1,
            );
    },
)->group('backend');
