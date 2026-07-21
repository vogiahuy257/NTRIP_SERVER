<?php

namespace App\Services\Observability;

use App\Contracts\Observability\RtcmFlowMetricsSink;

final class NullRtcmFlowMetricsSink implements RtcmFlowMetricsSink
{
    public function sourceConnected(
        int $mountpointId,
    ): void {}

    public function sourceDisconnected(
        int $mountpointId,
    ): void {}

    public function recordSourceBytes(
        int $mountpointId,
        int $bytes,
        int $occurredAtNs,
    ): void {}

    public function roverConnected(
        int $sessionId,
        int $mountpointId,
    ): void {}

    public function roverDisconnected(
        int $sessionId,
        int $mountpointId,
    ): void {}

    public function recordExpectedEgress(
        int $mountpointId,
        int $bytes,
    ): void {}

    public function recordRoverQueued(
        int $sessionId,
        int $mountpointId,
        int $bytes,
        int $queuedAtNs,
    ): void {}

    public function recordRoverWritten(
        int $sessionId,
        int $mountpointId,
        int $bytes,
        int $writtenAtNs,
    ): void {}

    public function observeRoverBuffer(
        int $sessionId,
        int $mountpointId,
        int $bufferBytes,
        int $oldestBufferAgeNs,
    ): void {}

    public function recordPartialWrite(
        int $sessionId,
        int $mountpointId,
    ): void {}

    public function recordZeroWrite(
        int $sessionId,
        int $mountpointId,
    ): void {}

    public function recordWriteFailure(
        int $sessionId,
        int $mountpointId,
    ): void {}

    public function recordFanoutDuration(
        int $mountpointId,
        int $durationNs,
    ): void {}

    public function tick(
        int $nowNs,
    ): void {}

    public function flush(
        int $nowNs,
    ): void {}
}
