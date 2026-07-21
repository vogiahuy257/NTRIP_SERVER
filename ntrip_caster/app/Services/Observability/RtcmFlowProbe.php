<?php

namespace App\Services\Observability;

use App\Contracts\Observability\RtcmFlowMetricsSink;
use App\Contracts\Observability\RtcmFlowSnapshotTransport;
use InvalidArgumentException;

final class RtcmFlowProbe implements RtcmFlowMetricsSink
{
    private const CONTRACT_VERSION = 1;

    private int $snapshotIntervalNs;

    private ?int $lastSnapshotAtNs = null;

    private int $sequence = 0;

    /**
     * @var array<int, array{
     *     source_connected: bool,
     *     source_bytes_total: int,
     *     source_chunks_total: int,
     *     source_last_received_at_ns: ?int,
     *     source_gap_max_interval_ns: int,
     *     expected_egress_bytes_total: int,
     *     queued_egress_bytes_total: int,
     *     written_egress_bytes_total: int,
     *     fanout_count_interval: int,
     *     fanout_duration_total_interval_ns: int,
     *     fanout_duration_max_interval_ns: int,
     *     fanout_duration_samples_interval_ns: list<int>,
     *     partial_writes_total: int,
     *     zero_writes_total: int,
     *     write_failures_total: int
     * }>
     */
    private array $mountpoints = [];

    /**
     * @var array<int, array{
     *     session_id: int,
     *     mountpoint_id: int,
     *     queued_bytes_total: int,
     *     written_bytes_total: int,
     *     current_buffer_bytes: int,
     *     maximum_buffer_bytes: int,
     *     current_buffer_age_ns: int,
     *     maximum_buffer_age_ns: int,
     *     partial_writes_total: int,
     *     zero_writes_total: int,
     *     write_failures_total: int,
     *     last_successful_write_at_ns: ?int
     * }>
     */
    private array $rovers = [];

    public function __construct(
        private readonly RtcmFlowSnapshotTransport $transport,
        int $snapshotIntervalMs,
        private readonly int $mountpointsPerPacket,
        private readonly int $roversPerPacket,
        private readonly int $maxLatencySamplesPerInterval,
    ) {
        if ($snapshotIntervalMs < 100) {
            throw new InvalidArgumentException(
                'RTCM flow snapshot interval must be at least 100 ms.',
            );
        }

        if (
            $mountpointsPerPacket < 1
            || $roversPerPacket < 1
        ) {
            throw new InvalidArgumentException(
                'Observability packet sizes must be positive.',
            );
        }

        if ($maxLatencySamplesPerInterval < 1) {
            throw new InvalidArgumentException(
                'Latency sample limit must be positive.',
            );
        }

        $this->snapshotIntervalNs =
            $snapshotIntervalMs * 1_000_000;
    }

