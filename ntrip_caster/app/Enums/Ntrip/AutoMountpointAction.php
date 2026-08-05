<?php

declare(strict_types=1);

namespace App\Enums\Ntrip;

enum AutoMountpointAction: string
{
    case WAIT = 'wait';
    case ASSIGN = 'assign';
    case KEEP = 'keep';
    case SWITCH = 'switch';
}
