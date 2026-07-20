<?php

namespace App\Services\Ntrip;

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\Station;
use App\Services\Ntrip\Auth\RoverConnectionService;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Throwable;

class NtripCaster
{
    /** @var resource|null */
    private $serverSocket = null;

    /**
     * @var array<int, array{
     *     socket: resource,
     *     peer: string,
     *     remote_ip: string,
     *     state: string,
     *     input_buffer: string,
     *     output_buffer: string,
     *     mountpoint: ?string,
     *     station_id: ?int,
     *     rover_account_id: ?int,
     *     authenticated_username: ?string,
     *     client_agent: ?string,
     *     ntrip_version: ?string,
     *     session_id: ?int,
     *     bytes_transferred: int,
     *     connected_at: int,
     *     last_stats_flush_at: int,
     *     last_activity: int,
     *     parser: ?Rtcm3Parser
     * }>
     */
    private array $clients = [];

    /**
     * @var array<string, array<string, mixed>>
     */
    private array $catalog = [];

    private int $lastCatalogRefreshAt = 0;

    private bool $shutdownRequested = false;

    private ?string $shutdownReason = null;

    private bool $shutdownCompleted = false;

    public function __construct(
        private readonly RoverConnectionService $roverConnections,
        private readonly NtripSessionService $sessions,
    ) {}

    public function run(callable $logger): void
    {

        $this->resetStaleRuntimeState();

        $address = sprintf(
            'tcp://%s:%d',
            config('ntrip.host'),
            config('ntrip.port')
        );

        $errorCode = 0;
        $errorMessage = '';

        $this->serverSocket = @stream_socket_server(
            $address,
            $errorCode,
            $errorMessage,
            STREAM_SERVER_BIND | STREAM_SERVER_LISTEN
        );

        if ($this->serverSocket === false) {
            throw new RuntimeException(
                sprintf(
                    'Cannot start NTRIP caster on %s: %s (%d)',
                    $address,
                    $errorMessage,
                    $errorCode
                )
            );
        }

        stream_set_blocking($this->serverSocket, false);

        $logger("NTRIP caster listening on {$address}");

        while (! $this->shutdownRequested) {
            $this->refreshCatalog($logger);

            $readSockets = [$this->serverSocket];
            $writeSockets = [];

            foreach ($this->clients as $client) {
                $readSockets[] = $client['socket'];

                if ($client['output_buffer'] !== '') {
                    $writeSockets[] = $client['socket'];
                }
            }

            $exceptSockets = [];

            $changed = @stream_select(
                $readSockets,
                $writeSockets,
                $exceptSockets,
                0,
                (int) config(
                    'ntrip.select_timeout_microseconds'
                )
            );

            if ($changed === false) {
                if ($this->shutdownRequested) {
                    break;
                }
                usleep(100000);

                continue;
            }

            foreach ($readSockets as $socket) {
                if ($socket === $this->serverSocket) {
                    $this->acceptClient($logger);

                    continue;
                }

                $clientId = (int) $socket;

                if (isset($this->clients[$clientId])) {
                    $this->readClient($clientId, $logger);
                }
            }

            foreach ($writeSockets as $socket) {
                $clientId = (int) $socket;

                if (isset($this->clients[$clientId])) {
                    $this->flushClientOutput(
                        $clientId,
                        $logger
                    );
                }
            }

            $this->closeTimedOutClients($logger);
            $this->flushActiveSessionStats();
        }
        $this->shutdown($logger);
    }

