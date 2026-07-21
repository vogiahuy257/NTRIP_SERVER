<?php

namespace App\Services\Observability;

/**
 * @phpstan-type MountpointTotals array{
 *     source_bytes: int,
 *     source_chunks: int,
 *     expected_egress_bytes: int,
 *     queued_egress_bytes: int,
 *     written_egress_bytes: int,
 *     partial_writes: int,
 *     zero_writes: int,
 *     write_failures: int
 * }
 * @phpstan-type RoverTotals array{
 *     queued_bytes: int,
 *     written_bytes: int,
 *     partial_writes: int,
 *     zero_writes: int,
 *     write_failures: int
 * }
 */
final class RtcmFlowRealtimeProjector
{
    private ?int $processId = null;

    private ?int $lastSequence = null;

    private ?int $lastEmittedAtUnixMs = null;

    /** @var array<int, MountpointTotals> */
    private array $mountpointTotals = [];

    /** @var array<int, RoverTotals> */
    private array $roverTotals = [];

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>|null
     */
    public function project(
        array $snapshot,
    ): ?array {
        $sequence = $this->positiveInt(
            $snapshot['sequence'] ?? null,
        );

        $emittedAtUnixMs =
            $this->nonNegativeInt(
                $snapshot[
                    'emitted_at_unix_ms'
                ] ?? null,
            );

        $fallbackIntervalMs =
            $this->positiveInt(
                $snapshot['interval_ms']
                    ?? null,
            );

        $mountpoints =
            $this->normaliseItems(
                $snapshot['mountpoints']
                    ?? null,
            );

        $rovers =
            $this->normaliseItems(
                $snapshot['rovers']
                    ?? null,
            );

        if (
            $sequence === null
            || $emittedAtUnixMs === null
            || $fallbackIntervalMs === null
            || $mountpoints === null
            || $rovers === null
        ) {
            return null;
        }

        $processIdValue =
            $snapshot['process_id'] ?? null;

        $processId = is_int($processIdValue)
            ? $processIdValue
            : null;

        $baseline =
            $this->lastSequence === null
            || $processId !== $this->processId
            || $sequence <= $this->lastSequence;

        $intervalMs = $baseline
            ? $fallbackIntervalMs
            : max(
                1,
                $emittedAtUnixMs
                    - (
                        $this->lastEmittedAtUnixMs
                        ?? $emittedAtUnixMs
                            - $fallbackIntervalMs
                    ),
            );

        $sequenceGap = $baseline
            ? 0
            : max(
                0,
                $sequence
                    - (
                        $this->lastSequence
                        ?? $sequence
                    )
                    - 1,
            );

        $nextMountpointTotals = [];
        $projectedMountpoints = [];

        foreach ($mountpoints as $mountpoint) {
            $mountpointId =
                $this->positiveInt(
                    $mountpoint[
                        'mountpoint_id'
                    ] ?? null,
                );

            $currentTotals =
                $this->extractMountpointTotals(
                    $mountpoint,
                );

            if (
                $mountpointId === null
                || $currentTotals === null
            ) {
                continue;
            }

            $previousTotals = $baseline
                ? null
                : (
                    $this->mountpointTotals[
                        $mountpointId
                    ] ?? null
                );

            $nextMountpointTotals[
                $mountpointId
            ] = $currentTotals;

            $sourceBytesDelta =
                $this->delta(
                    $currentTotals[
                        'source_bytes'
                    ],
                    $previousTotals[
                        'source_bytes'
                    ] ?? null,
                );

            $sourceChunksDelta =
                $this->delta(
                    $currentTotals[
                        'source_chunks'
                    ],
                    $previousTotals[
                        'source_chunks'
                    ] ?? null,
                );

            $expectedBytesDelta =
                $this->delta(
                    $currentTotals[
                        'expected_egress_bytes'
                    ],
                    $previousTotals[
                        'expected_egress_bytes'
                    ] ?? null,
                );

            $queuedBytesDelta =
                $this->delta(
                    $currentTotals[
                        'queued_egress_bytes'
                    ],
                    $previousTotals[
                        'queued_egress_bytes'
                    ] ?? null,
                );

            $writtenBytesDelta =
                $this->delta(
                    $currentTotals[
                        'written_egress_bytes'
                    ],
                    $previousTotals[
                        'written_egress_bytes'
                    ] ?? null,
                );

            $interval = is_array(
                $mountpoint['interval']
                    ?? null,
            )
                ? $mountpoint['interval']
                : [];

            $gauges = is_array(
                $mountpoint['gauges']
                    ?? null,
            )
                ? $mountpoint['gauges']
                : [];

            $projectedMountpoints[] = [
                'mountpoint_id' => $mountpointId,

                'source_connected' => (bool) (
                    $mountpoint[
                        'source_connected'
                    ] ?? false
                ),

                'source_bytes_delta' => $sourceBytesDelta,

                'source_bps' => $this->bytesPerSecond(
                    $sourceBytesDelta,
                    $intervalMs,
                ),

                'source_chunks_delta' => $sourceChunksDelta,

                'source_last_received_age_ms' => $this->nullableNonNegativeFloat(
                    $mountpoint[
                        'source_last_received_age_ms'
                    ] ?? null,
                ),

                'source_gap_max_ms' => $this->nonNegativeFloat(
                    $interval[
                        'source_gap_max_ms'
                    ] ?? null,
                ),

                'active_rovers' => $this->nonNegativeInt(
                    $gauges[
                        'active_rovers'
                    ] ?? null,
                ) ?? 0,

                'expected_egress_bytes_delta' => $expectedBytesDelta,

                'queued_egress_bytes_delta' => $queuedBytesDelta,

                'written_egress_bytes_delta' => $writtenBytesDelta,

                'expected_egress_bps' => $this->bytesPerSecond(
                    $expectedBytesDelta,
                    $intervalMs,
                ),

                'queued_egress_bps' => $this->bytesPerSecond(
                    $queuedBytesDelta,
                    $intervalMs,
                ),

                'written_egress_bps' => $this->bytesPerSecond(
                    $writtenBytesDelta,
                    $intervalMs,
                ),

                'fanout_coverage' => $expectedBytesDelta === 0
                        ? null
                        : round(
                            $queuedBytesDelta
                                / $expectedBytesDelta,
                            6,
                        ),

                'socket_drain_ratio' => $expectedBytesDelta === 0
                        ? null
                        : round(
                            $writtenBytesDelta
                                / $expectedBytesDelta,
                            6,
                        ),

                'fanout_count' => $this->nonNegativeInt(
                    $interval[
                        'fanout_count'
                    ] ?? null,
                ) ?? 0,

                'fanout_duration_avg_ms' => $this->nonNegativeFloat(
                    $interval[
                        'fanout_duration_avg_ms'
                    ] ?? null,
                ),

                'fanout_duration_p95_ms' => $this->percentile95(
                    $interval[
                        'fanout_duration_samples_ms'
                    ] ?? null,
                ),

                'fanout_duration_max_ms' => $this->nonNegativeFloat(
                    $interval[
                        'fanout_duration_max_ms'
                    ] ?? null,
                ),

                'backlog_bytes' => $this->nonNegativeInt(
                    $gauges[
                        'total_buffer_bytes'
                    ] ?? null,
                ) ?? 0,

                'maximum_rover_buffer_bytes' => $this->nonNegativeInt(
                    $gauges[
                        'maximum_buffer_bytes'
                    ] ?? null,
                ) ?? 0,

                'maximum_buffer_age_ms' => $this->nonNegativeFloat(
                    $gauges[
                        'maximum_buffer_age_ms'
                    ] ?? null,
                ),

                'partial_writes_delta' => $this->delta(
                    $currentTotals[
                        'partial_writes'
                    ],
                    $previousTotals[
                        'partial_writes'
                    ] ?? null,
                ),

                'zero_writes_delta' => $this->delta(
                    $currentTotals[
                        'zero_writes'
                    ],
                    $previousTotals[
                        'zero_writes'
                    ] ?? null,
                ),

                'write_failures_delta' => $this->delta(
                    $currentTotals[
                        'write_failures'
                    ],
                    $previousTotals[
                        'write_failures'
                    ] ?? null,
                ),
            ];
        }

        $nextRoverTotals = [];
        $projectedRovers = [];

        foreach ($rovers as $rover) {
            $sessionId =
                $this->positiveInt(
                    $rover['session_id']
                        ?? null,
                );

            $mountpointId =
                $this->positiveInt(
                    $rover[
                        'mountpoint_id'
                    ] ?? null,
                );

            $currentTotals =
                $this->extractRoverTotals(
                    $rover,
                );

            if (
                $sessionId === null
                || $mountpointId === null
                || $currentTotals === null
            ) {
                continue;
            }

            $previousTotals = $baseline
                ? null
                : (
                    $this->roverTotals[
                        $sessionId
                    ] ?? null
                );

            $nextRoverTotals[
                $sessionId
            ] = $currentTotals;

            $queuedBytesDelta =
                $this->delta(
                    $currentTotals[
                        'queued_bytes'
                    ],
                    $previousTotals[
                        'queued_bytes'
                    ] ?? null,
                );

            $writtenBytesDelta =
                $this->delta(
                    $currentTotals[
                        'written_bytes'
                    ],
                    $previousTotals[
                        'written_bytes'
                    ] ?? null,
                );

            $gauges = is_array(
                $rover['gauges'] ?? null,
            )
                ? $rover['gauges']
                : [];

            $projectedRovers[] = [
                'session_id' => $sessionId,

                'mountpoint_id' => $mountpointId,

                'queued_bytes_delta' => $queuedBytesDelta,

                'queued_bps' => $this->bytesPerSecond(
                    $queuedBytesDelta,
                    $intervalMs,
                ),

                'written_bytes_delta' => $writtenBytesDelta,

                'written_bps' => $this->bytesPerSecond(
                    $writtenBytesDelta,
                    $intervalMs,
                ),

                'current_buffer_bytes' => $this->nonNegativeInt(
                    $gauges[
                        'current_buffer_bytes'
                    ] ?? null,
                ) ?? 0,

                'current_buffer_age_ms' => $this->nonNegativeFloat(
                    $gauges[
                        'current_buffer_age_ms'
                    ] ?? null,
                ),

                'maximum_buffer_bytes' => $this->nonNegativeInt(
                    $gauges[
                        'maximum_buffer_bytes'
                    ] ?? null,
                ) ?? 0,

                'maximum_buffer_age_ms' => $this->nonNegativeFloat(
                    $gauges[
                        'maximum_buffer_age_ms'
                    ] ?? null,
                ),

                'last_successful_write_age_ms' => $this->nullableNonNegativeFloat(
                    $gauges[
                        'last_successful_write_age_ms'
                    ] ?? null,
                ),

                'partial_writes_delta' => $this->delta(
                    $currentTotals[
                        'partial_writes'
                    ],
                    $previousTotals[
                        'partial_writes'
                    ] ?? null,
                ),

                'zero_writes_delta' => $this->delta(
                    $currentTotals[
                        'zero_writes'
                    ],
                    $previousTotals[
                        'zero_writes'
                    ] ?? null,
                ),

                'write_failures_delta' => $this->delta(
                    $currentTotals[
                        'write_failures'
                    ],
                    $previousTotals[
                        'write_failures'
                    ] ?? null,
                ),
            ];
        }

        $this->processId = $processId;
        $this->lastSequence = $sequence;

        $this->lastEmittedAtUnixMs =
            $emittedAtUnixMs;

        $this->mountpointTotals =
            $nextMountpointTotals;

        $this->roverTotals =
            $nextRoverTotals;

        return [
            'version' => 1,
            'sequence' => $sequence,
            'process_id' => $processId,

            'emitted_at_unix_ms' => $emittedAtUnixMs,

            'interval_ms' => $intervalMs,
            'baseline' => $baseline,
            'sequence_gap' => $sequenceGap,

            'mountpoints' => $projectedMountpoints,

            'rovers' => $projectedRovers,
        ];
    }

