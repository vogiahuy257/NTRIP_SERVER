<?php

namespace Tests\Unit\Services\Observability;

use App\Services\Observability\RtcmFlowRollupCalculator;
use PHPUnit\Framework\TestCase;

final class RtcmFlowRollupCalculatorTest extends TestCase
{
    public function test_it_calculates_a_weighted_minute_rollup(): void
    {
        $calculator =
            new RtcmFlowRollupCalculator;

        $rollup = $calculator->calculate([
            $this->sample(
                sourceConnected: true,
                sourceBytes: 100,
                sourceBps: 20,
                expectedBytes: 200,
                queuedBytes: 200,
                writtenBytes: 190,
                coverage: 1.0,
                drain: 0.95,
                fanoutCount: 2,
                fanoutAverageMs: 1.0,
                backlogBytes: 10,
            ),

            $this->sample(
                sourceConnected: false,
                sourceBytes: 300,
                sourceBps: 60,
                expectedBytes: 600,
                queuedBytes: 570,
                writtenBytes: 540,
                coverage: 0.95,
                drain: 0.9,
                fanoutCount: 6,
                fanoutAverageMs: 3.0,
                backlogBytes: 40,
            ),
        ]);

        self::assertSame(
            2,
            $rollup['sample_count'],
        );

        self::assertSame(
            0.5,
            $rollup[
                'source_connected_ratio'
            ],
        );

        self::assertSame(
            400,
            $rollup['source_bytes_sum'],
        );

        self::assertSame(
            40,
            $rollup['source_bps_avg'],
        );

        self::assertSame(
            0.9625,
            $rollup[
                'fanout_coverage_avg'
            ],
        );

        self::assertSame(
            0.95,
            $rollup[
                'fanout_coverage_min'
            ],
        );

        self::assertSame(
            0.9125,
            $rollup[
                'socket_drain_ratio_avg'
            ],
        );

        self::assertSame(
            2.5,
            $rollup[
                'fanout_duration_avg_ms'
            ],
        );

        self::assertSame(
            25,
            $rollup['backlog_bytes_avg'],
        );

        self::assertSame(
            40,
            $rollup['backlog_bytes_max'],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function sample(
        bool $sourceConnected,
        int $sourceBytes,
        int $sourceBps,
        int $expectedBytes,
        int $queuedBytes,
        int $writtenBytes,
        float $coverage,
        float $drain,
        int $fanoutCount,
        float $fanoutAverageMs,
        int $backlogBytes,
    ): array {
        return [
            'source_connected' => $sourceConnected,

            'source_bytes_delta' => $sourceBytes,

            'source_chunks_delta' => 1,
            'source_bps' => $sourceBps,

            'source_last_received_age_ms' => 100.0,

            'source_gap_max_ms' => 200.0,

            'active_rovers' => 2,

            'expected_egress_bytes_delta' => $expectedBytes,

            'queued_egress_bytes_delta' => $queuedBytes,

            'written_egress_bytes_delta' => $writtenBytes,

            'expected_egress_bps' => $expectedBytes,

            'queued_egress_bps' => $queuedBytes,

            'written_egress_bps' => $writtenBytes,

            'fanout_coverage' => $coverage,
            'socket_drain_ratio' => $drain,

            'fanout_count' => $fanoutCount,

            'fanout_duration_avg_ms' => $fanoutAverageMs,

            'fanout_duration_p95_ms' => $fanoutAverageMs + 1,

            'fanout_duration_max_ms' => $fanoutAverageMs + 2,

            'backlog_bytes' => $backlogBytes,

            'maximum_rover_buffer_bytes' => $backlogBytes,

            'maximum_buffer_age_ms' => 50.0,

            'partial_writes_delta' => 0,
            'zero_writes_delta' => 0,
            'write_failures_delta' => 0,
        ];
    }
}