    private function flushActiveSessionStats(): void
    {
        $now = time();

        $flushInterval = (int) config(
            'ntrip.stats_flush_seconds',
        );

        foreach ($this->clients as &$client) {
            if ($client['session_id'] === null) {
                continue;
            }

            if (
                $now - $client['last_stats_flush_at']
                < $flushInterval
            ) {
                continue;
            }

            $validRtcmFrames = null;
            $rtcmCrcErrors = null;
            $rtcmMessageCounts = null;

            if (
                $client['state'] === 'source'
                && $client['parser'] instanceof Rtcm3Parser
            ) {
                $validRtcmFrames =
                    $client['parser']->validFrames();

                $rtcmCrcErrors =
                    $client['parser']->crcErrors();

                $rtcmMessageCounts =
                    $client['parser']->messageCounts();
            }

            $this->sessions->updateStats(
                sessionId: $client['session_id'],
                bytesTransferred: $client['bytes_transferred'],
                validRtcmFrames: $validRtcmFrames,
                rtcmCrcErrors: $rtcmCrcErrors,
                rtcmMessageCounts: $rtcmMessageCounts,
            );

            $client['last_stats_flush_at'] =
                $now;
        }

        unset($client);
    }

    private function acceptClient(callable $logger): void
    {
        $peer = null;

        $socket = @stream_socket_accept(
            $this->serverSocket,
            0,
            $peer
        );

        if ($socket === false) {
            return;
        }

        stream_set_blocking($socket, false);

        $clientId = (int) $socket;
        $peerAddress = (string) $peer;

        $this->clients[$clientId] = [
            'socket' => $socket,
            'peer' => $peerAddress,
            'remote_ip' => $this->extractIp($peerAddress),
            'state' => 'headers',
            'input_buffer' => '',
            'output_buffer' => '',
            'mountpoint' => null,
            'station_id' => null,
            'rover_account_id' => null,
            'authenticated_username' => null,
            'client_agent' => null,
            'ntrip_version' => null,
            'session_id' => null,
            'parser' => null,
            'bytes_transferred' => 0,
            'connected_at' => time(),
            'last_activity' => time(),
            'last_stats_flush_at' => time(),
        ];

        $logger("Accepted connection from {$peerAddress}");
    }

    private function readClient(int $clientId, callable $logger): void
    {
        $client = &$this->clients[$clientId];

        $data = @fread(
            $client['socket'],
            (int) config('ntrip.read_chunk_bytes')
        );

        if ($data === false) {
            $this->disconnectClient(
                $clientId,
                'read_failed',
                $logger
            );

            return;
        }

        if ($data === '') {
            if (feof($client['socket'])) {
                $this->disconnectClient(
                    $clientId,
                    'peer_closed',
                    $logger
                );
            }

            return;
        }

        $client['last_activity'] = time();

        if ($client['state'] === 'headers') {
            $client['input_buffer'] .= $data;

            if (
                strlen($client['input_buffer'])
                > (int) config('ntrip.max_header_bytes')
            ) {
                $this->queueAndClose(
                    $clientId,
                    "HTTP/1.1 431 Request Header Fields Too Large\r\n"
                    ."Connection: close\r\n\r\n",
                    'header_too_large',
                    $logger
                );

                return;
            }

            $headerEnd = strpos(
                $client['input_buffer'],
                "\r\n\r\n"
            );

            if ($headerEnd === false) {
                return;
            }

            $header = substr(
                $client['input_buffer'],
                0,
                $headerEnd + 4
            );

            $remainingData = substr(
                $client['input_buffer'],
                $headerEnd + 4
            );

            $client['input_buffer'] = '';

            $this->handleHandshake(
                $clientId,
                $header,
                $logger
            );

            if (
                isset($this->clients[$clientId])
                && $remainingData !== ''
                && $this->clients[$clientId]['state']
                    === 'source'
            ) {
                $this->relaySourceData(
                    $clientId,
                    $remainingData,
                    $logger
                );
            }

            return;
        }

        if ($client['state'] === 'source') {
            $this->relaySourceData(
                $clientId,
                $data,
                $logger
            );
        }
    }

