<?php

use App\Models\User;
use App\Services\System\RedisHealthService;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;

uses()->group('backend');

it('requires authentication for system status', function (): void {
    $this->getJson('/api/v1/system/status')
        ->assertUnauthorized();
});

it('returns Redis health in system status', function (): void {
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    Sanctum::actingAs($user);

    $this->mock(
        RedisHealthService::class,
        function (MockInterface $mock): void {
            $mock->shouldReceive('snapshot')
                ->once()
                ->andReturn([
                    'status' => 'healthy',
                    'available' => true,
                    'latency_ms' => 0.42,

                    'memory' => [
                        'used_bytes' => 4_194_304,
                        'max_bytes' => 268_435_456,
                        'usage_percent' => 1.56,
                        'policy' => 'noeviction',
                    ],

                    'databases' => [
                        'default' => 1,
                        'cache' => 5,
                        'queue' => 0,
                        'session' => 2,
                    ],

                    'queues' => [
                        'realtime' => 0,
                        'alerts' => 0,
                        'default' => 0,
                    ],
                ]);
        },
    );

    $this->getJson('/api/v1/system/status')
        ->assertOk()
        ->assertJsonPath(
            'success',
            true,
        )
        ->assertJsonPath(
            'redis.status',
            'healthy',
        )
        ->assertJsonPath(
            'redis.available',
            true,
        )
        ->assertJsonPath(
            'redis.memory.policy',
            'noeviction',
        )
        ->assertJsonPath(
            'redis.queues.realtime',
            0,
        )
        ->assertJsonPath(
            'redis.databases.session',
            2,
        );
});
