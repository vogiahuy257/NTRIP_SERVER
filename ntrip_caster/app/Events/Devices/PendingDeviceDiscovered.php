<?php

namespace App\Events\Devices;

final class PendingDeviceDiscovered extends PendingDeviceEvent
{
    protected function action(): string
    {
        return 'discovered';
    }
}
