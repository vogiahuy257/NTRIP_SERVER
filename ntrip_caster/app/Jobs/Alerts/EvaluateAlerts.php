<?php

namespace App\Jobs\Alerts;

use App\Services\Alerts\AlertRuleEvaluator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class EvaluateAlerts implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;

    public int $timeout = 20;

    public int $uniqueFor = 30;

    public function __construct()
    {
        /*
         * Alert có độ ưu tiên thấp hơn broadcast
         * và các job mặc định.
         */
        $this->onQueue('alerts');
    }

    public function uniqueId(): string
    {
        return 'alerts:evaluate';
    }

    public function handle(
        AlertRuleEvaluator $evaluator,
    ): void {
        if (! config('alerts.enabled')) {
            return;
        }

        $evaluator->evaluateAll();
    }
}
