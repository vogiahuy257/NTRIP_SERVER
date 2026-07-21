<?php

namespace App\Services\Observability;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RtcmFlowHistoryService
{
    public function __construct(
        private readonly int $detailRetentionHours,
        private readonly int $rollupRetentionDays,
        private readonly int $autoDetailMaxMinutes,
    ) {}

    /**
     * @return array{
     *     points: list<array<string, mixed>>,
     *     meta: array<string, mixed>
     * }
     */
    public function fetch(
        int $mountpointId,
        CarbonImmutable $from,
        CarbonImmutable $to,
        string $requestedResolution,
        int $maxPoints,
        ?CarbonImmutable $now = null,
    ): array {
        $now ??= CarbonImmutable::now('UTC');

        $effectiveTo = $to->greaterThan($now)
            ? $now
            : $to;

        $detailCutoff = $now->subHours(
            max(
                1,
                $this->detailRetentionHours,
            ),
        );

        $rollupCutoff = $now->subDays(
            max(
                1,
                $this->rollupRetentionDays,
            ),
        );

        $resolution = $this->resolveResolution(
            requestedResolution: $requestedResolution,

            from: $from,
            to: $effectiveTo,
            detailCutoff: $detailCutoff,
        );

        $retentionCutoff =
            $resolution === 'detail'
                ? $detailCutoff
                : $rollupCutoff;

        $effectiveFrom =
            $from->lessThan($retentionCutoff)
                ? $retentionCutoff
                : $from;

        if (
            $effectiveFrom->greaterThanOrEqualTo(
                $effectiveTo,
            )
        ) {
            return [
                'points' => [],

                'meta' => $this->meta(
                    mountpointId: $mountpointId,

                    requestedResolution: $requestedResolution,

                    resolution: $resolution,

                    requestedFrom: $from,
                    requestedTo: $to,

                    effectiveFrom: $effectiveFrom,

                    effectiveTo: $effectiveTo,

                    originalPointCount: 0,
                    returnedPointCount: 0,

                    maxPoints: $maxPoints,
                ),
            ];
        }

        $points = $resolution === 'detail'
            ? $this->detailPoints(
                mountpointId: $mountpointId,

                from: $effectiveFrom,
                to: $effectiveTo,
            )
            : $this->minutePoints(
                mountpointId: $mountpointId,

                from: $effectiveFrom,
                to: $effectiveTo,
            );

        $originalPointCount =
            count($points);

        $points = $this->downsample(
            points: $points,
            maximumPoints: max(
                2,
                $maxPoints,
            ),
        );

        return [
            'points' => $points,

            'meta' => $this->meta(
                mountpointId: $mountpointId,

                requestedResolution: $requestedResolution,

                resolution: $resolution,

                requestedFrom: $from,
                requestedTo: $to,

                effectiveFrom: $effectiveFrom,

                effectiveTo: $effectiveTo,

                originalPointCount: $originalPointCount,

                returnedPointCount: count($points),

                maxPoints: $maxPoints,
            ),
        ];
    }

