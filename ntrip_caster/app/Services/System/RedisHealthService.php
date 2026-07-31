<?php

namespace App\Services\System;

use Illuminate\Contracts\Queue\Queue as QueueContract;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Throwable;

class RedisHealthService
{
    /**
     * Return a production-safe Redis health snapshot.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        if (! config('redis-monitoring.enabled', true)) {
            return [
                'status' => 'disabled',
                'available' => false,
            ];
        }

        $startedAt = hrtime(true);

        try {
            $connection = Redis::connection('default');

            $pong = $connection->command('ping', []);

            $latencyMs = round(
                (hrtime(true) - $startedAt) / 1_000_000,
                2,
            );

            $info = $connection->command('info', []);

            if (! is_array($info)) {
                $info = [];
            }

            $queues = $this->queueSizes();
            $databases = $this->databaseSizes();

            $usedMemory = (int) (
                $info['used_memory'] ?? 0
            );

            $maxMemory = (int) (
                $info['maxmemory'] ?? 0
            );

            $memoryUsagePercent = $maxMemory > 0
                ? round(
                    ($usedMemory / $maxMemory) * 100,
                    2,
                )
                : null;

            $status = $this->resolveStatus(
                latencyMs: $latencyMs,
                memoryUsagePercent: $memoryUsagePercent,
                queues: $queues,
            );

            return [
                'status' => $status,

                'available' => $this->isPong(
                    $pong,
                ),

                'latency_ms' => $latencyMs,

                'server' => [
                    'version' => $info[
                        'redis_version'
                    ] ?? null,

                    'uptime_seconds' => (int) (
                        $info['uptime_in_seconds'] ?? 0
                    ),
                ],

                'memory' => [
                    'used_bytes' => $usedMemory,

                    'used_human' => $info[
                        'used_memory_human'
                    ] ?? null,

                    'max_bytes' => $maxMemory,

                    'max_human' => $info[
                        'maxmemory_human'
                    ] ?? null,

                    'usage_percent' => $memoryUsagePercent,

                    'policy' => $info[
                        'maxmemory_policy'
                    ] ?? null,

                    'fragmentation_ratio' => isset(
                        $info[
                            'mem_fragmentation_ratio'
                        ],
                    )
                            ? (float) $info[
                                'mem_fragmentation_ratio'
                            ]
                            : null,
                ],

                'clients' => [
                    'connected' => (int) (
                        $info['connected_clients'] ?? 0
                    ),

                    'blocked' => (int) (
                        $info['blocked_clients'] ?? 0
                    ),
                ],

                'operations' => [
                    'commands_total' => (int) (
                        $info[
                            'total_commands_processed'
                        ] ?? 0
                    ),

                    'operations_per_second' => (int) (
                        $info[
                            'instantaneous_ops_per_sec'
                        ] ?? 0
                    ),

                    'rejected_connections' => (int) (
                        $info[
                            'rejected_connections'
                        ] ?? 0
                    ),

                    'expired_keys' => (int) (
                        $info['expired_keys'] ?? 0
                    ),

                    'evicted_keys' => (int) (
                        $info['evicted_keys'] ?? 0
                    ),
                ],

                'databases' => $databases,
                'queues' => $queues,

                'checked_at' => now()
                    ->toIso8601String(),
            ];
        } catch (Throwable $exception) {
            report($exception);

            return [
                'status' => 'unavailable',
                'available' => false,

                'latency_ms' => round(
                    (hrtime(true) - $startedAt)
                        / 1_000_000,
                    2,
                ),

                'error' => 'redis_unavailable',

                'checked_at' => now()
                    ->toIso8601String(),
            ];
        }
    }

    /**
     * @return array<string, int>
     */
    protected function databaseSizes(): array
    {
        $connections = [
            'default',
            'cache',
            'queue',
            'session',
        ];

        $sizes = [];

        foreach ($connections as $connectionName) {
            $size = Redis::connection(
                $connectionName,
            )->command('dbsize', []);

            $sizes[$connectionName] = (int) $size;
        }

        return $sizes;
    }

    /**
     * @return array<string, int>
     */
    protected function queueSizes(): array
    {
        /** @var QueueContract $queue */
        $queue = Queue::connection('redis');

        return [
            'realtime' => $queue->size(
                'realtime',
            ),

            'alerts' => $queue->size(
                'alerts',
            ),

            'default' => $queue->size(
                'default',
            ),
        ];
    }

    /**
     * @param  array<string, int>  $queues
     */
    protected function resolveStatus(
        float $latencyMs,
        ?float $memoryUsagePercent,
        array $queues,
    ): string {
        $largestQueue = $queues === []
            ? 0
            : max($queues);

        if (
            $latencyMs >= (float) config(
                'redis-monitoring.latency_critical_ms',
                100,
            )
            || (
                $memoryUsagePercent !== null
                && $memoryUsagePercent >= (float) config(
                    'redis-monitoring.memory_critical_percent',
                    85,
                )
            )
            || $largestQueue >= (int) config(
                'redis-monitoring.queue_critical_size',
                500,
            )
        ) {
            return 'critical';
        }

        if (
            $latencyMs >= (float) config(
                'redis-monitoring.latency_warning_ms',
                25,
            )
            || (
                $memoryUsagePercent !== null
                && $memoryUsagePercent >= (float) config(
                    'redis-monitoring.memory_warning_percent',
                    70,
                )
            )
            || $largestQueue >= (int) config(
                'redis-monitoring.queue_warning_size',
                100,
            )
        ) {
            return 'warning';
        }

        return 'healthy';
    }

    protected function isPong(mixed $pong): bool
    {
        return $pong === true
            || strtoupper(
                ltrim((string) $pong, '+'),
            ) === 'PONG';
    }
}