    public function sourceConnected(
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'source_connected'
        ] = true;
    }

    public function sourceDisconnected(
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'source_connected'
        ] = false;
    }

    public function recordSourceBytes(
        int $mountpointId,
        int $bytes,
        int $occurredAtNs,
    ): void {
        if ($bytes <= 0) {
            return;
        }

        $this->ensureMountpoint(
            $mountpointId,
        );

        $mountpoint =
            &$this->mountpoints[$mountpointId];

        $previousReceivedAt =
            $mountpoint[
                'source_last_received_at_ns'
            ];

        if ($previousReceivedAt !== null) {
            $gap = max(
                0,
                $occurredAtNs
                    - $previousReceivedAt,
            );

            $mountpoint[
                'source_gap_max_interval_ns'
            ] = max(
                $mountpoint[
                    'source_gap_max_interval_ns'
                ],
                $gap,
            );
        }

        $mountpoint['source_bytes_total'] +=
            $bytes;

        $mountpoint['source_chunks_total'] +=
            1;

        $mountpoint[
            'source_last_received_at_ns'
        ] = $occurredAtNs;

        unset($mountpoint);
    }

    public function roverConnected(
        int $sessionId,
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );
    }

    public function roverDisconnected(
        int $sessionId,
        int $mountpointId,
    ): void {
        unset($this->rovers[$sessionId]);
    }

    public function recordExpectedEgress(
        int $mountpointId,
        int $bytes,
    ): void {
        if ($bytes <= 0) {
            return;
        }

        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'expected_egress_bytes_total'
        ] += $bytes;
    }

    public function recordRoverQueued(
        int $sessionId,
        int $mountpointId,
        int $bytes,
        int $queuedAtNs,
    ): void {
        if ($bytes <= 0) {
            return;
        }

        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'queued_egress_bytes_total'
        ] += $bytes;

        $this->rovers[$sessionId][
            'queued_bytes_total'
        ] += $bytes;
    }

    public function recordRoverWritten(
        int $sessionId,
        int $mountpointId,
        int $bytes,
        int $writtenAtNs,
    ): void {
        if ($bytes <= 0) {
            return;
        }

        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'written_egress_bytes_total'
        ] += $bytes;

        $rover = &$this->rovers[$sessionId];

        $rover['written_bytes_total'] += $bytes;
        $rover['last_successful_write_at_ns'] = $writtenAtNs;

        unset($rover);
    }

    public function observeRoverBuffer(
        int $sessionId,
        int $mountpointId,
        int $bufferBytes,
        int $oldestBufferAgeNs,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $bufferBytes = max(
            0,
            $bufferBytes,
        );

        $oldestBufferAgeNs = max(
            0,
            $oldestBufferAgeNs,
        );

        $rover =
            &$this->rovers[$sessionId];

        $rover['current_buffer_bytes'] =
            $bufferBytes;

        $rover['maximum_buffer_bytes'] = max(
            $rover['maximum_buffer_bytes'],
            $bufferBytes,
        );

        $rover['current_buffer_age_ns'] =
            $oldestBufferAgeNs;

        $rover['maximum_buffer_age_ns'] = max(
            $rover['maximum_buffer_age_ns'],
            $oldestBufferAgeNs,
        );

        unset($rover);
    }

    public function recordPartialWrite(
        int $sessionId,
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'partial_writes_total'
        ] += 1;

        $this->rovers[$sessionId][
            'partial_writes_total'
        ] += 1;
    }

    public function recordZeroWrite(
        int $sessionId,
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'zero_writes_total'
        ] += 1;

        $this->rovers[$sessionId][
            'zero_writes_total'
        ] += 1;
    }

    public function recordWriteFailure(
        int $sessionId,
        int $mountpointId,
    ): void {
        $this->ensureMountpoint(
            $mountpointId,
        );

        $this->ensureRover(
            $sessionId,
            $mountpointId,
        );

        $this->mountpoints[$mountpointId][
            'write_failures_total'
        ] += 1;

        $this->rovers[$sessionId][
            'write_failures_total'
        ] += 1;
    }

    public function recordFanoutDuration(
        int $mountpointId,
        int $durationNs,
    ): void {
        if ($durationNs < 0) {
            return;
        }

        $this->ensureMountpoint(
            $mountpointId,
        );

        $mountpoint =
            &$this->mountpoints[$mountpointId];

        $mountpoint[
            'fanout_count_interval'
        ] += 1;

        $mountpoint[
            'fanout_duration_total_interval_ns'
        ] += $durationNs;

        $mountpoint[
            'fanout_duration_max_interval_ns'
        ] = max(
            $mountpoint[
                'fanout_duration_max_interval_ns'
            ],
            $durationNs,
        );

        if (
            count(
                $mountpoint[
                    'fanout_duration_samples_interval_ns'
                ],
            )
            < $this->maxLatencySamplesPerInterval
        ) {
            $mountpoint[
                'fanout_duration_samples_interval_ns'
            ][] = $durationNs;
        }

        unset($mountpoint);
    }

    public function tick(
        int $nowNs,
    ): void {
        if ($this->lastSnapshotAtNs === null) {
            $this->lastSnapshotAtNs =
                $nowNs;

            return;
        }

        if (
            $nowNs < $this->lastSnapshotAtNs
        ) {
            $this->lastSnapshotAtNs =
                $nowNs;

            return;
        }

        if (
            $nowNs - $this->lastSnapshotAtNs
            < $this->snapshotIntervalNs
        ) {
            return;
        }

        $this->publishSnapshot(
            $nowNs,
        );
    }

    public function flush(
        int $nowNs,
    ): void {
        if ($this->lastSnapshotAtNs === null) {
            $this->lastSnapshotAtNs =
                max(
                    0,
                    $nowNs
                        - $this->snapshotIntervalNs,
                );
        }

        $this->publishSnapshot(
            $nowNs,
        );
    }

    private function publishSnapshot(
        int $nowNs,
    ): void {
        $previousSnapshotAt =
            $this->lastSnapshotAtNs
            ?? $nowNs;

        $intervalNs = max(
            1,
            $nowNs - $previousSnapshotAt,
        );

        $this->sequence += 1;

        $base = [
            'version' => self::CONTRACT_VERSION,

            'sequence' => $this->sequence,

            'process_id' => getmypid() ?: null,

            'emitted_at_unix_ms' => (int) floor(
                microtime(true) * 1000,
            ),

            'interval_ms' => max(
                1,
                (int) round(
                    $intervalNs
                        / 1_000_000,
                ),
            ),
        ];

        $mountpointSnapshots = [];

        foreach (
            array_keys($this->mountpoints) as $mountpointId
        ) {
            $mountpointSnapshots[] =
                $this->mountpointSnapshot(
                    $mountpointId,
                    $nowNs,
                );
        }

        $this->publishChunks(
            base: $base,
            kind: 'mountpoints',
            itemsKey: 'mountpoints',
            items: $mountpointSnapshots,
            itemsPerPacket: $this->mountpointsPerPacket,
        );

        $roverSnapshots = [];

        foreach ($this->rovers as $rover) {
            $roverSnapshots[] =
                $this->roverSnapshot(
                    $rover,
                    $nowNs,
                );
        }

        $this->publishChunks(
            base: $base,
            kind: 'rovers',
            itemsKey: 'rovers',
            items: $roverSnapshots,
            itemsPerPacket: $this->roversPerPacket,
        );

        $this->resetIntervalMetrics();

        $this->lastSnapshotAtNs =
            $nowNs;
    }

    /**
     * @param  array<string, int|string|null>  $base
     * @param  list<array<string, mixed>>  $items
     */
    private function publishChunks(
        array $base,
        string $kind,
        string $itemsKey,
        array $items,
        int $itemsPerPacket,
    ): void {
        $chunkSize = max(
            1,
            $itemsPerPacket,
        );

        $chunks = $items === []
            ? [[]]
            : array_chunk(
                $items,
                $chunkSize,
            );

        $parts = count($chunks);

        foreach (
            $chunks as $index => $chunk
        ) {
            $this->transport->publish([
                ...$base,

                'kind' => $kind,
                'part' => $index + 1,
                'parts' => $parts,

                $itemsKey => $chunk,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function mountpointSnapshot(
        int $mountpointId,
        int $nowNs,
    ): array {
        $mountpoint =
            $this->mountpoints[$mountpointId];

        $activeRovers = 0;
        $totalBufferBytes = 0;
        $maximumBufferBytes = 0;
        $maximumBufferAgeNs = 0;

        foreach ($this->rovers as $rover) {
            if (
                $rover['mountpoint_id']
                !== $mountpointId
            ) {
                continue;
            }

            $activeRovers += 1;

            $totalBufferBytes +=
                $rover[
                    'current_buffer_bytes'
                ];

            $maximumBufferBytes = max(
                $maximumBufferBytes,
                $rover[
                    'current_buffer_bytes'
                ],
            );

            $maximumBufferAgeNs = max(
                $maximumBufferAgeNs,
                $rover[
                    'current_buffer_age_ns'
                ],
            );
        }

        $sourceLastReceivedAt =
            $mountpoint[
                'source_last_received_at_ns'
            ];

        $sourceAgeNs =
            $sourceLastReceivedAt === null
                ? null
                : max(
                    0,
                    $nowNs
                        - $sourceLastReceivedAt,
                );

        $fanoutCount =
            $mountpoint[
                'fanout_count_interval'
            ];

        $fanoutAverageNs =
            $fanoutCount === 0
                ? 0
                : (int) round(
                    $mountpoint[
                        'fanout_duration_total_interval_ns'
                    ] / $fanoutCount,
                );

        return [
            'mountpoint_id' => $mountpointId,

            'source_connected' => $mountpoint[
                    'source_connected'
                ],

            'source_last_received_age_ms' => $sourceAgeNs === null
                    ? null
                    : $this->milliseconds(
                        $sourceAgeNs,
                    ),

            'totals' => [
                'source_bytes' => $mountpoint[
                        'source_bytes_total'
                    ],

                'source_chunks' => $mountpoint[
                        'source_chunks_total'
                    ],

                'expected_egress_bytes' => $mountpoint[
                        'expected_egress_bytes_total'
                    ],

                'queued_egress_bytes' => $mountpoint[
                        'queued_egress_bytes_total'
                    ],

                'written_egress_bytes' => $mountpoint[
                        'written_egress_bytes_total'
                    ],

                'partial_writes' => $mountpoint[
                        'partial_writes_total'
                    ],

                'zero_writes' => $mountpoint[
                        'zero_writes_total'
                    ],

                'write_failures' => $mountpoint[
                        'write_failures_total'
                    ],
            ],

            'interval' => [
                'source_gap_max_ms' => $this->milliseconds(
                    $mountpoint[
                        'source_gap_max_interval_ns'
                    ],
                ),

                'fanout_count' => $fanoutCount,

                'fanout_duration_avg_ms' => $this->milliseconds(
                    $fanoutAverageNs,
                ),

                'fanout_duration_max_ms' => $this->milliseconds(
                    $mountpoint[
                        'fanout_duration_max_interval_ns'
                    ],
                ),

                'fanout_duration_samples_ms' => array_map(
                    fn (int $durationNs): float => $this->milliseconds(
                        $durationNs,
                    ),

                    $mountpoint[
                        'fanout_duration_samples_interval_ns'
                    ],
                ),
            ],

            'gauges' => [
                'active_rovers' => $activeRovers,

                'total_buffer_bytes' => $totalBufferBytes,

                'maximum_buffer_bytes' => $maximumBufferBytes,

                'maximum_buffer_age_ms' => $this->milliseconds(
                    $maximumBufferAgeNs,
                ),
            ],
        ];
    }

    /**
     * @param array{
     *     session_id: int,
     *     mountpoint_id: int,
     *     queued_bytes_total: int,
     *     written_bytes_total: int,
     *     current_buffer_bytes: int,
     *     maximum_buffer_bytes: int,
     *     current_buffer_age_ns: int,
     *     maximum_buffer_age_ns: int,
     *     partial_writes_total: int,
     *     zero_writes_total: int,
     *     write_failures_total: int,
     *     last_successful_write_at_ns: ?int
     * } $rover
     * @return array<string, mixed>
     */
    private function roverSnapshot(
        array $rover,
        int $nowNs,
    ): array {
        $lastWriteAt =
            $rover[
                'last_successful_write_at_ns'
            ];

        return [
            'session_id' => $rover['session_id'],

            'mountpoint_id' => $rover['mountpoint_id'],

            'totals' => [
                'queued_bytes' => $rover[
                        'queued_bytes_total'
                    ],

                'written_bytes' => $rover[
                        'written_bytes_total'
                    ],

                'partial_writes' => $rover[
                        'partial_writes_total'
                    ],

                'zero_writes' => $rover[
                        'zero_writes_total'
                    ],

                'write_failures' => $rover[
                        'write_failures_total'
                    ],
            ],

            'gauges' => [
                'current_buffer_bytes' => $rover[
                        'current_buffer_bytes'
                    ],

                'maximum_buffer_bytes' => $rover[
                        'maximum_buffer_bytes'
                    ],

                'current_buffer_age_ms' => $this->milliseconds(
                    $rover[
                        'current_buffer_age_ns'
                    ],
                ),

                'maximum_buffer_age_ms' => $this->milliseconds(
                    $rover[
                        'maximum_buffer_age_ns'
                    ],
                ),

                'last_successful_write_age_ms' => $lastWriteAt === null
                        ? null
                        : $this->milliseconds(
                            max(
                                0,
                                $nowNs
                                    - $lastWriteAt,
                            ),
                        ),
            ],
        ];
    }

    private function ensureMountpoint(
        int $mountpointId,
    ): void {
        if (
            isset(
                $this->mountpoints[
                    $mountpointId
                ],
            )
        ) {
            return;
        }

        $this->mountpoints[$mountpointId] = [
            'source_connected' => false,

            'source_bytes_total' => 0,
            'source_chunks_total' => 0,

            'source_last_received_at_ns' => null,

            'source_gap_max_interval_ns' => 0,

            'expected_egress_bytes_total' => 0,

            'queued_egress_bytes_total' => 0,

            'written_egress_bytes_total' => 0,

            'fanout_count_interval' => 0,

            'fanout_duration_total_interval_ns' => 0,

            'fanout_duration_max_interval_ns' => 0,

            'fanout_duration_samples_interval_ns' => [],

            'partial_writes_total' => 0,
            'zero_writes_total' => 0,
            'write_failures_total' => 0,
        ];
    }

    private function ensureRover(
        int $sessionId,
        int $mountpointId,
    ): void {
        if (isset($this->rovers[$sessionId])) {
            return;
        }

        $this->rovers[$sessionId] = [
            'session_id' => $sessionId,
            'mountpoint_id' => $mountpointId,

            'queued_bytes_total' => 0,
            'written_bytes_total' => 0,

            'current_buffer_bytes' => 0,
            'maximum_buffer_bytes' => 0,

            'current_buffer_age_ns' => 0,
            'maximum_buffer_age_ns' => 0,

            'partial_writes_total' => 0,
            'zero_writes_total' => 0,
            'write_failures_total' => 0,

            'last_successful_write_at_ns' => null,
        ];
    }

    private function resetIntervalMetrics(): void
    {
        foreach (
            array_keys($this->mountpoints) as $mountpointId
        ) {
            $this->mountpoints[$mountpointId][
                'source_gap_max_interval_ns'
            ] = 0;

            $this->mountpoints[$mountpointId][
                'fanout_count_interval'
            ] = 0;

            $this->mountpoints[$mountpointId][
                'fanout_duration_total_interval_ns'
            ] = 0;

            $this->mountpoints[$mountpointId][
                'fanout_duration_max_interval_ns'
            ] = 0;

            $this->mountpoints[$mountpointId][
                'fanout_duration_samples_interval_ns'
            ] = [];
        }
    }

    private function milliseconds(
        int $nanoseconds,
    ): float {
        return round(
            $nanoseconds / 1_000_000,
            3,
        );
    }
}