    private function resolveResolution(
        string $requestedResolution,
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $detailCutoff,
    ): string {
        if ($requestedResolution === 'detail') {
            return 'detail';
        }

        if ($requestedResolution === 'minute') {
            return 'minute';
        }

        $durationSeconds = max(
            0,
            $to->getTimestamp()
                - $from->getTimestamp(),
        );

        $detailMaximumSeconds =
            max(
                1,
                $this->autoDetailMaxMinutes,
            ) * 60;

        if (
            $from->greaterThanOrEqualTo(
                $detailCutoff,
            )
            && $durationSeconds
                <= $detailMaximumSeconds
        ) {
            return 'detail';
        }

        return 'minute';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detailPoints(
        int $mountpointId,
        CarbonImmutable $from,
        CarbonImmutable $to,
    ): array {
        $rows = DB::table(
            'rtcm_flow_samples',
        )
            ->where(
                'mountpoint_id',
                $mountpointId,
            )
            ->where(
                'sampled_at',
                '>=',
                $this->databaseTime($from),
            )
            ->where(
                'sampled_at',
                '<',
                $this->databaseTime($to),
            )
            ->orderBy('sampled_at')
            ->get()
            ->map(
                static fn (object $row): array => (array) $row,
            )
            ->values()
            ->all();

        $points = [];

        foreach ($rows as $row) {
            $sourceBps = $this->integer(
                $row['source_bps'] ?? null,
            );

            $activeRovers = $this->integer(
                $row['active_rovers'] ?? null,
            );

            $expectedBps = $this->integer(
                $row[
                    'expected_egress_bps'
                ] ?? null,
            );

            $queuedBps = $this->integer(
                $row['queued_egress_bps']
                    ?? null,
            );

            $writtenBps = $this->integer(
                $row['written_egress_bps']
                    ?? null,
            );

            $coverage = $this->nullableFloat(
                $row['fanout_coverage']
                    ?? null,
            );

            $drain = $this->nullableFloat(
                $row['socket_drain_ratio']
                    ?? null,
            );

            $backlog = $this->integer(
                $row['backlog_bytes'] ?? null,
            );

            $points[] = [
                'timestamp' => $this->isoTimestamp(
                    $row['sampled_at']
                        ?? null,
                ),

                'interval_ms' => $this->integer(
                    $row[
                        'sample_interval_ms'
                    ] ?? null,
                ),

                'sample_count' => 1,

                'source_connected_ratio' => $this->boolean(
                    $row[
                        'source_connected'
                    ] ?? null,
                )
                        ? 1.0
                        : 0.0,

                'source_bps' => $sourceBps,
                'source_bps_max' => $sourceBps,

                'source_last_received_age_ms' => $this->nullableFloat(
                    $row[
                        'source_last_received_age_ms'
                    ] ?? null,
                ),

                'source_gap_max_ms' => $this->floating(
                    $row[
                        'source_gap_max_ms'
                    ] ?? null,
                ),

                'active_rovers' => (float) $activeRovers,

                'active_rovers_max' => $activeRovers,

                'expected_egress_bps' => $expectedBps,

                'expected_egress_bps_max' => $expectedBps,

                'queued_egress_bps' => $queuedBps,

                'queued_egress_bps_max' => $queuedBps,

                'written_egress_bps' => $writtenBps,

                'written_egress_bps_max' => $writtenBps,

                'fanout_coverage' => $coverage,

                'fanout_coverage_min' => $coverage,

                'socket_drain_ratio' => $drain,

                'socket_drain_ratio_min' => $drain,

                'fanout_duration_avg_ms' => $this->floating(
                    $row[
                        'fanout_duration_avg_ms'
                    ] ?? null,
                ),

                'fanout_duration_p95_ms' => $this->floating(
                    $row[
                        'fanout_duration_p95_ms'
                    ] ?? null,
                ),

                'fanout_duration_max_ms' => $this->floating(
                    $row[
                        'fanout_duration_max_ms'
                    ] ?? null,
                ),

                'backlog_bytes' => $backlog,
                'backlog_bytes_max' => $backlog,

                'maximum_rover_buffer_bytes' => $this->integer(
                    $row[
                        'maximum_rover_buffer_bytes'
                    ] ?? null,
                ),

                'maximum_buffer_age_ms' => $this->floating(
                    $row[
                        'maximum_buffer_age_ms'
                    ] ?? null,
                ),

                'partial_writes' => $this->integer(
                    $row[
                        'partial_writes_delta'
                    ] ?? null,
                ),

                'zero_writes' => $this->integer(
                    $row[
                        'zero_writes_delta'
                    ] ?? null,
                ),

                'write_failures' => $this->integer(
                    $row[
                        'write_failures_delta'
                    ] ?? null,
                ),
            ];
        }

        return $points;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function minutePoints(
        int $mountpointId,
        CarbonImmutable $from,
        CarbonImmutable $to,
    ): array {
        $rows = DB::table(
            'rtcm_flow_rollups',
        )
            ->where(
                'mountpoint_id',
                $mountpointId,
            )
            ->where(
                'bucket_started_at',
                '>=',
                $this->databaseTime($from),
            )
            ->where(
                'bucket_started_at',
                '<',
                $this->databaseTime($to),
            )
            ->orderBy(
                'bucket_started_at',
            )
            ->get()
            ->map(
                static fn (object $row): array => (array) $row,
            )
            ->values()
            ->all();

        $points = [];

        foreach ($rows as $row) {
            $points[] = [
                'timestamp' => $this->isoTimestamp(
                    $row[
                        'bucket_started_at'
                    ] ?? null,
                ),

                'interval_ms' => 60_000,

                'sample_count' => $this->integer(
                    $row['sample_count']
                        ?? null,
                ),

                'source_connected_ratio' => $this->floating(
                    $row[
                        'source_connected_ratio'
                    ] ?? null,
                ),

                'source_bps' => $this->integer(
                    $row[
                        'source_bps_avg'
                    ] ?? null,
                ),

                'source_bps_max' => $this->integer(
                    $row[
                        'source_bps_max'
                    ] ?? null,
                ),

                'source_last_received_age_ms' => $this->nullableFloat(
                    $row[
                        'source_last_received_age_ms_max'
                    ] ?? null,
                ),

                'source_gap_max_ms' => $this->floating(
                    $row[
                        'source_gap_max_ms'
                    ] ?? null,
                ),

                'active_rovers' => $this->floating(
                    $row[
                        'active_rovers_avg'
                    ] ?? null,
                ),

                'active_rovers_max' => $this->integer(
                    $row[
                        'active_rovers_max'
                    ] ?? null,
                ),

                'expected_egress_bps' => $this->integer(
                    $row[
                        'expected_egress_bps_avg'
                    ] ?? null,
                ),

                'expected_egress_bps_max' => $this->integer(
                    $row[
                        'expected_egress_bps_max'
                    ] ?? null,
                ),

                'queued_egress_bps' => $this->integer(
                    $row[
                        'queued_egress_bps_avg'
                    ] ?? null,
                ),

                'queued_egress_bps_max' => $this->integer(
                    $row[
                        'queued_egress_bps_max'
                    ] ?? null,
                ),

                'written_egress_bps' => $this->integer(
                    $row[
                        'written_egress_bps_avg'
                    ] ?? null,
                ),

                'written_egress_bps_max' => $this->integer(
                    $row[
                        'written_egress_bps_max'
                    ] ?? null,
                ),

                'fanout_coverage' => $this->nullableFloat(
                    $row[
                        'fanout_coverage_avg'
                    ] ?? null,
                ),

                'fanout_coverage_min' => $this->nullableFloat(
                    $row[
                        'fanout_coverage_min'
                    ] ?? null,
                ),

                'socket_drain_ratio' => $this->nullableFloat(
                    $row[
                        'socket_drain_ratio_avg'
                    ] ?? null,
                ),

                'socket_drain_ratio_min' => $this->nullableFloat(
                    $row[
                        'socket_drain_ratio_min'
                    ] ?? null,
                ),

                'fanout_duration_avg_ms' => $this->floating(
                    $row[
                        'fanout_duration_avg_ms'
                    ] ?? null,
                ),

                'fanout_duration_p95_ms' => $this->floating(
                    $row[
                        'fanout_duration_p95_worst_ms'
                    ] ?? null,
                ),

                'fanout_duration_max_ms' => $this->floating(
                    $row[
                        'fanout_duration_max_ms'
                    ] ?? null,
                ),

                'backlog_bytes' => $this->integer(
                    $row[
                        'backlog_bytes_avg'
                    ] ?? null,
                ),

                'backlog_bytes_max' => $this->integer(
                    $row[
                        'backlog_bytes_max'
                    ] ?? null,
                ),

                'maximum_rover_buffer_bytes' => $this->integer(
                    $row[
                        'maximum_rover_buffer_bytes'
                    ] ?? null,
                ),

                'maximum_buffer_age_ms' => $this->floating(
                    $row[
                        'maximum_buffer_age_ms'
                    ] ?? null,
                ),

                'partial_writes' => $this->integer(
                    $row[
                        'partial_writes_sum'
                    ] ?? null,
                ),

                'zero_writes' => $this->integer(
                    $row[
                        'zero_writes_sum'
                    ] ?? null,
                ),

                'write_failures' => $this->integer(
                    $row[
                        'write_failures_sum'
                    ] ?? null,
                ),
            ];
        }

        return $points;
    }

    /**
     * @param  list<array<string, mixed>>  $points
     * @return list<array<string, mixed>>
     */
    private function downsample(
        array $points,
        int $maximumPoints,
    ): array {
        $pointCount = count($points);

        if ($pointCount <= $maximumPoints) {
            return $points;
        }

        $result = [];
        $lastIndex = $pointCount - 1;
        $targetLastIndex = $maximumPoints - 1;

        for (
            $index = 0;
            $index < $maximumPoints;
            $index++
        ) {
            $sourceIndex = (int) round(
                $index
                    * $lastIndex
                    / max(
                        1,
                        $targetLastIndex,
                    ),
            );

            $result[] =
                $points[$sourceIndex];
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function meta(
        int $mountpointId,
        string $requestedResolution,
        string $resolution,
        CarbonImmutable $requestedFrom,
        CarbonImmutable $requestedTo,
        CarbonImmutable $effectiveFrom,
        CarbonImmutable $effectiveTo,
        int $originalPointCount,
        int $returnedPointCount,
        int $maxPoints,
    ): array {
        return [
            'mountpoint_id' => $mountpointId,

            'requested_resolution' => $requestedResolution,

            'resolution' => $resolution,

            'requested_from' => $requestedFrom
                ->toIso8601String(),

            'requested_to' => $requestedTo
                ->toIso8601String(),

            'effective_from' => $effectiveFrom
                ->toIso8601String(),

            'effective_to' => $effectiveTo
                ->toIso8601String(),

            'retention_clamped' => ! $requestedFrom->equalTo(
                $effectiveFrom,
            )
                || ! $requestedTo->equalTo(
                    $effectiveTo,
                ),

            'original_point_count' => $originalPointCount,

            'returned_point_count' => $returnedPointCount,

            'max_points' => $maxPoints,

            'downsampled' => $returnedPointCount
                    < $originalPointCount,
        ];
    }

    private function databaseTime(
        CarbonImmutable $time,
    ): string {
        return $time->format(
            'Y-m-d H:i:s.v',
        );
    }

    private function isoTimestamp(
        mixed $value,
    ): string {
        return CarbonImmutable::parse(
            (string) $value,
            'UTC',
        )
            ->utc()
            ->toIso8601String();
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
            $number < 0
            || ! is_finite($number)
        ) {
            return null;
        }

        return $number;
    }

    private function boolean(
        mixed $value,
    ): bool {
        return $this->integer($value) === 1;
    }
}
