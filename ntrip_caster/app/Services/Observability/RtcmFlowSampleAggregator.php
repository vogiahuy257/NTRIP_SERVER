<?php

namespace App\Services\Observability;

use InvalidArgumentException;

/**
 * @phpstan-type CounterTotals array{
 *     source_bytes: int,
 *     source_chunks: int,
 *     expected_egress_bytes: int,
 *     queued_egress_bytes: int,
 *     written_egress_bytes: int,
 *     partial_writes: int,
 *     zero_writes: int,
 *     write_failures: int
 * }
 * @phpstan-type SampleWindow array{
 *     started_at_unix_ms: int,
 *     ended_at_unix_ms: int,
 *     source_connected: bool,
 *     source_bytes_delta: int,
 *     source_chunks_delta: int,
 *     source_last_received_age_ms: float|null,
 *     source_gap_max_ms: float,
 *     active_rovers: int,
 *     expected_egress_bytes_delta: int,
 *     queued_egress_bytes_delta: int,
 *     written_egress_bytes_delta: int,
 *     fanout_count: int,
 *     fanout_duration_weighted_total_ms: float,
 *     fanout_duration_samples_ms: list<float>,
 *     fanout_duration_max_ms: float,
 *     backlog_bytes: int,
 *     maximum_rover_buffer_bytes: int,
 *     maximum_buffer_age_ms: float,
 *     partial_writes_delta: int,
 *     zero_writes_delta: int,
 *     write_failures_delta: int
 * }
 */
final class RtcmFlowSampleAggregator
{
    private int $sampleIntervalMs;

    private ?int $processId = null;

    private ?int $lastSequence = null;

    private ?int $lastEmittedAtUnixMs = null;

    /** @var array<int, CounterTotals> */
    private array $previousTotals = [];

    /** @var array<int, SampleWindow> */
    private array $windows = [];

