<?php

use App\Jobs\Alerts\EvaluateAlerts;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new EvaluateAlerts)
    ->name('alerts:evaluate')
    ->everyFiveSeconds()
    ->when(fn (): bool => (bool) config('alerts.enabled'));

Schedule::command(
    'ntrip:observability-maintain',
)
    ->everyMinute()
    ->withoutOverlapping(5);

Schedule::command(
    'queue:monitor redis:realtime,redis:alerts,redis:default --max=100',
)
    ->name('queues:monitor')
    ->everyMinute()
    ->withoutOverlapping();
