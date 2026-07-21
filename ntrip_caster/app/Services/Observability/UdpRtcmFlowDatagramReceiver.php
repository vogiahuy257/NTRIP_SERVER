<?php

namespace App\Services\Observability;

use App\Contracts\Observability\RtcmFlowDatagramReceiver;
use InvalidArgumentException;
use RuntimeException;

final class UdpRtcmFlowDatagramReceiver implements RtcmFlowDatagramReceiver
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly int $receiveBufferBytes,
    ) {
        if ($this->port < 1 || $this->port > 65535) {
            throw new InvalidArgumentException(
                'Observability UDP port must be between 1 and 65535.',
            );
        }

        if ($this->receiveBufferBytes < 1) {
            throw new InvalidArgumentException(
                'Observability receive buffer must be positive.',
            );
        }
    }

    public function receive(
        int $timeoutMicroseconds,
    ): ?string {
        $socket = $this->socket();

        $timeoutMicroseconds = max(
            0,
            $timeoutMicroseconds,
        );

        $seconds = intdiv(
            $timeoutMicroseconds,
            1_000_000,
        );

        $microseconds =
            $timeoutMicroseconds % 1_000_000;

        $readSockets = [$socket];
        $writeSockets = null;
        $exceptSockets = null;

        $changed = @stream_select(
            $readSockets,
            $writeSockets,
            $exceptSockets,
            $seconds,
            $microseconds,
        );

        if ($changed === false) {
            throw new RuntimeException(
                'Failed while waiting for observability UDP datagram.',
            );
        }

        if ($changed === 0) {
            return null;
        }

        $payload = @stream_socket_recvfrom(
            $socket,
            $this->receiveBufferBytes,
        );

        if ($payload === false || $payload === '') {
            return null;
        }

        return $payload;
    }

    public function close(): void
    {
        if (! is_resource($this->socket)) {
            return;
        }

        @fclose($this->socket);

        $this->socket = null;
    }

    /**
     * @return resource
     */
    private function socket()
    {
        if (is_resource($this->socket)) {
            return $this->socket;
        }

        $errorCode = 0;
        $errorMessage = '';

        $socket = @stream_socket_server(
            sprintf(
                'udp://%s:%d',
                $this->host,
                $this->port,
            ),
            $errorCode,
            $errorMessage,
            STREAM_SERVER_BIND,
        );

        if ($socket === false) {
            throw new RuntimeException(
                sprintf(
                    'Cannot bind observability collector to udp://%s:%d: %s (%d)',
                    $this->host,
                    $this->port,
                    $errorMessage,
                    $errorCode,
                ),
            );
        }

        stream_set_blocking(
            $socket,
            false,
        );

        $this->socket = $socket;

        return $this->socket;
    }

    public function __destruct()
    {
        $this->close();
    }
}