    private function handleHandshake(int $clientId, string $rawHeader, callable $logger): void
    {
        [$requestLine, $headers] =
            $this->parseRequestHeader($rawHeader);

        /*
         * Sourcetable:
         *
         * GET / HTTP/1.1
         */
        if (
            preg_match(
                '/^GET\s+\/(?:\s|\?)/i',
                $requestLine
            )
        ) {
            $this->sendSourcetable(
                $clientId,
                $logger
            );

            return;
        }

        /*
         * Rover:
         *
         * GET /BASE_001 HTTP/1.1
         */
        if (
            preg_match(
                '/^GET\s+\/([^?\s]+)(?:\?[^\s]*)?\s+HTTP\//i',
                $requestLine,
                $matches
            )
        ) {
            $mountpointName = rawurldecode(
                $matches[1]
            );

            $this->registerRover(
                $clientId,
                $mountpointName,
                $headers,
                $logger
            );

            return;
        }

        /*
         * NTRIP v2 Source:
         *
         * POST /BASE_001 HTTP/1.1
         * Authorization: Bearer token
         */
        if (
            preg_match(
                '/^POST\s+\/([^?\s]+)(?:\?[^\s]*)?\s+HTTP\//i',
                $requestLine,
                $matches
            )
        ) {
            $mountpointName = rawurldecode(
                $matches[1]
            );

            $this->registerSource(
                $clientId,
                $mountpointName,
                $this->extractBearerToken($headers),
                true,
                $headers,
                $logger
            );

            return;
        }

        /*
         * NTRIP v1 Source:
         *
         * SOURCE password /BASE_001
         */
        if (
            preg_match(
                '/^SOURCE\s+(\S+)\s+\/?(\S+)/i',
                $requestLine,
                $matches
            )
        ) {
            $sourceToken = $matches[1];

            $mountpointName = rawurldecode(
                $matches[2]
            );

            $this->registerSource(
                $clientId,
                $mountpointName,
                $sourceToken,
                false,
                [],
                $logger
            );

            return;
        }

        $this->queueAndClose(
            $clientId,
            "HTTP/1.1 400 Bad Request\r\n"
            ."Connection: close\r\n\r\n",
            'bad_request',
            $logger
        );
    }

    private function registerSource(
        int $clientId,
        string $mountpointName,
        ?string $sourceToken,
        bool $ntripV2,
        array $headers,
        callable $logger
    ): void {
        $entry = $this->catalog[$mountpointName]
            ?? null;

        if (
            $entry === null
            || ! $entry['mountpoint_enabled']
            || ! $entry['station_enabled']
        ) {
            $this->queueAndClose(
                $clientId,
                "HTTP/1.1 404 Not Found\r\n"
                ."Connection: close\r\n\r\n",
                'mountpoint_not_found',
                $logger
            );

            return;
        }

        if (
            $sourceToken === null
            || ! Hash::check(
                $sourceToken,
                $entry['source_token_hash']
            )
        ) {
            $this->queueAndClose(
                $clientId,
                "HTTP/1.1 401 Unauthorized\r\n"
                ."Connection: close\r\n\r\n",
                'source_unauthorized',
                $logger
            );

            return;
        }

        $this->disconnectExistingSource(
            $mountpointName,
            $clientId,
            $logger
        );

        $client = &$this->clients[$clientId];

        $client['state'] = 'source';
        $client['mountpoint'] = $mountpointName;
        $client['station_id'] = $entry['station_id'];
        $client['client_agent'] = $headers['user-agent'] ?? null;
        $client['ntrip_version'] = $headers['ntrip-version']
            ?? ($ntripV2 ? 'Ntrip/2.0' : 'Ntrip/1.0');
        $client['parser'] = new Rtcm3Parser;

        $response = $ntripV2
            ? "HTTP/1.1 200 OK\r\n"
                ."Ntrip-Version: Ntrip/2.0\r\n"
                ."Connection: keep-alive\r\n\r\n"
            : "ICY 200 OK\r\n\r\n";

        $this->queueOutput(
            $clientId,
            $response,
            $logger
        );

        Station::query()
            ->whereKey($entry['station_id'])
            ->update([
                'source_connected' => true,
                'last_seen_at' => now(),
                'last_ip' => $client['remote_ip'],
            ]);

        $session = $this->sessions->createSource(
            mountpointId: $entry['mountpoint_id'],
            stationId: $entry['station_id'],
            remoteIp: $client['remote_ip'],
            clientAgent: $client['client_agent'],
            ntripVersion: $client['ntrip_version'],
        );

        $client['session_id'] = $session->id;

        $logger(
            "Source connected to {$mountpointName}"
        );
    }

