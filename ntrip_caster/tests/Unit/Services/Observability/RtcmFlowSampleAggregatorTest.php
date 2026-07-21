<?php

namespace Tests\Unit\Services\Observability;

use App\Services\Observability\RtcmFlowSampleAggregator;
use PHPUnit\Framework\TestCase;

final class RtcmFlowSampleAggregatorTest extends TestCase
{
    public function test_it_builds_a_sample_from_cumulative_snapshots(): void
    {
        $aggregator =
            new RtcmFlowSampleAggregator(
                sampleIntervalSeconds: 2,
            );

        self::assertSame(
            [],
            $aggregator->push(
                $this->snapshot(
                    sequence: 1,
                    emittedAtUnixMs: 1000,
                    sourceBytes: 100,
                    sourceChunks: 1,
                    expectedBytes: 200,
                    queuedBytes: 200,
                    writtenBytes: 190,
                    partialWrites: 0,
                    fanoutAverageMs: 1.0,
                    fanoutMaximumMs: 1.0,
                    fanoutSamplesMs: [1.0],
                    activeRovers: 2,
                    backlogBytes: 10,
                    maximumBufferBytes: 10,
                    maximumBufferAgeMs: 20.0,
                    sourceGapMaximumMs: 100.0,
                ),
            ),
        );

        self::assertSame(
            [],
            $aggregator->push(
                $this->snapshot(
                    sequence: 2,
                    emittedAtUnixMs: 2000,
                    sourceBytes: 200,
                    sourceChunks: 2,
                    expectedBytes: 400,
                    queuedBytes: 400,
                    writtenBytes: 380,
                    partialWrites: 1,
                    fanoutAverageMs: 2.0,
                    fanoutMaximumMs: 2.0,
                    fanoutSamplesMs: [2.0],
                    activeRovers: 2,
                    backlogBytes: 20,
                    maximumBufferBytes: 20,
                    maximumBufferAgeMs: 50.0,
                    sourceGapMaximumMs: 300.0,
                ),
            ),
        );

        $samples = $aggregator->push(
            $this->snapshot(
                sequence: 3,
                emittedAtUnixMs: 3000,
                sourceBytes: 350,
                sourceChunks: 3,
                expectedBytes: 700,
                queuedBytes: 700,
                writtenBytes: 680,
                partialWrites: 1,
                fanoutAverageMs: 4.0,
                fanoutMaximumMs: 4.0,
                fanoutSamplesMs: [4.0],
                activeRovers: 3,
                backlogBytes: 20,
                maximumBufferBytes: 30,
                maximumBufferAgeMs: 100.0,
                sourceGapMaximumMs: 400.0,
            ),
        );

        self::assertCount(
            1,
            $samples,
        );

        $sample = $samples[0];

        self::assertSame(
            250,
            $sample['source_bytes_delta'],
        );

        self::assertSame(
            125,
            $sample['source_bps'],
        );

        self::assertSame(
            500,
            $sample[
                'expected_egress_bytes_delta'
            ],
        );

        self::assertSame(
            490,
            $sample[
                'written_egress_bytes_delta'
            ],
        );

        self::assertSame(
            1.0,
            $sample['fanout_coverage'],
        );

        self::assertSame(
            0.98,
            $sample['socket_drain_ratio'],
        );

        self::assertSame(
            2,
            $sample['fanout_count'],
        );

        self::assertSame(
            3.0,
            $sample[
                'fanout_duration_avg_ms'
            ],
        );

        self::assertSame(
            4.0,
            $sample[
                'fanout_duration_p95_ms'
            ],
        );

        self::assertSame(
            400.0,
            $sample['source_gap_max_ms'],
        );

        self::assertSame(
            20,
            $sample['backlog_bytes'],
        );

        self::assertSame(
            30,
            $sample[
                'maximum_rover_buffer_bytes'
            ],
        );

        self::assertSame(
            100.0,
            $sample[
                'maximum_buffer_age_ms'
            ],
        );

        self::assertSame(
            1,
            $sample[
                'partial_writes_delta'
            ],
        );
    }

    /**
     * @param  list<float>  $fanoutSamplesMs
     * @return array<string, mixed>
     */
    private function snapshot(
        int $sequence,
        int $emittedAtUnixMs,
        int $sourceBytes,
        int $sourceChunks,
        int $expectedBytes,
        int $queuedBytes,
        int $writtenBytes,
        int $partialWrites,
        float $fanoutAverageMs,
        float $fanoutMaximumMs,
        array $fanoutSamplesMs,
        int $activeRovers,
        int $backlogBytes,
        int $maximumBufferBytes,
        float $maximumBufferAgeMs,
        float $sourceGapMaximumMs,
    ): array {
        return [
            'version' => 1,
            'sequence' => $sequence,
            'process_id' => 100,
            'emitted_at_unix_ms' => $emittedAtUnixMs,
            'interval_ms' => 1000,

            'mountpoints' => [
                [
                    'mountpoint_id' => 10,
                    'source_connected' => true,

                    'source_last_received_age_ms' => 100.0,

                    'totals' => [
                        'source_bytes' => $sourceBytes,

                        'source_chunks' => $sourceChunks,

                        'expected_egress_bytes' => $expectedBytes,

                        'queued_egress_bytes' => $queuedBytes,

                        'written_egress_bytes' => $writtenBytes,

                        'partial_writes' => $partialWrites,

                        'zero_writes' => 0,
                        'write_failures' => 0,
                    ],

                    'interval' => [
                        'source_gap_max_ms' => $sourceGapMaximumMs,

                        'fanout_count' => 1,

                        'fanout_duration_avg_ms' => $fanoutAverageMs,

                        'fanout_duration_max_ms' => $fanoutMaximumMs,

                        'fanout_duration_samples_ms' => $fanoutSamplesMs,
                    ],

                    'gauges' => [
                        'active_rovers' => $activeRovers,

                        'total_buffer_bytes' => $backlogBytes,

                        'maximum_buffer_bytes' => $maximumBufferBytes,

                        'maximum_buffer_age_ms' => $maximumBufferAgeMs,
                    ],
                ],
            ],

            'rovers' => [],
        ];
    }
}
