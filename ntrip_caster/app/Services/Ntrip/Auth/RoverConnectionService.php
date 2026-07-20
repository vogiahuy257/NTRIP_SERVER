<?php

namespace App\Services\Ntrip\Auth;

use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final readonly class RoverConnectionService
{
    public function __construct(
        private NtripBasicAuthorization $basicAuthorization,
        private RoverAuthenticationService $authentication,
        private NtripSessionService $sessions,
    ) {}

    public function connect(
        string $mountpointName,
        array $headers,
        string $remoteIp,
    ): RoverConnectionResult {
        return DB::transaction(function () use (
            $mountpointName,
            $headers,
            $remoteIp,
        ): RoverConnectionResult {
            $credentials = $this->basicAuthorization->parse(
                $headers['authorization'] ?? null
            );

            $authentication = $this->authentication->authenticate(
                $mountpointName,
                $credentials['username'] ?? null,
                $credentials['password'] ?? null,
            );

            if (! $authentication->allowed()) {
                return new RoverConnectionResult(
                    authentication: $authentication,
                    session: null,
                );
            }

            $mountpoint = $authentication->mountpoint;

            if ($mountpoint === null) {
                throw new RuntimeException(
                    'Allowed Rover authentication has no Mountpoint.'
                );
            }

            $session = $this->sessions->createRover(
                mountpoint: $mountpoint,
                account: $authentication->account,
                remoteIp: $remoteIp,
                clientAgent: $headers['user-agent'] ?? null,
                ntripVersion: $headers['ntrip-version'] ?? null,
            );

            return new RoverConnectionResult(
                authentication: $authentication,
                session: $session,
            );
        });
    }
}
