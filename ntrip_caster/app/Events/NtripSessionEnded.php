<?php

namespace App\Events;

final class NtripSessionEnded extends NtripSessionEvent
{
    protected function action(): string
    {
        return 'ended';
    }
}
