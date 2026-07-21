<?php

namespace App\Services\Observability;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RtcmFlowPersistenceService
{
    /**
     * @param  list<array<string, mixed>>  $samples
     */
    public function store(
        array $samples,
    ): int {
        if ($samples === []) {
            return 0;
        }

        $now = now()->toDateTimeString();

        $rows = [];

        foreach ($samples as $sample) {
            $sampledAtUnixMs =
                $sample[
                    'sampled_at_unix_ms'
                ] ?? null;

            if (! is_int($sampledAtUnixMs)) {
                continue;
            }

            unset(
                $sample[
                    'sampled_at_unix_ms'
                ],
            );

            $sample['sampled_at'] =
                CarbonImmutable::createFromTimestampMsUTC(
                    $sampledAtUnixMs,
                )
                    ->format(
                        'Y-m-d H:i:s.v',
                    );

            $sample['created_at'] = $now;
            $sample['updated_at'] = $now;

            $rows[] = $sample;
        }

        if ($rows === []) {
            return 0;
        }

        DB::table(
            'rtcm_flow_samples',
        )->insert($rows);

        return count($rows);
    }
}
