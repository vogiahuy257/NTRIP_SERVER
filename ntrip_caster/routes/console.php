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
