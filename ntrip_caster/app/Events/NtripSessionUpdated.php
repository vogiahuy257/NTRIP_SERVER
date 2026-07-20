<?php

namespace App\Events;

final class NtripSessionUpdated extends NtripSessionEvent
{
    protected function action(): string
    {
        return 'updated';
    }
}
