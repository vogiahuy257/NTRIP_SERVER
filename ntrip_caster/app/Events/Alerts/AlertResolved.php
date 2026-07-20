<?php

namespace App\Events\Alerts;

final class AlertResolved extends AlertEvent
{
    protected function action(): string
    {
        return 'resolved';
    }
}
