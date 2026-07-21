<?php

namespace App\Contracts\Observability;

interface RtcmFlowSnapshotTransport
{
    /**
     * @param  array<string, mixed>  $message
     */
    public function publish(
        array $message,
    ): bool;
}
