<?php

namespace App\Events\Devices;

final class PendingDeviceUpdated extends PendingDeviceEvent
{
    protected function action(): string
    {
        return 'updated';
    }
}
