<?php

namespace App\Services\Ntrip\Auth;

use App\Models\NtripSession;

final readonly class RoverConnectionResult
{
    public function __construct(
        public RoverAuthenticationResult $authentication,
        public ?NtripSession $session,
    ) {}

    public function allowed(): bool
    {
        return $this->authentication->allowed();
    }
}
