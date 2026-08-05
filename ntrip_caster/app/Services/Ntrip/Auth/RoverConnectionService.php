<?php

declare(strict_types=1);

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

    /**
     * @param  array<string, string>  $headers
     */
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
            $credentials = $this->credentials($headers);

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
                    'Allowed Rover authentication has no Mountpoint.',
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

    /**
     * @param  array<string, string>  $headers
     */
    public function connectAuto(
        string $requestedMountpoint,
        array $headers,
        string $remoteIp,
    ): RoverConnectionResult {
        return DB::transaction(function () use (
            $requestedMountpoint,
            $headers,
            $remoteIp,
        ): RoverConnectionResult {
            $credentials = $this->credentials($headers);

            $authentication =
                $this->authentication->authenticateAuto(
                    $credentials['username'] ?? null,
                    $credentials['password'] ?? null,
                );

            if (! $authentication->allowed()) {
                return new RoverConnectionResult(
                    authentication: $authentication,
                    session: null,
                );
            }

            $account = $authentication->account;

            if ($account === null) {
                throw new RuntimeException(
                    'Allowed AUTO authentication has no Rover Account.',
                );
            }

            $session = $this->sessions->createAutoRover(
                requestedMountpoint: $requestedMountpoint,
                account: $account,
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

    /**
     * @param  array<string, string>  $headers
     * @return array{username: string, password: string}|null
     */
    private function credentials(array $headers): ?array
    {
        return $this->basicAuthorization->parse(
            $headers['authorization'] ?? null,
        );
    }
}
