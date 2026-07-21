<?php

namespace Tests\Unit\Services\Observability;

use App\Services\Observability\RtcmFlowRealtimeProjector;
use PHPUnit\Framework\TestCase;

final class RtcmFlowRealtimeProjectorTest extends TestCase
{
    public function test_it_projects_mountpoint_and_rover_deltas(): void
    {
        $projector =
            new RtcmFlowRealtimeProjector;

        $baseline = $projector->project(
            $this->snapshot(
                sequence: 1,
                sourceBytes: 100,
                expectedBytes: 200,
                queuedBytes: 200,
                writtenBytes: 190,
                roverQueuedBytes: 100,
                roverWrittenBytes: 90,
            ),
        );

        self::assertNotNull($baseline);

        self::assertTrue(
            $baseline['baseline'],
        );

        self::assertSame(
            0,
            $baseline['mountpoints'][0][
                'source_bps'
            ],
        );

        $realtime = $projector->project(
            $this->snapshot(
                sequence: 2,
                sourceBytes: 300,
                expectedBytes: 600,
                queuedBytes: 590,
                writtenBytes: 570,
                roverQueuedBytes: 300,
                roverWrittenBytes: 280,
            ),
        );

        self::assertNotNull($realtime);

        self::assertFalse(
            $realtime['baseline'],
        );

        self::assertSame(
            200,
            $realtime['mountpoints'][0][
                'source_bps'
            ],
        );

        self::assertSame(
            400,
            $realtime['mountpoints'][0][
                'expected_egress_bps'
            ],
        );

        self::assertSame(
            390,
            $realtime['mountpoints'][0][
                'queued_egress_bps'
            ],
        );

        self::assertSame(
            380,
            $realtime['mountpoints'][0][
                'written_egress_bps'
            ],
        );

        self::assertSame(
            0.975,
            $realtime['mountpoints'][0][
                'fanout_coverage'
            ],
        );

        self::assertSame(
            0.95,
            $realtime['mountpoints'][0][
                'socket_drain_ratio'
            ],
        );

        self::assertSame(
            200,
            $realtime['rovers'][0][
                'queued_bps'
            ],
        );

        self::assertSame(
            190,
            $realtime['rovers'][0][
                'written_bps'
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(
        int $sequence,
        int $sourceBytes,
        int $expectedBytes,
        int $queuedBytes,
        int $writtenBytes,
        int $roverQueuedBytes,
        int $roverWrittenBytes,
    ): array {
        return [
            'version' => 1,
            'sequence' => $sequence,
            'process_id' => 100,

            'emitted_at_unix_ms' => $sequence * 1000,

            'interval_ms' => 1000,

            'mountpoints' => [
                [
                    'mountpoint_id' => 10,

                    'source_connected' => true,

                    'source_last_received_age_ms' => 20.0,

                    'totals' => [
                        'source_bytes' => $sourceBytes,

                        'source_chunks' => $sequence,

                        'expected_egress_bytes' => $expectedBytes,

                        'queued_egress_bytes' => $queuedBytes,

                        'written_egress_bytes' => $writtenBytes,

                        'partial_writes' => 0,
                        'zero_writes' => 0,
                        'write_failures' => 0,
                    ],

                    'interval' => [
                        'source_gap_max_ms' => 100.0,

                        'fanout_count' => 2,

                        'fanout_duration_avg_ms' => 1.5,

                        'fanout_duration_max_ms' => 2.0,

                        'fanout_duration_samples_ms' => [
                            1.0,
                            2.0,
                        ],
                    ],

                    'gauges' => [
                        'active_rovers' => 1,

                        'total_buffer_bytes' => 10,

                        'maximum_buffer_bytes' => 10,

                        'maximum_buffer_age_ms' => 20.0,
                    ],
                ],
            ],

            'rovers' => [
                [
                    'session_id' => 50,
                    'mountpoint_id' => 10,

                    'totals' => [
                        'queued_bytes' => $roverQueuedBytes,

                        'written_bytes' => $roverWrittenBytes,

                        'partial_writes' => 0,
                        'zero_writes' => 0,
                        'write_failures' => 0,
                    ],

                    'gauges' => [
                        'current_buffer_bytes' => 10,

                        'maximum_buffer_bytes' => 20,

                        'current_buffer_age_ms' => 20.0,

                        'maximum_buffer_age_ms' => 30.0,

                        'last_successful_write_age_ms' => 10.0,
                    ],
                ],
            ],
        ];
    }
}