    private function registerRover(
        int $clientId,
        string $mountpointName,
        array $headers,
        callable $logger
    ): void {
        $entry = $this->catalog[$mountpointName]
            ?? null;

        if (
            $entry === null
            || ! $entry['mountpoint_enabled']
            || ! $entry['station_enabled']
        ) {
            $this->queueAndClose(
                $clientId,
                "HTTP/1.1 404 Not Found\r\n"
                ."Connection: close\r\n\r\n",
                'mountpoint_not_found',
                $logger
            );

            return;
        }

        $client = &$this->clients[$clientId];

        $connection = $this->roverConnections->connect(
            mountpointName: $mountpointName,
            headers: $headers,
            remoteIp: $client['remote_ip'],
        );

        if (! $connection->allowed()) {
            $code = $connection->authentication->code;

            $this->queueAndClose(
                $clientId,
                $this->roverDeniedResponse($code),
                'rover_auth_'.$code->value,
                $logger
            );

            return;
        }

        $account = $connection->authentication->account;
        $session = $connection->session;

        if ($session === null) {
            $this->queueAndClose(
                $clientId,
                "HTTP/1.1 500 Internal Server Error\r\n"
                ."Connection: close\r\n\r\n",
                'rover_session_missing',
                $logger
            );

            return;
        }

        $client['state'] = 'rover';
        $client['mountpoint'] = $mountpointName;
        $client['station_id'] = null;
        $client['rover_account_id'] = $account?->id;
        $client['authenticated_username'] = $account?->username;
        $client['client_agent'] = $headers['user-agent'] ?? null;
        $client['ntrip_version'] = $headers['ntrip-version'] ?? null;
        $client['session_id'] = $session->id;

        $this->queueOutput(
            $clientId,
            "HTTP/1.1 200 OK\r\n"
            ."Content-Type: gnss/data\r\n"
            ."Ntrip-Version: Ntrip/2.0\r\n"
            ."Connection: close\r\n\r\n",
            $logger
        );

        $identity = $account?->username ?? 'anonymous';

        $logger(
            "Rover {$identity} connected to {$mountpointName}"
        );
    }

    private function roverDeniedResponse(
        RoverAuthenticationCode $code
    ): string {
        $status = $code->httpStatus();

        $reason = match ($status) {
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            429 => 'Too Many Requests',
            default => 'Unauthorized',
        };

        $headers = [
            "HTTP/1.1 {$status} {$reason}",
            'Connection: close',
        ];

        if ($status === 401) {
            $headers[] = 'WWW-Authenticate: Basic realm="NTRIP"';
        }

        if ($status === 429) {
            $headers[] = 'Retry-After: 1';
        }

        return implode("\r\n", $headers)."\r\n\r\n";
    }

    private function relaySourceData(int $sourceClientId, string $data, callable $logger): void
    {
        if (! isset($this->clients[$sourceClientId])) {
            return;
        }

        $mountpointName =
            $this->clients[$sourceClientId]['mountpoint'];

        if ($mountpointName === null) {
            return;
        }

        $dataLength = strlen($data);

        $parser = $this->clients[$sourceClientId]['parser'];

        if ($parser instanceof Rtcm3Parser) {
            $parser->push($data);
        }

        $this->clients[$sourceClientId]['bytes_transferred'] += $dataLength;

        foreach (array_keys($this->clients) as $clientId) {
            if (
                $clientId === $sourceClientId
                || ! isset($this->clients[$clientId])
            ) {
                continue;
            }

            $client = $this->clients[$clientId];

            if (
                $client['state'] !== 'rover'
                || $client['mountpoint']
                    !== $mountpointName
            ) {
                continue;
            }

            $this->queueOutput(
                $clientId,
                $data,
                $logger
            );
        }
    }

