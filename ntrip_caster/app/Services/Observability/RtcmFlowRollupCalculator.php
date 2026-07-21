<?php

namespace App\Services\Observability;

final class RtcmFlowRollupCalculator
{
    /**
     * @param  non-empty-list<array<string, mixed>>  $samples
     * @return array<string, int|float|null>
     */
    public function calculate(
        array $samples,
    ): array {

        $sampleCount = count($samples);

        $sourceConnectedCount = 0;
        $sourceBytesSum = 0;
        $sourceChunksSum = 0;
        $sourceBpsSum = 0;
        $sourceBpsMax = 0;

        /** @var list<float> $sourceAgeValues */
        $sourceAgeValues = [];

        $sourceGapMax = 0.0;

        $activeRoversSum = 0;
        $activeRoversMax = 0;

        $expectedBytesSum = 0;
        $queuedBytesSum = 0;
        $writtenBytesSum = 0;

        $expectedBpsSum = 0;
        $expectedBpsMax = 0;

        $queuedBpsSum = 0;
        $queuedBpsMax = 0;

        $writtenBpsSum = 0;
        $writtenBpsMax = 0;

        /** @var list<float> $coverageValues */
        $coverageValues = [];

        /** @var list<float> $drainValues */
        $drainValues = [];

        $fanoutCountSum = 0;
        $fanoutWeightedDurationMs = 0.0;
        $fanoutP95WorstMs = 0.0;
        $fanoutDurationMaxMs = 0.0;

        $backlogBytesSum = 0;
        $backlogBytesMax = 0;

        $maximumRoverBufferBytes = 0;
        $maximumBufferAgeMs = 0.0;

        $partialWritesSum = 0;
        $zeroWritesSum = 0;
        $writeFailuresSum = 0;

        foreach ($samples as $sample) {
            if ((bool) ($sample['source_connected'] ?? false)) {
                $sourceConnectedCount++;
            }

            $sourceBytes =
                $this->integer(
                    $sample['source_bytes_delta'] ?? null,
                );

            $sourceChunks =
                $this->integer(
                    $sample['source_chunks_delta'] ?? null,
                );

            $sourceBps =
                $this->integer(
                    $sample['source_bps'] ?? null,
                );

            $sourceBytesSum += $sourceBytes;
            $sourceChunksSum += $sourceChunks;
            $sourceBpsSum += $sourceBps;
            $sourceBpsMax = max(
                $sourceBpsMax,
                $sourceBps,
            );

            $sourceAge =
                $this->nullableFloat(
                    $sample[
                        'source_last_received_age_ms'
                    ] ?? null,
                );

            if ($sourceAge !== null) {
                $sourceAgeValues[] = $sourceAge;
            }

            $sourceGapMax = max(
                $sourceGapMax,
                $this->floating(
                    $sample['source_gap_max_ms']
                        ?? null,
                ),
            );

            $activeRovers =
                $this->integer(
                    $sample['active_rovers'] ?? null,
                );

            $activeRoversSum += $activeRovers;
            $activeRoversMax = max(
                $activeRoversMax,
                $activeRovers,
            );

            $expectedBytes =
                $this->integer(
                    $sample[
                        'expected_egress_bytes_delta'
                    ] ?? null,
                );

            $queuedBytes =
                $this->integer(
                    $sample[
                        'queued_egress_bytes_delta'
                    ] ?? null,
                );

            $writtenBytes =
                $this->integer(
                    $sample[
                        'written_egress_bytes_delta'
                    ] ?? null,
                );

            $expectedBytesSum += $expectedBytes;
            $queuedBytesSum += $queuedBytes;
            $writtenBytesSum += $writtenBytes;

            $expectedBps =
                $this->integer(
                    $sample[
                        'expected_egress_bps'
                    ] ?? null,
                );

            $queuedBps =
                $this->integer(
                    $sample['queued_egress_bps']
                        ?? null,
                );

            $writtenBps =
                $this->integer(
                    $sample['written_egress_bps']
                        ?? null,
                );

            $expectedBpsSum += $expectedBps;
            $expectedBpsMax = max(
                $expectedBpsMax,
                $expectedBps,
            );

            $queuedBpsSum += $queuedBps;
            $queuedBpsMax = max(
                $queuedBpsMax,
                $queuedBps,
            );

            $writtenBpsSum += $writtenBps;
            $writtenBpsMax = max(
                $writtenBpsMax,
                $writtenBps,
            );

            $coverage =
                $this->nullableFloat(
                    $sample['fanout_coverage']
                        ?? null,
                );

            if ($coverage !== null) {
                $coverageValues[] = $coverage;
            }

            $drain =
                $this->nullableFloat(
                    $sample['socket_drain_ratio']
                        ?? null,
                );

            if ($drain !== null) {
                $drainValues[] = $drain;
            }

            $fanoutCount =
                $this->integer(
                    $sample['fanout_count'] ?? null,
                );

            $fanoutAverage =
                $this->floating(
                    $sample[
                        'fanout_duration_avg_ms'
                    ] ?? null,
                );

            $fanoutCountSum += $fanoutCount;

            $fanoutWeightedDurationMs +=
                $fanoutAverage * $fanoutCount;

            $fanoutP95WorstMs = max(
                $fanoutP95WorstMs,
                $this->floating(
                    $sample[
                        'fanout_duration_p95_ms'
                    ] ?? null,
                ),
            );

            $fanoutDurationMaxMs = max(
                $fanoutDurationMaxMs,
                $this->floating(
                    $sample[
                        'fanout_duration_max_ms'
                    ] ?? null,
                ),
            );

            $backlogBytes =
                $this->integer(
                    $sample['backlog_bytes'] ?? null,
                );

            $backlogBytesSum += $backlogBytes;
            $backlogBytesMax = max(
                $backlogBytesMax,
                $backlogBytes,
            );

            $maximumRoverBufferBytes = max(
                $maximumRoverBufferBytes,
                $this->integer(
                    $sample[
                        'maximum_rover_buffer_bytes'
                    ] ?? null,
                ),
            );

            $maximumBufferAgeMs = max(
                $maximumBufferAgeMs,
                $this->floating(
                    $sample[
                        'maximum_buffer_age_ms'
                    ] ?? null,
                ),
            );

            $partialWritesSum +=
                $this->integer(
                    $sample[
                        'partial_writes_delta'
                    ] ?? null,
                );

            $zeroWritesSum +=
                $this->integer(
                    $sample[
                        'zero_writes_delta'
                    ] ?? null,
                );

            $writeFailuresSum +=
                $this->integer(
                    $sample[
                        'write_failures_delta'
                    ] ?? null,
                );
        }

        return [
            'sample_count' => $sampleCount,

            'source_connected_ratio' => round(
                $sourceConnectedCount / $sampleCount,
                6,
            ),

            'source_bytes_sum' => $sourceBytesSum,
            'source_chunks_sum' => $sourceChunksSum,

            'source_bps_avg' => (int) round(
                $sourceBpsSum / $sampleCount,
            ),

            'source_bps_max' => $sourceBpsMax,

            'source_last_received_age_ms_max' => $sourceAgeValues === []
                    ? null
                    : round(
                        max($sourceAgeValues),
                        3,
                    ),

            'source_gap_max_ms' => round(
                $sourceGapMax,
                3,
            ),

            'active_rovers_avg' => round(
                $activeRoversSum / $sampleCount,
                3,
            ),

            'active_rovers_max' => $activeRoversMax,

            'expected_egress_bytes_sum' => $expectedBytesSum,

            'queued_egress_bytes_sum' => $queuedBytesSum,

            'written_egress_bytes_sum' => $writtenBytesSum,

            'expected_egress_bps_avg' => (int) round(
                $expectedBpsSum / $sampleCount,
            ),

            'expected_egress_bps_max' => $expectedBpsMax,

            'queued_egress_bps_avg' => (int) round(
                $queuedBpsSum / $sampleCount,
            ),

            'queued_egress_bps_max' => $queuedBpsMax,

            'written_egress_bps_avg' => (int) round(
                $writtenBpsSum / $sampleCount,
            ),

            'written_egress_bps_max' => $writtenBpsMax,

            /*
             * Average được tính từ tổng byte để có
             * trọng số đúng theo lưu lượng.
             */
            'fanout_coverage_avg' => $expectedBytesSum === 0
                    ? null
                    : round(
                        $queuedBytesSum
                            / $expectedBytesSum,
                        6,
                    ),

            'fanout_coverage_min' => $coverageValues === []
                    ? null
                    : round(
                        min($coverageValues),
                        6,
                    ),

            'socket_drain_ratio_avg' => $expectedBytesSum === 0
                    ? null
                    : round(
                        $writtenBytesSum
                            / $expectedBytesSum,
                        6,
                    ),

            'socket_drain_ratio_min' => $drainValues === []
                    ? null
                    : round(
                        min($drainValues),
                        6,
                    ),

            'fanout_count_sum' => $fanoutCountSum,

            'fanout_duration_avg_ms' => $fanoutCountSum === 0
                    ? 0.0
                    : round(
                        $fanoutWeightedDurationMs
                            / $fanoutCountSum,
                        3,
                    ),

            'fanout_duration_p95_worst_ms' => round(
                $fanoutP95WorstMs,
                3,
            ),

            'fanout_duration_max_ms' => round(
                $fanoutDurationMaxMs,
                3,
            ),

            'backlog_bytes_avg' => (int) round(
                $backlogBytesSum / $sampleCount,
            ),

            'backlog_bytes_max' => $backlogBytesMax,

            'maximum_rover_buffer_bytes' => $maximumRoverBufferBytes,

            'maximum_buffer_age_ms' => round(
                $maximumBufferAgeMs,
                3,
            ),

            'partial_writes_sum' => $partialWritesSum,

            'zero_writes_sum' => $zeroWritesSum,

            'write_failures_sum' => $writeFailuresSum,
        ];
    }

    private function integer(
        mixed $value,
    ): int {
        if (! is_numeric($value)) {
            return 0;
        }

        return max(
            0,
            (int) $value,
        );
    }

    private function floating(
        mixed $value,
    ): float {
        return $this->nullableFloat(
            $value,
        ) ?? 0.0;
    }

    private function nullableFloat(
        mixed $value,
    ): ?float {
        if (
            $value === null
            || ! is_numeric($value)
        ) {
            return null;
        }

        $number = (float) $value;

        if (
            ! is_finite($number)
            || $number < 0
        ) {
            return null;
        }

        return $number;
    }
}