    public function __construct(
        int $sampleIntervalSeconds,
    ) {
        if ($sampleIntervalSeconds < 1) {
            throw new InvalidArgumentException(
                'RTCM flow database sample interval must be positive.',
            );
        }

        $this->sampleIntervalMs =
            $sampleIntervalSeconds * 1000;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    public function push(
        array $snapshot,
    ): array {
        $sequence = $this->positiveInt(
            $snapshot['sequence'] ?? null,
        );

        $emittedAtUnixMs = $this->nonNegativeInt(
            $snapshot['emitted_at_unix_ms']
                ?? null,
        );

        $fallbackIntervalMs =
            $this->positiveInt(
                $snapshot['interval_ms']
                    ?? null,
            ) ?? 1000;

        $processId = $this->nullableInt(
            $snapshot['process_id'] ?? null,
        );

        $mountpoints =
            $this->normaliseItems(
                $snapshot['mountpoints']
                    ?? null,
            );

        if (
            $sequence === null
            || $emittedAtUnixMs === null
            || $mountpoints === null
        ) {
            return [];
        }

        $mustReset =
            $this->lastSequence === null
            || $processId !== $this->processId
            || $sequence <= $this->lastSequence;

        if ($mustReset) {
            $this->resetState(
                processId: $processId,
                sequence: $sequence,
                emittedAtUnixMs: $emittedAtUnixMs,
            );

            $this->seedBaselines(
                $mountpoints,
            );

            return [];
        }

        $previousEmittedAtUnixMs =
            $this->lastEmittedAtUnixMs
            ?? max(
                0,
                $emittedAtUnixMs
                    - $fallbackIntervalMs,
            );

        $snapshotIntervalMs = max(
            1,
            $emittedAtUnixMs
                - $previousEmittedAtUnixMs,
        );

        $readySamples = [];

        foreach ($mountpoints as $mountpoint) {
            $mountpointId =
                $this->positiveInt(
                    $mountpoint[
                        'mountpoint_id'
                    ] ?? null,
                );

            $currentTotals =
                $this->extractTotals(
                    $mountpoint,
                );

            if (
                $mountpointId === null
                || $currentTotals === null
            ) {
                continue;
            }

            $previousTotals =
                $this->previousTotals[
                    $mountpointId
                ] ?? null;

            $this->previousTotals[
                $mountpointId
            ] = $currentTotals;

            if ($previousTotals === null) {
                continue;
            }

            $deltas = $this->deltaTotals(
                current: $currentTotals,
                previous: $previousTotals,
            );

            $window =
                $this->windows[
                    $mountpointId
                ]
                ?? $this->newWindow(
                    emittedAtUnixMs: $emittedAtUnixMs,
                    intervalMs: $snapshotIntervalMs,
                );

            $window = $this->absorb(
                window: $window,
                mountpoint: $mountpoint,
                deltas: $deltas,
                emittedAtUnixMs: $emittedAtUnixMs,
            );

            if (
                $this->sampleIntervalMs
                <= $window['ended_at_unix_ms']
                    - $window[
                        'started_at_unix_ms'
                    ]
            ) {
                $readySamples[] =
                    $this->finishWindow(
                        mountpointId: $mountpointId,
                        window: $window,
                    );

                unset(
                    $this->windows[
                        $mountpointId
                    ],
                );

                continue;
            }

            $this->windows[
                $mountpointId
            ] = $window;
        }

        $this->processId = $processId;
        $this->lastSequence = $sequence;

        $this->lastEmittedAtUnixMs =
            $emittedAtUnixMs;

        return $readySamples;
    }

    /**
     * @param  list<array<string, mixed>>  $mountpoints
     */
    private function seedBaselines(
        array $mountpoints,
    ): void {
        foreach ($mountpoints as $mountpoint) {
            $mountpointId =
                $this->positiveInt(
                    $mountpoint[
                        'mountpoint_id'
                    ] ?? null,
                );

            $totals = $this->extractTotals(
                $mountpoint,
            );

            if (
                $mountpointId === null
                || $totals === null
            ) {
                continue;
            }

            $this->previousTotals[
                $mountpointId
            ] = $totals;
        }
    }

    private function resetState(
        ?int $processId,
        int $sequence,
        int $emittedAtUnixMs,
    ): void {
        $this->processId = $processId;
        $this->lastSequence = $sequence;

        $this->lastEmittedAtUnixMs =
            $emittedAtUnixMs;

        $this->previousTotals = [];
        $this->windows = [];
    }

    /**
     * @param  array<string, mixed>  $mountpoint
     * @return CounterTotals|null
     */
    private function extractTotals(
        array $mountpoint,
    ): ?array {
        $value = $mountpoint['totals']
            ?? null;

        if (! is_array($value)) {
            return null;
        }

        return [
            'source_bytes' => $this->nonNegativeInt(
                $value['source_bytes']
                    ?? null,
            ) ?? 0,

            'source_chunks' => $this->nonNegativeInt(
                $value['source_chunks']
                    ?? null,
            ) ?? 0,

            'expected_egress_bytes' => $this->nonNegativeInt(
                $value[
                    'expected_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'queued_egress_bytes' => $this->nonNegativeInt(
                $value[
                    'queued_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'written_egress_bytes' => $this->nonNegativeInt(
                $value[
                    'written_egress_bytes'
                ] ?? null,
            ) ?? 0,

            'partial_writes' => $this->nonNegativeInt(
                $value['partial_writes']
                    ?? null,
            ) ?? 0,

            'zero_writes' => $this->nonNegativeInt(
                $value['zero_writes']
                    ?? null,
            ) ?? 0,

            'write_failures' => $this->nonNegativeInt(
                $value['write_failures']
                    ?? null,
            ) ?? 0,
        ];
    }

    /**
     * @param  CounterTotals  $current
     * @param  CounterTotals  $previous
     * @return CounterTotals
     */
    private function deltaTotals(
        array $current,
        array $previous,
    ): array {
        return [
            'source_bytes' => max(
                0,
                $current['source_bytes']
                    - $previous['source_bytes'],
            ),

            'source_chunks' => max(
                0,
                $current['source_chunks']
                    - $previous['source_chunks'],
            ),

            'expected_egress_bytes' => max(
                0,
                $current[
                    'expected_egress_bytes'
                ] - $previous[
                    'expected_egress_bytes'
                ],
            ),

            'queued_egress_bytes' => max(
                0,
                $current[
                    'queued_egress_bytes'
                ] - $previous[
                    'queued_egress_bytes'
                ],
            ),

            'written_egress_bytes' => max(
                0,
                $current[
                    'written_egress_bytes'
                ] - $previous[
                    'written_egress_bytes'
                ],
            ),

            'partial_writes' => max(
                0,
                $current['partial_writes']
                    - $previous[
                        'partial_writes'
                    ],
            ),

            'zero_writes' => max(
                0,
                $current['zero_writes']
                    - $previous[
                        'zero_writes'
                    ],
            ),

            'write_failures' => max(
                0,
                $current['write_failures']
                    - $previous[
                        'write_failures'
                    ],
            ),
        ];
    }

    /**
     * @return SampleWindow
     */
    private function newWindow(
        int $emittedAtUnixMs,
        int $intervalMs,
    ): array {
        return [
            'started_at_unix_ms' => max(
                0,
                $emittedAtUnixMs
                    - $intervalMs,
            ),

            'ended_at_unix_ms' => $emittedAtUnixMs,

            'source_connected' => false,

            'source_bytes_delta' => 0,
            'source_chunks_delta' => 0,

            'source_last_received_age_ms' => null,

            'source_gap_max_ms' => 0.0,

            'active_rovers' => 0,

            'expected_egress_bytes_delta' => 0,

            'queued_egress_bytes_delta' => 0,

            'written_egress_bytes_delta' => 0,

            'fanout_count' => 0,

            'fanout_duration_weighted_total_ms' => 0.0,

            'fanout_duration_samples_ms' => [],

            'fanout_duration_max_ms' => 0.0,

            'backlog_bytes' => 0,

            'maximum_rover_buffer_bytes' => 0,

            'maximum_buffer_age_ms' => 0.0,

            'partial_writes_delta' => 0,
            'zero_writes_delta' => 0,
            'write_failures_delta' => 0,
        ];
    }

    /**
     * @param  SampleWindow  $window
     * @param  array<string, mixed>  $mountpoint
     * @param  CounterTotals  $deltas
     * @return SampleWindow
     */
    private function absorb(
        array $window,
        array $mountpoint,
        array $deltas,
        int $emittedAtUnixMs,
    ): array {
        $interval = $mountpoint['interval']
            ?? [];

        $gauges = $mountpoint['gauges']
            ?? [];

        if (! is_array($interval)) {
            $interval = [];
        }

        if (! is_array($gauges)) {
            $gauges = [];
        }

        $window['ended_at_unix_ms'] =
            $emittedAtUnixMs;

        $window['source_connected'] =
            (bool) (
                $mountpoint[
                    'source_connected'
                ] ?? false
            );

        $window['source_bytes_delta'] +=
            $deltas['source_bytes'];

        $window['source_chunks_delta'] +=
            $deltas['source_chunks'];

        $window[
            'expected_egress_bytes_delta'
        ] += $deltas[
            'expected_egress_bytes'
        ];

        $window[
            'queued_egress_bytes_delta'
        ] += $deltas[
            'queued_egress_bytes'
        ];

        $window[
            'written_egress_bytes_delta'
        ] += $deltas[
            'written_egress_bytes'
        ];

        $window['partial_writes_delta'] +=
            $deltas['partial_writes'];

        $window['zero_writes_delta'] +=
            $deltas['zero_writes'];

        $window['write_failures_delta'] +=
            $deltas['write_failures'];

        $window[
            'source_last_received_age_ms'
        ] = $this->nullableNonNegativeFloat(
            $mountpoint[
                'source_last_received_age_ms'
            ] ?? null,
        );

        $window['source_gap_max_ms'] = max(
            $window['source_gap_max_ms'],

            $this->nonNegativeFloat(
                $interval[
                    'source_gap_max_ms'
                ] ?? null,
            ),
        );

        $fanoutCount =
            $this->nonNegativeInt(
                $interval[
                    'fanout_count'
                ] ?? null,
            ) ?? 0;

        $fanoutAverage =
            $this->nonNegativeFloat(
                $interval[
                    'fanout_duration_avg_ms'
                ] ?? null,
            );

        $window['fanout_count'] +=
            $fanoutCount;

        $window[
            'fanout_duration_weighted_total_ms'
        ] += $fanoutAverage * $fanoutCount;

        $window[
            'fanout_duration_max_ms'
        ] = max(
            $window[
                'fanout_duration_max_ms'
            ],

            $this->nonNegativeFloat(
                $interval[
                    'fanout_duration_max_ms'
                ] ?? null,
            ),
        );

        $samples =
            $interval[
                'fanout_duration_samples_ms'
            ] ?? [];

        if (
            is_array($samples)
            && array_is_list($samples)
        ) {
            foreach ($samples as $sample) {
                $value =
                    $this->nullableNonNegativeFloat(
                        $sample,
                    );

                if ($value === null) {
                    continue;
                }

                $window[
                    'fanout_duration_samples_ms'
                ][] = $value;
            }
        }

        $window['active_rovers'] =
            $this->nonNegativeInt(
                $gauges['active_rovers']
                    ?? null,
            ) ?? 0;

        $window['backlog_bytes'] =
            $this->nonNegativeInt(
                $gauges[
                    'total_buffer_bytes'
                ] ?? null,
            ) ?? 0;

        $window[
            'maximum_rover_buffer_bytes'
        ] = max(
            $window[
                'maximum_rover_buffer_bytes'
            ],

            $this->nonNegativeInt(
                $gauges[
                    'maximum_buffer_bytes'
                ] ?? null,
            ) ?? 0,
        );

        $window[
            'maximum_buffer_age_ms'
        ] = max(
            $window[
                'maximum_buffer_age_ms'
            ],

            $this->nonNegativeFloat(
                $gauges[
                    'maximum_buffer_age_ms'
                ] ?? null,
            ),
        );

        return $window;
    }

    /**
     * @param  SampleWindow  $window
     * @return array<string, mixed>
     */
    private function finishWindow(
        int $mountpointId,
        array $window,
    ): array {
        $durationMs = max(
            1,
            $window['ended_at_unix_ms']
                - $window[
                    'started_at_unix_ms'
                ],
        );

        $fanoutAverage =
            $window['fanout_count'] === 0
                ? 0.0
                : round(
                    $window[
                        'fanout_duration_weighted_total_ms'
                    ] / $window[
                        'fanout_count'
                    ],
                    3,
                );

        $expected =
            $window[
                'expected_egress_bytes_delta'
            ];

        return [
            'mountpoint_id' => $mountpointId,

            'sampled_at_unix_ms' => $window['ended_at_unix_ms'],

            'sample_interval_ms' => $durationMs,

            'source_connected' => $window['source_connected'],

            'source_bytes_delta' => $window[
                    'source_bytes_delta'
                ],

            'source_bps' => $this->bytesPerSecond(
                $window[
                    'source_bytes_delta'
                ],
                $durationMs,
            ),

            'source_chunks_delta' => $window[
                    'source_chunks_delta'
                ],

            'source_last_received_age_ms' => $window[
                    'source_last_received_age_ms'
                ],

            'source_gap_max_ms' => round(
                $window[
                    'source_gap_max_ms'
                ],
                3,
            ),

            'active_rovers' => $window['active_rovers'],

            'expected_egress_bytes_delta' => $expected,

            'queued_egress_bytes_delta' => $window[
                    'queued_egress_bytes_delta'
                ],

            'written_egress_bytes_delta' => $window[
                    'written_egress_bytes_delta'
                ],

            'expected_egress_bps' => $this->bytesPerSecond(
                $expected,
                $durationMs,
            ),

            'queued_egress_bps' => $this->bytesPerSecond(
                $window[
                    'queued_egress_bytes_delta'
                ],
                $durationMs,
            ),

            'written_egress_bps' => $this->bytesPerSecond(
                $window[
                    'written_egress_bytes_delta'
                ],
                $durationMs,
            ),

            'fanout_coverage' => $expected === 0
                    ? null
                    : round(
                        $window[
                            'queued_egress_bytes_delta'
                        ] / $expected,
                        6,
                    ),

            'socket_drain_ratio' => $expected === 0
                    ? null
                    : round(
                        $window[
                            'written_egress_bytes_delta'
                        ] / $expected,
                        6,
                    ),

            'fanout_count' => $window['fanout_count'],

            'fanout_duration_avg_ms' => $fanoutAverage,

            'fanout_duration_p95_ms' => $this->percentile95(
                $window[
                    'fanout_duration_samples_ms'
                ],
            ),

            'fanout_duration_max_ms' => round(
                $window[
                    'fanout_duration_max_ms'
                ],
                3,
            ),

            'backlog_bytes' => $window['backlog_bytes'],

            'maximum_rover_buffer_bytes' => $window[
                    'maximum_rover_buffer_bytes'
                ],

            'maximum_buffer_age_ms' => round(
                $window[
                    'maximum_buffer_age_ms'
                ],
                3,
            ),

            'partial_writes_delta' => $window[
                    'partial_writes_delta'
                ],

            'zero_writes_delta' => $window[
                    'zero_writes_delta'
                ],

            'write_failures_delta' => $window[
                    'write_failures_delta'
                ],
        ];
    }

    private function bytesPerSecond(
        int $bytes,
        int $durationMs,
    ): int {
        return max(
            0,
            (int) round(
                $bytes * 1000
                    / max(1, $durationMs),
            ),
        );
    }

    /**
     * @param  list<float>  $samples
     */
    private function percentile95(
        array $samples,
    ): float {
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

            /** @var array<string, mixed> $item */
            $items[] = $item;
        }

        return $items;
    }

    private function positiveInt(
        mixed $value,
    ): ?int {
        if (
            ! is_int($value)
            || $value < 1
        ) {
            return null;
        }

        return $value;
    }

    private function nonNegativeInt(
        mixed $value,
    ): ?int {
        if (
            ! is_int($value)
            || $value < 0
        ) {
            return null;
        }

        return $value;
    }

    private function nullableInt(
        mixed $value,
    ): ?int {
        return is_int($value)
            ? $value
            : null;
    }

    private function nonNegativeFloat(
        mixed $value,
    ): float {
        return $this->nullableNonNegativeFloat(
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