    private function queueOutput(int $clientId, string $data, callable $logger): void
    {
        if (! isset($this->clients[$clientId])) {
            return;
        }

        $newSize = strlen(
            $this->clients[$clientId]['output_buffer']
        ) + strlen($data);

        if (
            $newSize
            > (int) config(
                'ntrip.max_client_buffer_bytes'
            )
        ) {
            $this->disconnectClient(
                $clientId,
                'client_too_slow',
                $logger
            );

            return;
        }

        $this->clients[$clientId]['output_buffer'] .= $data;
    }

    private function flushClientOutput(int $clientId, callable $logger): void
    {
        if (! isset($this->clients[$clientId])) {
            return;
        }

        $client = &$this->clients[$clientId];

        if ($client['output_buffer'] === '') {
            return;
        }

        $written = @fwrite(
            $client['socket'],
            $client['output_buffer']
        );

        if ($written === false) {
            $this->disconnectClient(
                $clientId,
                'write_failed',
                $logger
            );

            return;
        }

        if ($written === 0) {
            return;
        }

        $client['output_buffer'] = substr(
            $client['output_buffer'],
            $written
        );

        $client['last_activity'] = time();

        if ($client['state'] === 'rover') {
            $client['bytes_transferred'] += $written;
        }
    }

    private function sendSourcetable(int $clientId, callable $logger): void
    {
        $body = '';

        foreach ($this->catalog as $entry) {
            if (
                ! $entry['mountpoint_enabled']
                || ! $entry['station_enabled']
            ) {
                continue;
            }

            $authentication =
                $entry['access_mode'] === Mountpoint::ACCESS_PUBLIC
                ? 'N'
                : 'B';

            $body .= sprintf(
                'STR;%s;%s;%s;%s;2;%s;NONE;%s;'
                ."%.7f;%.7f;0;0;NTRIP;none;%s;N;0;\r\n",
                $entry['name'],
                $entry['identifier']
                    ?: $entry['name'],
                $entry['format'],
                $entry['format_details'] ?: '',
                $entry['nav_system'],
                $entry['country'],
                $entry['latitude'] ?? 0,
                $entry['longitude'] ?? 0,
                $authentication
            );
        }

        $body .= "ENDSOURCETABLE\r\n";

        $response =
            "SOURCETABLE 200 OK\r\n"
            ."Server: Laravel-NTRIP-Caster/1.0\r\n"
            ."Content-Type: text/plain\r\n"
            .'Content-Length: '.strlen($body)."\r\n"
            ."Connection: close\r\n\r\n"
            .$body;

        $this->queueAndClose(
            $clientId,
            $response,
            'sourcetable_sent',
            $logger
        );
    }

    private function refreshCatalog(callable $logger): void
    {
        $refreshSeconds = (int) config(
            'ntrip.catalog_refresh_seconds'
        );

        if (
            time() - $this->lastCatalogRefreshAt
            < $refreshSeconds
        ) {
            return;
        }

        $this->lastCatalogRefreshAt = time();

        try {
            $mountpoints = Mountpoint::query()
                ->with('station')
                ->get();

            $newCatalog = [];

            foreach ($mountpoints as $mountpoint) {
                $station = $mountpoint->station;

                if ($station === null) {
                    continue;
                }

                $newCatalog[$mountpoint->name] = [
                    'mountpoint_id' => $mountpoint->id,
                    'station_id' => $station->id,

                    'name' => $mountpoint->name,

                    'identifier' => $mountpoint->identifier,

                    'format' => $mountpoint->format,

                    'format_details' => $mountpoint->format_details,

                    'nav_system' => $mountpoint->nav_system,

                    'latitude' => $mountpoint->latitude,

                    'longitude' => $mountpoint->longitude,

                    'country' => $mountpoint->country,

                    'mountpoint_enabled' => $mountpoint->enabled,

                    'station_enabled' => $station->enabled,

                    'source_token_hash' => $station->source_token_hash,

                    'access_mode' => $mountpoint->access_mode,
                ];
            }

            $this->disconnectInvalidClients(
                $newCatalog,
                $logger
            );

            $this->catalog = $newCatalog;
        } catch (Throwable) {
            /*
             * Giữ catalog cũ khi SQLite tạm thời bị busy.
             */
        }
    }

