<?php

namespace App\Console\Commands;

use App\Models\Station;
use App\Services\Alerts\AlertRuleEvaluator;
use Illuminate\Console\Command;

final class EvaluateAlertsCommand extends Command
{
    protected $signature =
        'alerts:evaluate
        {--station= : Evaluate one Station ID}';

    protected $description =
        'Evaluate NTRIP monitoring alert rules.';

    public function handle(
        AlertRuleEvaluator $evaluator,
    ): int {
        if (! config('alerts.enabled')) {
            $this->warn(
                'Alert Engine is disabled.',
            );

            return self::SUCCESS;
        }

        $stationId =
            $this->option('station');

        if ($stationId !== null) {
            $station = Station::query()
                ->with([
                    'config',
                    'mountpoint',
                    'telemetry',
                ])
                ->findOrFail(
                    (int) $stationId,
                );

            $summary =
                $evaluator
                    ->evaluateStation(
                        $station,
                    );
        } else {
            $summary =
                $evaluator
                    ->evaluateAll();
        }

        $this->table(
            [
                'Stations',
                'Opened',
                'Updated',
                'Resolved',
            ],
            [[
                $summary['stations'],
                $summary['opened'],
                $summary['updated'],
                $summary['resolved'],
            ]],
        );

        return self::SUCCESS;
    }
}
