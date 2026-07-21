<?php

namespace App\Console\Commands;

use App\Services\Observability\RtcmFlowRetentionService;
use App\Services\Observability\RtcmFlowRollupService;
use Illuminate\Console\Command;
use Throwable;

class NtripObservabilityMaintainCommand extends Command
{
    protected $signature =
        'ntrip:observability-maintain';

    protected $description =
        'Roll up and prune NTRIP observability metrics';

    public function handle(
        RtcmFlowRollupService $rollups,
        RtcmFlowRetentionService $retention,
    ): int {
        try {
            $rolledUpBuckets =
                $rollups->run();

            $deleted =
                $retention->prune();

            $this->info(
                sprintf(
                    'Observability maintenance completed: %d buckets rolled up, %d raw samples deleted, %d rollups deleted.',
                    $rolledUpBuckets,
                    $deleted[
                        'raw_samples_deleted'
                    ],
                    $deleted['rollups_deleted'],
                ),
            );

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);

            $this->error(
                $exception->getMessage(),
            );

            return self::FAILURE;
        }
    }
}
