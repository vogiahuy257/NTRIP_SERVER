<?php

declare(strict_types=1);

namespace App\Services\Ntrip\Auth;

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\MountpointRoverAccount;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use LogicException;

final class RoverAuthenticationService
{
    public function authenticate(
        string $mountpointName,
        ?string $username,
        ?string $password,
    ): RoverAuthenticationResult {
        $mountpointName = trim(
            ltrim($mountpointName, '/'),
        );

        $mountpoint = Mountpoint::query()
            ->where('name', $mountpointName)
            ->first();

        if ($mountpoint === null) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointNotFound,
            );
        }

        if (! $mountpoint->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointDisabled,
                $mountpoint,
            );
        }

        if ($mountpoint->isPublic()) {
            if ($this->mountpointLimitReached($mountpoint)) {
                return RoverAuthenticationResult::deny(
                    RoverAuthenticationCode::MountpointConnectionLimitReached,
                    $mountpoint,
                );
            }

            return RoverAuthenticationResult::allowPublic(
                $mountpoint,
            );
        }

        if (! $mountpoint->requiresAuthentication()) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::UnsupportedAccessMode,
                $mountpoint,
            );
        }

        $accountAuthentication =
            $this->authenticateAccount(
                $username,
                $password,
            );

        if (! $accountAuthentication->allowed()) {
            return RoverAuthenticationResult::deny(
                code: $accountAuthentication->code,
                mountpoint: $mountpoint,
                account: $accountAuthentication->account,
            );
        }

        $account = $accountAuthentication->account;

        if ($account === null) {
            throw new LogicException(
                'Allowed authentication has no Rover Account.',
            );
        }

        $authorizedMountpoint = $account
            ->mountpoints()
            ->where(
                'mountpoints.id',
                $mountpoint->id,
            )
            ->first();

        if ($authorizedMountpoint === null) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessNotGranted,
                $mountpoint,
                $account,
            );
        }

        /** @var MountpointRoverAccount $grant */
        $grant = $authorizedMountpoint->pivot;

        if (! $grant->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessDisabled,
                $mountpoint,
                $account,
            );
        }

        $grantStartsAt = $this->asDate(
            $grant->starts_at,
        );

        if ($grantStartsAt?->isFuture()) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessNotStarted,
                $mountpoint,
                $account,
            );
        }

        $grantExpiresAt = $this->asDate(
            $grant->expires_at,
        );

        if ($grantExpiresAt?->lessThanOrEqualTo(now())) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessExpired,
                $mountpoint,
                $account,
            );
        }

        if ($this->mountpointLimitReached($mountpoint)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointConnectionLimitReached,
                $mountpoint,
                $account,
            );
        }

        if (
            $this->grantLimitReached(
                mountpoint: $mountpoint,
                account: $account,
                grant: $grant,
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::GrantConnectionLimitReached,
                $mountpoint,
                $account,
            );
        }

        return RoverAuthenticationResult::allowAuthenticated(
            mountpoint: $mountpoint,
            account: $this->recordSuccessfulAuthentication(
                $account,
            ),
        );
    }

    public function authenticateAuto(
        ?string $username,
        ?string $password,
    ): RoverAuthenticationResult {
        $authentication = $this->authenticateAccount(
            $username,
            $password,
        );

        if (! $authentication->allowed()) {
            return $authentication;
        }

        $account = $authentication->account;

        if ($account === null) {
            throw new LogicException(
                'Allowed AUTO authentication has no Rover Account.',
            );
        }

        if (! $this->hasUsableMountpointGrant($account)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessNotGranted,
                account: $account,
            );
        }

        return RoverAuthenticationResult::allowAutoAuthenticated(
            $this->recordSuccessfulAuthentication(
                $account,
            ),
        );
    }

    private function authenticateAccount(
        ?string $username,
        ?string $password,
    ): RoverAuthenticationResult {
        if (blank($username) || blank($password)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::CredentialsRequired,
            );
        }

        $normalizedUsername = Str::lower(
            trim((string) $username),
        );

        $account = RoverAccount::query()
            ->where('username', $normalizedUsername)
            ->first();

        if (
            $account === null
            || ! Hash::check(
                (string) $password,
                $account->password_hash,
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::InvalidCredentials,
            );
        }

        if (! $account->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountDisabled,
                account: $account,
            );
        }

        $accountExpiresAt = $this->asDate(
            $account->expires_at,
        );

        if ($accountExpiresAt?->lessThanOrEqualTo(now())) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountExpired,
                account: $account,
            );
        }

        if ($this->accountLimitReached($account)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountConnectionLimitReached,
                account: $account,
            );
        }

        return RoverAuthenticationResult::allowAutoAuthenticated(
            $account,
        );
    }

    private function hasUsableMountpointGrant(
        RoverAccount $account,
    ): bool {
        $now = now();

        return $account
            ->mountpoints()
            ->where('mountpoints.enabled', true)
            ->where(
                'mountpoint_rover_account.enabled',
                true,
            )
            ->where(
                function (Builder $query) use ($now): void {
                    $query
                        ->whereNull(
                            'mountpoint_rover_account.starts_at',
                        )
                        ->orWhere(
                            'mountpoint_rover_account.starts_at',
                            '<=',
                            $now,
                        );
                },
            )
            ->where(
                function (Builder $query) use ($now): void {
                    $query
                        ->whereNull(
                            'mountpoint_rover_account.expires_at',
                        )
                        ->orWhere(
                            'mountpoint_rover_account.expires_at',
                            '>',
                            $now,
                        );
                },
            )
            ->exists();
    }

    private function recordSuccessfulAuthentication(
        RoverAccount $account,
    ): RoverAccount {
        $account->forceFill([
            'last_authenticated_at' => now(),
        ])->saveQuietly();

        return $account->fresh();
    }

    private function asDate(
        mixed $value,
    ): ?CarbonInterface {
        if ($value === null) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value;
        }

        return Carbon::parse((string) $value);
    }

    /**
     * @return Builder<NtripSession>
     */
    private function activeRoverSessions(): Builder
    {
        return NtripSession::query()
            ->rovers()
            ->active();
    }

    private function accountLimitReached(
        RoverAccount $account,
    ): bool {
        if ($account->max_connections < 1) {
            return true;
        }

        return $this->activeRoverSessions()
            ->where(
                'rover_account_id',
                $account->id,
            )
            ->count() >= $account->max_connections;
    }

    private function mountpointLimitReached(
        Mountpoint $mountpoint,
    ): bool {
        if ($mountpoint->max_rover_connections === null) {
            return false;
        }

        return $this->activeRoverSessions()
            ->where(
                'mountpoint_id',
                $mountpoint->id,
            )
            ->count()
            >= $mountpoint->max_rover_connections;
    }

    private function grantLimitReached(
        Mountpoint $mountpoint,
        RoverAccount $account,
        MountpointRoverAccount $grant,
    ): bool {
        if ($grant->max_connections === null) {
            return false;
        }

        return $this->activeRoverSessions()
            ->where(
                'mountpoint_id',
                $mountpoint->id,
            )
            ->where(
                'rover_account_id',
                $account->id,
            )
            ->count() >= $grant->max_connections;
    }
}
