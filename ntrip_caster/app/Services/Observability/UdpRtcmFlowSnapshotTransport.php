<?php

namespace App\Services\Observability;

use App\Contracts\Observability\RtcmFlowSnapshotTransport;
use JsonException;

final class UdpRtcmFlowSnapshotTransport implements RtcmFlowSnapshotTransport
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly int $maxPacketBytes,
    ) {}

    /**
     * @param  array<string, mixed>  $message
     */
    public function publish(
        array $message,
    ): bool {
        try {
            $payload = json_encode(
                $message,
                JSON_THROW_ON_ERROR
                | JSON_UNESCAPED_SLASHES,
            );
        } catch (JsonException) {
            return false;
        }

        if (strlen($payload) > $this->maxPacketBytes) {
            return false;
        }

        $socket = $this->socket();

        if ($socket === null) {
            return false;
        }

        $written = @fwrite(
            $socket,
            $payload,
        );

        return $written === strlen($payload);
    }

    /**
     * @return resource|null
     */
    private function socket()
    {
        if (is_resource($this->socket)) {
            return $this->socket;
        }

        $errorCode = 0;
        $errorMessage = '';

        $socket = @stream_socket_client(
            sprintf(
                'udp://%s:%d',
                $this->host,
                $this->port,
            ),
            $errorCode,
            $errorMessage,
            0,
            STREAM_CLIENT_CONNECT,
        );

        if ($socket === false) {
            return null;
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
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
    }
}
