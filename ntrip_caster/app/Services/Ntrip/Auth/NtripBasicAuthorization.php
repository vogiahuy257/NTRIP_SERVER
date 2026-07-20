<?php

namespace App\Services\Ntrip\Auth;

final class NtripBasicAuthorization
{
    /**
     * @return array{username: string, password: string}|null
     */
    public function parse(?string $authorization): ?array
    {
        if ($authorization === null) {
            return null;
        }

        if (! preg_match('/^Basic\s+(.+)$/i', trim($authorization), $matches)) {
            return null;
        }

        $decoded = base64_decode(trim($matches[1]), true);

        if ($decoded === false || ! str_contains($decoded, ':')) {
            return null;
        }

        [$username, $password] = explode(':', $decoded, 2);
        $username = trim($username);

        if ($username === '') {
            return null;
        }

        return [
            'username' => $username,
            'password' => $password,
        ];
    }
}