    private function disconnectExistingSource(string $mountpointName, int $newSourceId, callable $logger): void
    {
        foreach (array_keys($this->clients) as $clientId) {
            if (
                $clientId === $newSourceId
                || ! isset($this->clients[$clientId])
            ) {
                continue;
            }

            $client = $this->clients[$clientId];

            if (
                $client['state'] === 'source'
                && $client['mountpoint']
                    === $mountpointName
            ) {
                $this->disconnectClient(
                    $clientId,
                    'source_replaced',
                    $logger
                );
            }
        }
    }

    private function extractBearerToken(array $headers): ?string
    {
        $authorization =
            $headers['authorization'] ?? '';

        if (
            ! preg_match(
                '/^Bearer\s+(.+)$/i',
                $authorization,
                $matches
            )
        ) {
            return null;
        }

        return trim($matches[1]);
    }

    private function parseRequestHeader(string $rawHeader): array
    {
        $lines = preg_split(
            '/\r\n/',
            trim($rawHeader)
        ) ?: [];

        $requestLine = array_shift($lines) ?? '';

        $headers = [];

        foreach ($lines as $line) {
            if (! str_contains($line, ':')) {
                continue;
            }

            [$name, $value] = explode(
                ':',
                $line,
                2
            );

            $headers[strtolower(trim($name))] =
                trim($value);
        }

        return [$requestLine, $headers];
    }

    private function closeTimedOutClients(callable $logger): void
    {
        $now = time();

        foreach (array_keys($this->clients) as $clientId) {
            if (! isset($this->clients[$clientId])) {
                continue;
            }

            $client = $this->clients[$clientId];

            if (
                $client['state'] === 'headers'
                && $now - $client['connected_at']
                    > (int) config(
                        'ntrip.header_timeout_seconds'
                    )
            ) {
                $this->disconnectClient(
                    $clientId,
                    'header_timeout',
                    $logger
                );

                continue;
            }

            if (
                $client['state'] === 'source'
                && $now - $client['last_activity']
                    > (int) config(
                        'ntrip.source_idle_timeout_seconds'
                    )
            ) {
                $this->disconnectClient(
                    $clientId,
                    'source_idle_timeout',
                    $logger
                );
            }
        }
    }

    private function queueAndClose(int $clientId, string $response, string $reason, callable $logger): void
    {
        if (! isset($this->clients[$clientId])) {
            return;
        }

        @fwrite(
            $this->clients[$clientId]['socket'],
            $response
        );

        $this->disconnectClient(
            $clientId,
            $reason,
            $logger
        );
    }

