<?php

namespace App\Events\Alerts;

final class AlertAcknowledged extends AlertEvent
{
    protected function action(): string
    {
        return 'acknowledged';
    }
}
