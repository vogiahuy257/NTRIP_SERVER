<?php

namespace App\Contracts\Observability;

interface RtcmFlowDatagramReceiver
{
    /**
     * Chờ và nhận tối đa một UDP datagram.
     *
     * Trả về null khi hết thời gian chờ.
     */
    public function receive(
        int $timeoutMicroseconds,
    ): ?string;

    public function close(): void;
}
