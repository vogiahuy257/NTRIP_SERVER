<?php

namespace Tests\Unit\Services\Observability;

use App\Contracts\Observability\RtcmFlowSnapshotTransport;
use App\Services\Observability\RtcmFlowProbe;
use PHPUnit\Framework\TestCase;

final class RtcmFlowProbeTest extends TestCase
{
    public function test_it_publishes_cumulative_mountpoint_and_rover_metrics(): void
    {
        $transport =
            new class implements RtcmFlowSnapshotTransport
            {
                /**
                 * @var list<array<string, mixed>>
                 */
                public array $messages = [];

                public function publish(
                    array $message,
                ): bool {
                    $this->messages[] =
                        $message;

                    return true;
                }
            };

        $probe = new RtcmFlowProbe(
            transport: $transport,
            snapshotIntervalMs: 1000,
            mountpointsPerPacket: 100,
            roversPerPacket: 100,
            maxLatencySamplesPerInterval: 100,
        );

        $probe->tick(
            1_000_000_000,
        );

        $probe->sourceConnected(10);

        $probe->recordSourceBytes(
            mountpointId: 10,
            bytes: 100,
            occurredAtNs: 1_100_000_000,
        );

        $probe->recordSourceBytes(
            mountpointId: 10,
            bytes: 200,
            occurredAtNs: 1_400_000_000,
        );

        $probe->roverConnected(
            sessionId: 50,
            mountpointId: 10,
        );

        $probe->recordExpectedEgress(
            mountpointId: 10,
            bytes: 300,
        );

        $probe->recordRoverQueued(
            sessionId: 50,
            mountpointId: 10,
            bytes: 300,
            queuedAtNs: 1_400_000_000,
        );

        $probe->recordRoverWritten(
            sessionId: 50,
            mountpointId: 10,
            bytes: 280,
            writtenAtNs: 1_500_000_000,
        );

        $probe->observeRoverBuffer(
            sessionId: 50,
            mountpointId: 10,
            bufferBytes: 20,
            oldestBufferAgeNs: 50_000_000,
        );

        $probe->recordPartialWrite(
            sessionId: 50,
            mountpointId: 10,
        );

        $probe->recordFanoutDuration(
            mountpointId: 10,
            durationNs: 2_000_000,
        );

        $probe->tick(
            2_000_000_000,
        );

        self::assertCount(
            2,
            $transport->messages,
        );

        $mountpointPacket =
            $transport->messages[0];

        self::assertSame(
            'mountpoints',
            $mountpointPacket['kind'],
        );

        $mountpoint =
            $mountpointPacket[
                'mountpoints'
            ][0];

        self::assertSame(
            300,
            $mountpoint[
                'totals'
            ]['source_bytes'],
        );

        self::assertSame(
            300,
            $mountpoint[
                'totals'
            ]['expected_egress_bytes'],
        );

        self::assertSame(
            300,
            $mountpoint[
                'totals'
            ]['queued_egress_bytes'],
        );

        self::assertSame(
            280,
            $mountpoint[
                'totals'
            ]['written_egress_bytes'],
        );

        self::assertSame(
            300.0,
            $mountpoint[
                'interval'
            ]['source_gap_max_ms'],
        );

        self::assertSame(
            2.0,
            $mountpoint[
                'interval'
            ]['fanout_duration_avg_ms'],
        );

        self::assertSame(
            20,
            $mountpoint[
                'gauges'
            ]['total_buffer_bytes'],
        );

        $roverPacket =
            $transport->messages[1];

        self::assertSame(
            'rovers',
            $roverPacket['kind'],
        );

        $rover =
            $roverPacket['rovers'][0];

        self::assertSame(
            300,
            $rover[
                'totals'
            ]['queued_bytes'],
        );

        self::assertSame(
            280,
            $rover[
                'totals'
            ]['written_bytes'],
        );

        self::assertSame(
            50.0,
            $rover[
                'gauges'
            ]['current_buffer_age_ms'],
        );
    }

    public function test_it_splits_large_rover_snapshots_into_parts(): void
    {
        $transport =
            new class implements RtcmFlowSnapshotTransport
            {
                /**
                 * @var list<array<string, mixed>>
                 */
                public array $messages = [];

                public function publish(
                    array $message,
                ): bool {
                    $this->messages[] =
                        $message;

                    return true;
                }
            };

        $probe = new RtcmFlowProbe(
            transport: $transport,
            snapshotIntervalMs: 1000,
            mountpointsPerPacket: 100,
            roversPerPacket: 2,
            maxLatencySamplesPerInterval: 100,
        );

        $probe->tick(
            1_000_000_000,
        );

        foreach ([1, 2, 3] as $sessionId) {
            $probe->roverConnected(
                sessionId: $sessionId,
                mountpointId: 10,
            );
        }

        $probe->tick(
            2_000_000_000,
        );

        $roverPackets = array_values(
            array_filter(
                $transport->messages,
                static fn (array $message): bool => $message['kind'] ===
                    'rovers',
            ),
        );

        self::assertCount(
            2,
            $roverPackets,
        );

        self::assertSame(
            1,
            $roverPackets[0]['part'],
        );

        self::assertSame(
            2,
            $roverPackets[0]['parts'],
        );

        self::assertCount(
            2,
            $roverPackets[0]['rovers'],
        );

        self::assertCount(
            1,
            $roverPackets[1]['rovers'],
        );
    }
}
