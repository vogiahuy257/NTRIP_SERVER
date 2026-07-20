<?php

namespace App\Events;

final class NtripSessionStarted extends NtripSessionEvent
{
    protected function action(): string
    {
        return 'started';
    }
}