    /**
     * @param  array<string, mixed>  $mountpoint
     * @return MountpointTotals|null
     */
    private function extractMountpointTotals(
        array $mountpoint,
    ): ?array {
        $totals = $mountpoint['totals']
            ?? null;

        if (! is_array($totals)) {
            return null;
        }

        return [
            'source_bytes' => $this->nonNegativeInt(
                $totals[
                    'source_bytes'
                ] ?? null,
            ) ?? 0,

            'source_chunks' => $this->nonNegativeInt(
                $totals[
                    'source_chunks'
                ] ?? null,
            ) ?? 0,

            'expected_egress_bytes' => $this->nonNegativeInt(
                $totals[
                    'expected_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'queued_egress_bytes' => $this->nonNegativeInt(
                $totals[
                    'queued_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'written_egress_bytes' => $this->nonNegativeInt(
                $totals[
                    'written_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'partial_writes' => $this->nonNegativeInt(
                $totals[
                    'partial_writes'
                ] ?? null,
            ) ?? 0,

            'zero_writes' => $this->nonNegativeInt(
                $totals[
                    'zero_writes'
                ] ?? null,
            ) ?? 0,

            'write_failures' => $this->nonNegativeInt(
                $totals[
                    'write_failures'
                ] ?? null,
            ) ?? 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $rover
     * @return RoverTotals|null
     */
    private function extractRoverTotals(
        array $rover,
    ): ?array {
        $totals = $rover['totals']
            ?? null;

        if (! is_array($totals)) {
            return null;
        }

        return [
            'queued_bytes' => $this->nonNegativeInt(
                $totals[
                    'queued_bytes'
                ] ?? null,
            ) ?? 0,

            'written_bytes' => $this->nonNegativeInt(
                $totals[
                    'written_bytes'
                ] ?? null,
            ) ?? 0,

            'partial_writes' => $this->nonNegativeInt(
                $totals[
                    'partial_writes'
                ] ?? null,
            ) ?? 0,

            'zero_writes' => $this->nonNegativeInt(
                $totals[
                    'zero_writes'
                ] ?? null,
            ) ?? 0,

            'write_failures' => $this->nonNegativeInt(
                $totals[
                    'write_failures'
                ] ?? null,
            ) ?? 0,
        ];
    }

    private function delta(
        int $current,
        ?int $previous,
    ): int {
        if ($previous === null) {
            return 0;
        }

        return max(
            0,
            $current - $previous,
        );
    }

    private function bytesPerSecond(
        int $bytes,
        int $intervalMs,
    ): int {
        return max(
            0,
            (int) round(
                (
                    $bytes
                    / max(1, $intervalMs)
                ) * 1000,
            ),
        );
    }

    private function percentile95(
        mixed $value,
    ): float {
        if (
            ! is_array($value)
            || ! array_is_list($value)
        ) {
            return 0.0;
        }

        $samples = [];

        foreach ($value as $sample) {
            $number =
                $this->nullableNonNegativeFloat(
                    $sample,
                );

            if ($number !== null) {
                $samples[] = $number;
            }
        }

        if ($samples === []) {
            return 0.0;
        }

        sort(
            $samples,
            SORT_NUMERIC,
        );

        $index = max(
            0,
            (int) ceil(
                count($samples) * 0.95,
            ) - 1,
        );

        return round(
            $samples[$index],
            3,
        );
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function normaliseItems(
        mixed $value,
    ): ?array {
        if (
            ! is_array($value)
            || ! array_is_list($value)
        ) {
            return null;
        }

        $items = [];

        foreach ($value as $item) {
            if (! is_array($item)) {
                return null;
            }

            foreach (array_keys($item) as $key) {
                if (! is_string($key)) {
                    return null;
                }
            }

            /** @var array<string, mixed> $item */
            $items[] = $item;
        }

        return $items;
    }

    private function positiveInt(
        mixed $value,
    ): ?int {
        return is_int($value)
            && $value > 0
                ? $value
                : null;
    }

    private function nonNegativeInt(
        mixed $value,
    ): ?int {
        return is_int($value)
            && $value >= 0
                ? $value
                : null;
    }

    private function nonNegativeFloat(
        mixed $value,
    ): float {
        return $this
            ->nullableNonNegativeFloat(
                $value,
            ) ?? 0.0;
    }

    private function nullableNonNegativeFloat(
        mixed $value,
    ): ?float {
        if (
            ! is_int($value)
            && ! is_float($value)
        ) {
            return null;
        }

        $number = (float) $value;

        if (
            $number < 0
            || ! is_finite($number)
        ) {
            return null;
        }

        return $number;
    }
}
