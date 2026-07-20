<?php

namespace App\Events\Alerts;

final class AlertUpdated extends AlertEvent
{
    protected function action(): string
    {
        return 'updated';
    }
}