    private function disconnectClient(int $clientId, string $reason, callable $logger): void
    {
        if (! isset($this->clients[$clientId])) {
            return;
        }

        $client = $this->clients[$clientId];

        unset($this->clients[$clientId]);

        @fclose($client['socket']);

        if ($client['session_id'] !== null) {
            $validRtcmFrames = null;
            $rtcmCrcErrors = null;
            $rtcmMessageCounts = null;

            if ($client['state'] === 'source' && $client['parser'] instanceof Rtcm3Parser) {
                $validRtcmFrames =
                    $client['parser']->validFrames();

                $rtcmCrcErrors =
                    $client['parser']->crcErrors();

                $rtcmMessageCounts =
                    $client['parser']->messageCounts();
            }

            $this->sessions->end(
                sessionId: $client['session_id'],
                bytesTransferred: $client['bytes_transferred'],
                disconnectReason: $reason,
                validRtcmFrames: $validRtcmFrames,
                rtcmCrcErrors: $rtcmCrcErrors,
                rtcmMessageCounts: $rtcmMessageCounts,
            );
        }

        if (
            $client['state'] === 'source'
            && $client['station_id'] !== null
            && ! $this->hasConnectedSource($client['station_id'])
        ) {
            Station::query()
                ->whereKey($client['station_id'])
                ->update([
                    'source_connected' => false,
                ]);
        }

        $logger(
            sprintf(
                'Disconnected %s: %s',
                $client['peer'],
                $reason
            )
        );
    }

    private function extractIp(string $peer): string
    {
        if (str_starts_with($peer, '[')) {
            $end = strpos($peer, ']');

            if ($end !== false) {
                return substr(
                    $peer,
                    1,
                    $end - 1
                );
            }

            return $peer;
        }

        $lastColon = strrpos($peer, ':');

        if ($lastColon === false) {
            return $peer;
        }

        return substr(
            $peer,
            0,
            $lastColon
        );
    }

    private function resetStaleRuntimeState(): void
    {
        Station::query()->update([
            'source_connected' => false,
        ]);

        $this->sessions->endAllActive(
            disconnectReason: 'daemon_restarted',
        );
    }

    private function disconnectInvalidClients(array $newCatalog, callable $logger): void
    {

        foreach (array_keys($this->clients) as $clientId) {
            if (! isset($this->clients[$clientId])) {
                continue;
            }

            $client = $this->clients[$clientId];

            if (
                ! in_array(
                    $client['state'],
                    ['source', 'rover'],
                    true
                )
            ) {
                continue;
            }

            $mountpointName = $client['mountpoint'];

            if ($mountpointName === null) {
                continue;
            }

            $entry = $newCatalog[$mountpointName] ?? null;

            if ($entry === null) {
                $this->disconnectClient(
                    $clientId,
                    'mountpoint_removed',
                    $logger
                );

                continue;
            }

            if (! $entry['station_enabled']) {
                $this->disconnectClient(
                    $clientId,
                    'station_disabled',
                    $logger
                );

                continue;
            }

            if (! $entry['mountpoint_enabled']) {
                $this->disconnectClient(
                    $clientId,
                    'mountpoint_disabled',
                    $logger
                );
            }
        }
    }

    private function hasConnectedSource(int $stationId): bool
    {
        foreach ($this->clients as $client) {
            if (
                $client['state'] === 'source'
                && $client['station_id'] === $stationId
            ) {
                return true;
            }
        }

        return false;
    }

    public function requestShutdown(string $reason = 'daemon_shutdown'): void
    {
        $this->shutdownRequested = true;
        $this->shutdownReason = $reason;
    }

    private function shutdown(callable $logger): void
    {
        if ($this->shutdownCompleted) {
            return;
        }

        $this->shutdownCompleted = true;

        $reason = $this->shutdownReason ?? 'daemon_shutdown';

        $logger('NTRIP caster shutdown started.');

        if (is_resource($this->serverSocket)) {
            @fclose($this->serverSocket);
            $this->serverSocket = null;
        }

        $this->flushActiveSessionStats();

        /*
        * disconnectClient() sẽ:
        * - đóng socket
        * - cập nhật disconnected_at
        * - cập nhật bytes và RTCM stats
        * - đặt source_connected = false
        */
        foreach (array_keys($this->clients) as $clientId) {
            $this->disconnectClient(
                $clientId,
                $reason,
                $logger
            );
        }

        /*
        * Bảo đảm không còn station nào bị giữ trạng thái online.
        */
        Station::query()->update([
            'source_connected' => false,
        ]);

        $logger('NTRIP caster shutdown completed.');
    }
}
