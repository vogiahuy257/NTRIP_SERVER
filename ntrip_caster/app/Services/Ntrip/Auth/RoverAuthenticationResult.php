<?php

namespace App\Services\Ntrip\Auth;

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\RoverAccount;

final readonly class RoverAuthenticationResult
{
    private function __construct(
        public RoverAuthenticationCode $code,
        public ?Mountpoint $mountpoint,
        public ?RoverAccount $account,
    ) {}

    public static function allowPublic(
        Mountpoint $mountpoint
    ): self {
        return new self(
            code: RoverAuthenticationCode::AllowedPublic,
            mountpoint: $mountpoint,
            account: null,
        );
    }

    public static function allowAuthenticated(
        Mountpoint $mountpoint,
        RoverAccount $account
    ): self {
        return new self(
            code: RoverAuthenticationCode::AllowedAuthenticated,
            mountpoint: $mountpoint,
            account: $account,
        );
    }

    public static function deny(
        RoverAuthenticationCode $code,
        ?Mountpoint $mountpoint = null,
        ?RoverAccount $account = null
    ): self {
        return new self(
            code: $code,
            mountpoint: $mountpoint,
            account: $account,
        );
    }

    public function allowed(): bool
    {
        return $this->code->allowed();
    }

    public function authenticated(): bool
    {
        return $this->code
            === RoverAuthenticationCode::AllowedAuthenticated;
    }
}
