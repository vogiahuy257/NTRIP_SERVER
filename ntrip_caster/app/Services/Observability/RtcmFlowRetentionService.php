<?php

namespace App\Services\Observability;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RtcmFlowRetentionService
{
    public function __construct(
        private readonly int $detailRetentionHours,
        private readonly int $rollupRetentionDays,
        private readonly int $deleteBatchSize,
    ) {}

    /**
     * @return array{
     *     raw_samples_deleted: int,
     *     rollups_deleted: int
     * }
     */
    public function prune(
        ?CarbonImmutable $now = null,
    ): array {
        $now ??= CarbonImmutable::now('UTC');

        return [
            'raw_samples_deleted' => $this->pruneRawSamples(
                $now->subHours(
                    max(
                        1,
                        $this->detailRetentionHours,
                    ),
                ),
            ),

            'rollups_deleted' => $this->pruneRollups(
                $now->subDays(
                    max(
                        1,
                        $this->rollupRetentionDays,
                    ),
                ),
            ),
        ];
    }

    private function pruneRawSamples(
        CarbonImmutable $cutoff,
    ): int {
        $deleted = 0;

        while (true) {
            /*
             * Không bao giờ xóa raw sample chưa rollup.
             */
            $ids = DB::table(
                'rtcm_flow_samples',
            )
                ->whereNotNull('rolled_up_at')
                ->where(
                    'sampled_at',
                    '<',
                    $cutoff->format(
                        'Y-m-d H:i:s',
                    ),
                )
                ->orderBy('id')
                ->limit(
                    max(
                        1,
                        $this->deleteBatchSize,
                    ),
                )
                ->pluck('id')
                ->map(
                    static fn (mixed $id): int => (int) $id,
                )
                ->all();

            if ($ids === []) {
                break;
            }

            $deleted += DB::table(
                'rtcm_flow_samples',
            )
                ->whereIn('id', $ids)
                ->delete();

            if (
                count($ids)
                < max(
                    1,
                    $this->deleteBatchSize,
                )
            ) {
                break;
            }
        }

        return $deleted;
    }

    private function pruneRollups(
        CarbonImmutable $cutoff,
    ): int {
        $deleted = 0;

        while (true) {
            $ids = DB::table(
                'rtcm_flow_rollups',
            )
                ->where(
                    'bucket_started_at',
                    '<',
                    $cutoff->format(
                        'Y-m-d H:i:s',
                    ),
                )
                ->orderBy('id')
                ->limit(
                    max(
                        1,
                        $this->deleteBatchSize,
                    ),
                )
                ->pluck('id')
                ->map(
                    static fn (mixed $id): int => (int) $id,
                )
                ->all();

            if ($ids === []) {
                break;
            }

            $deleted += DB::table(
                'rtcm_flow_rollups',
            )
                ->whereIn('id', $ids)
                ->delete();

            if (
                count($ids)
                < max(
                    1,
                    $this->deleteBatchSize,
                )
            ) {
                break;
            }
        }

        return $deleted;
    }
}
