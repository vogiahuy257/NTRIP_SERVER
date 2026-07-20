<?php

namespace App\Enums\Ntrip;

enum RoverAuthenticationCode: string
{
    case AllowedPublic = 'allowed_public';

    case AllowedAuthenticated = 'allowed_authenticated';

    case MountpointNotFound = 'mountpoint_not_found';

    case MountpointDisabled = 'mountpoint_disabled';

    case UnsupportedAccessMode = 'unsupported_access_mode';

    case CredentialsRequired = 'credentials_required';

    case InvalidCredentials = 'invalid_credentials';

    case AccountDisabled = 'account_disabled';

    case AccountExpired = 'account_expired';

    case AccessNotGranted = 'access_not_granted';

    case AccessDisabled = 'access_disabled';

    case AccessNotStarted = 'access_not_started';

    case AccessExpired = 'access_expired';

    case AccountConnectionLimitReached =
        'account_connection_limit_reached';

    case MountpointConnectionLimitReached =
        'mountpoint_connection_limit_reached';

    case GrantConnectionLimitReached =
        'grant_connection_limit_reached';

    public function allowed(): bool
    {
        return match ($this) {
            self::AllowedPublic,
            self::AllowedAuthenticated => true,

            default => false,
        };
    }

    public function httpStatus(): int
    {
        return match ($this) {
            self::AllowedPublic,
            self::AllowedAuthenticated => 200,

            self::MountpointNotFound => 404,

            self::CredentialsRequired,
            self::InvalidCredentials => 401,

            self::AccountConnectionLimitReached,
            self::MountpointConnectionLimitReached,
            self::GrantConnectionLimitReached => 429,

            default => 403,
        };
    }

    public function publicMessage(): string
    {
        return match ($this) {
            self::AllowedPublic,
            self::AllowedAuthenticated => 'Authorized',

            self::MountpointNotFound => 'Mountpoint not found',

            self::MountpointDisabled => 'Mountpoint is disabled',

            self::AccountConnectionLimitReached,
            self::MountpointConnectionLimitReached,
            self::GrantConnectionLimitReached => 'Connection limit reached',

            default => 'Unauthorized',
        };
    }
}
