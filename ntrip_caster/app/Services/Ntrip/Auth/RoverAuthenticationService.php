<?php

namespace App\Services\Ntrip\Auth;

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\MountpointRoverAccount;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class RoverAuthenticationService
{
    public function authenticate(
        string $mountpointName,
        ?string $username,
        ?string $password
    ): RoverAuthenticationResult {
        $mountpointName = trim(
            ltrim($mountpointName, '/')
        );

        $mountpoint = Mountpoint::query()
            ->where('name', $mountpointName)
            ->first();

        if ($mountpoint === null) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointNotFound
            );
        }

        if (! $mountpoint->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointDisabled,
                $mountpoint
            );
        }

        if ($mountpoint->isPublic()) {
            if (
                $this->mountpointLimitReached(
                    $mountpoint
                )
            ) {
                return RoverAuthenticationResult::deny(
                    RoverAuthenticationCode::MountpointConnectionLimitReached,
                    $mountpoint
                );
            }

            return RoverAuthenticationResult::allowPublic(
                $mountpoint
            );
        }

        if (! $mountpoint->requiresAuthentication()) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::UnsupportedAccessMode,
                $mountpoint
            );
        }

        if (
            blank($username)
            || blank($password)
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::CredentialsRequired,
                $mountpoint
            );
        }

        $normalizedUsername = Str::lower(
            trim((string) $username)
        );

        $account = RoverAccount::query()
            ->where(
                'username',
                $normalizedUsername
            )
            ->first();

        if (
            $account === null
            || ! Hash::check(
                (string) $password,
                $account->password_hash
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::InvalidCredentials,
                $mountpoint
            );
        }

        if (! $account->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountDisabled,
                $mountpoint,
                $account
            );
        }

        if (
            $account->expires_at !== null
            && $account->expires_at->lessThanOrEqualTo(
                now()
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountExpired,
                $mountpoint,
                $account
            );
        }

        $authorizedMountpoint = $account
            ->mountpoints()
            ->where(
                'mountpoints.id',
                $mountpoint->id
            )
            ->first();

        if ($authorizedMountpoint === null) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessNotGranted,
                $mountpoint,
                $account
            );
        }

        /** @var MountpointRoverAccount $grant */
        $grant = $authorizedMountpoint->pivot;

        if (! $grant->enabled) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessDisabled,
                $mountpoint,
                $account
            );
        }

        if (
            $grant->starts_at !== null
            && $grant->starts_at->isFuture()
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessNotStarted,
                $mountpoint,
                $account
            );
        }

        if (
            $grant->expires_at !== null
            && $grant->expires_at->lessThanOrEqualTo(
                now()
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccessExpired,
                $mountpoint,
                $account
            );
        }

        if ($this->accountLimitReached($account)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::AccountConnectionLimitReached,
                $mountpoint,
                $account
            );
        }

        if ($this->mountpointLimitReached($mountpoint)) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::MountpointConnectionLimitReached,
                $mountpoint,
                $account
            );
        }

        if (
            $this->grantLimitReached(
                mountpoint: $mountpoint,
                account: $account,
                grant: $grant
            )
        ) {
            return RoverAuthenticationResult::deny(
                RoverAuthenticationCode::GrantConnectionLimitReached,
                $mountpoint,
                $account
            );
        }

        $account->forceFill([
            'last_authenticated_at' => now(),
        ])->saveQuietly();

        return RoverAuthenticationResult::allowAuthenticated(
            mountpoint: $mountpoint,
            account: $account->fresh()
        );
    }

    private function activeRoverSessions(): Builder
    {
        return NtripSession::query()
            ->rovers()
            ->active();
    }

    private function accountLimitReached(
        RoverAccount $account
    ): bool {
        if ($account->max_connections < 1) {
            return true;
        }

        return $this->activeRoverSessions()
            ->where(
                'rover_account_id',
                $account->id
            )
            ->count() >= $account->max_connections;
    }

    private function mountpointLimitReached(
        Mountpoint $mountpoint
    ): bool {
        if (
            $mountpoint->max_rover_connections
            === null
        ) {
            return false;
        }

        return $this->activeRoverSessions()
            ->where(
                'mountpoint_id',
                $mountpoint->id
            )
            ->count()
            >= $mountpoint->max_rover_connections;
    }

    private function grantLimitReached(
        Mountpoint $mountpoint,
        RoverAccount $account,
        MountpointRoverAccount $grant
    ): bool {
        if ($grant->max_connections === null) {
            return false;
        }

        return $this->activeRoverSessions()
            ->where(
                'mountpoint_id',
                $mountpoint->id
            )
            ->where(
                'rover_account_id',
                $account->id
            )
            ->count() >= $grant->max_connections;
    }
}
