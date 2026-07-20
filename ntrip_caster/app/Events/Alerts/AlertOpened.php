<?php

namespace App\Events\Alerts;

final class AlertOpened extends AlertEvent
{
    protected function action(): string
    {
        return 'opened';
    }
}
