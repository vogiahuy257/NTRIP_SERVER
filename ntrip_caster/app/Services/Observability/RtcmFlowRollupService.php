<?php

namespace App\Services\Observability;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RtcmFlowRollupService
{
    public function __construct(
        private readonly RtcmFlowRollupCalculator $calculator,
        private readonly int $rollupDelaySeconds,
        private readonly int $maxBucketsPerRun,
    ) {}

    public function run(
        ?CarbonImmutable $now = null,
    ): int {
        $now ??= CarbonImmutable::now('UTC');

        /*
         * Chỉ xử lý những phút đã kết thúc hoàn toàn.
         */
        $eligibleBefore = $now
            ->subSeconds(
                max(
                    0,
                    $this->rollupDelaySeconds,
                ),
            )
            ->startOfMinute();

        $processedBuckets = 0;

        while (
            $processedBuckets
            < max(1, $this->maxBucketsPerRun)
        ) {
            $pending = DB::table(
                'rtcm_flow_samples',
            )
                ->whereNull('rolled_up_at')
                ->where(
                    'sampled_at',
                    '<',
                    $eligibleBefore->format(
                        'Y-m-d H:i:s',
                    ),
                )
                ->orderBy('sampled_at')
                ->orderBy('id')
                ->first([
                    'mountpoint_id',
                    'sampled_at',
                ]);

            if ($pending === null) {
                break;
            }

            $bucketStartedAt =
                CarbonImmutable::parse(
                    (string) $pending->sampled_at,
                    'UTC',
                )->startOfMinute();

            $this->rollupBucket(
                mountpointId: (int) $pending->mountpoint_id,

                bucketStartedAt: $bucketStartedAt,

                processedAt: $now,
            );

            $processedBuckets++;
        }

        return $processedBuckets;
    }

    private function rollupBucket(
        int $mountpointId,
        CarbonImmutable $bucketStartedAt,
        CarbonImmutable $processedAt,
    ): void {
        $bucketEndedAt =
            $bucketStartedAt->addMinute();

        DB::transaction(
            function () use (
                $mountpointId,
                $bucketStartedAt,
                $bucketEndedAt,
                $processedAt,
            ): void {
                $samples = DB::table(
                    'rtcm_flow_samples',
                )
                    ->where(
                        'mountpoint_id',
                        $mountpointId,
                    )
                    ->where(
                        'sampled_at',
                        '>=',
                        $bucketStartedAt->format(
                            'Y-m-d H:i:s',
                        ),
                    )
                    ->where(
                        'sampled_at',
                        '<',
                        $bucketEndedAt->format(
                            'Y-m-d H:i:s',
                        ),
                    )
                    ->orderBy('sampled_at')
                    ->get()
                    ->map(
                        static fn (object $row): array => (array) $row,
                    )
                    ->values()
                    ->all();

                if ($samples === []) {
                    return;
                }

                /** @var non-empty-list<array<string, mixed>> $samples */
                $metrics =
                    $this->calculator->calculate(
                        $samples,
                    );

                $timestamp =
                    $processedAt->format(
                        'Y-m-d H:i:s',
                    );

                $row = [
                    'mountpoint_id' => $mountpointId,

                    'bucket_started_at' => $bucketStartedAt->format(
                        'Y-m-d H:i:s',
                    ),

                    ...$metrics,

                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];

                /** @var list<string> $updateColumns */
                $updateColumns = [
                    ...array_keys($metrics),
                    'updated_at',
                ];

                DB::table(
                    'rtcm_flow_rollups',
                )->upsert(
                    [$row],
                    [
                        'mountpoint_id',
                        'bucket_started_at',
                    ],
                    $updateColumns,
                );

                /*
                 * Đánh dấu toàn bộ bucket sau khi
                 * upsert thành công.
                 */
                DB::table(
                    'rtcm_flow_samples',
                )
                    ->where(
                        'mountpoint_id',
                        $mountpointId,
                    )
                    ->where(
                        'sampled_at',
                        '>=',
                        $bucketStartedAt->format(
                            'Y-m-d H:i:s',
                        ),
                    )
                    ->where(
                        'sampled_at',
                        '<',
                        $bucketEndedAt->format(
                            'Y-m-d H:i:s',
                        ),
                    )
                    ->update([
                        'rolled_up_at' => $timestamp,
                    ]);
            },
            attempts: 3,
        );
    }
}
