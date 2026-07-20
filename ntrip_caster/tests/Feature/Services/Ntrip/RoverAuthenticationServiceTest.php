<?php

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Services\Ntrip\Auth\RoverAuthenticationService;
use Database\Factories\RoverAccountFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

function createRoverAuthenticationFixture(
    array $mountpointOverrides = [],
    array $accountOverrides = [],
    array $grantOverrides = []
): array {
    $mountpoint = Mountpoint::factory()->create(
        $mountpointOverrides
    );

    $account = RoverAccount::factory()->create(
        $accountOverrides
    );

    $account->mountpoints()->attach(
        $mountpoint->id,
        array_merge([
            'enabled' => true,
            'max_connections' => null,
            'starts_at' => null,
            'expires_at' => null,
            'created_by' => null,
        ], $grantOverrides)
    );

    return [$mountpoint, $account];
}

function createActiveRoverSession(
    Mountpoint $mountpoint,
    ?RoverAccount $account
): NtripSession {
    return NtripSession::factory()->create([
        'mountpoint_id' => $mountpoint->id,

        'rover_account_id' => $account?->id,

        'authenticated_username' => $account?->username,

        'connection_type' => NtripSession::TYPE_ROVER,

        'connected_at' => now(),

        'disconnected_at' => null,
    ]);
}

beforeEach(function (): void {
    $this->service = app(
        RoverAuthenticationService::class
    );
});

test(
    'public mountpoint allows anonymous rover',
    function (): void {
        $mountpoint = Mountpoint::factory()
            ->publicAccess()
            ->create();

        $result = $this->service->authenticate(
            $mountpoint->name,
            null,
            null
        );

        expect($result->allowed())->toBeTrue()
            ->and($result->authenticated())->toBeFalse()
            ->and($result->code)->toBe(
                RoverAuthenticationCode::AllowedPublic
            )
            ->and($result->account)->toBeNull();
    }
);

test(
    'disabled mountpoint is rejected',
    function (): void {
        $mountpoint = Mountpoint::factory()
            ->disabled()
            ->create();

        $result = $this->service->authenticate(
            $mountpoint->name,
            null,
            null
        );

        expect($result->allowed())->toBeFalse()
            ->and($result->code)->toBe(
                RoverAuthenticationCode::MountpointDisabled
            );
    }
);

test(
    'authenticated mountpoint requires credentials',
    function (): void {
        $mountpoint = Mountpoint::factory()->create();

        $result = $this->service->authenticate(
            $mountpoint->name,
            null,
            null
        );

        expect($result->allowed())->toBeFalse()
            ->and($result->code)->toBe(
                RoverAuthenticationCode::CredentialsRequired
            );
    }
);

test(
    'wrong password is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture();

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            'wrong-password'
        );

        expect($result->allowed())->toBeFalse()
            ->and($result->code)->toBe(
                RoverAuthenticationCode::InvalidCredentials
            );
    }
);

test(
    'disabled rover account is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                accountOverrides: [
                    'enabled' => false,
                ]
            );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccountDisabled
        );
    }
);

test(
    'expired rover account is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                accountOverrides: [
                    'expires_at' => now()->subMinute(),
                ]
            );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccountExpired
        );
    }
);

test(
    'account without mountpoint grant is rejected',
    function (): void {
        $mountpoint =
            Mountpoint::factory()->create();

        $account =
            RoverAccount::factory()->create();

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccessNotGranted
        );
    }
);

test(
    'disabled mountpoint grant is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                grantOverrides: [
                    'enabled' => false,
                ]
            );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccessDisabled
        );
    }
);

test(
    'future mountpoint grant is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                grantOverrides: [
                    'starts_at' => now()->addHour(),
                ]
            );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccessNotStarted
        );
    }
);

test(
    'expired mountpoint grant is rejected',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                grantOverrides: [
                    'expires_at' => now()->subMinute(),
                ]
            );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccessExpired
        );
    }
);

test(
    'account connection limit is enforced',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                accountOverrides: [
                    'max_connections' => 1,
                ]
            );

        createActiveRoverSession(
            $mountpoint,
            $account
        );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::AccountConnectionLimitReached
        );
    }
);

test(
    'mountpoint connection limit is enforced',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                mountpointOverrides: [
                    'max_rover_connections' => 1,
                ],
                accountOverrides: [
                    'max_connections' => 10,
                ]
            );

        $otherAccount =
            RoverAccount::factory()->create();

        createActiveRoverSession(
            $mountpoint,
            $otherAccount
        );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::MountpointConnectionLimitReached
        );
    }
);

test(
    'per grant connection limit is enforced',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                mountpointOverrides: [
                    'max_rover_connections' => 10,
                ],
                accountOverrides: [
                    'max_connections' => 10,
                ],
                grantOverrides: [
                    'max_connections' => 1,
                ]
            );

        createActiveRoverSession(
            $mountpoint,
            $account
        );

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->code)->toBe(
            RoverAuthenticationCode::GrantConnectionLimitReached
        );
    }
);

test(
    'valid rover credentials are authorized',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture();

        expect(
            $account->last_authenticated_at
        )->toBeNull();

        $result = $this->service->authenticate(
            $mountpoint->name,
            strtoupper($account->username),
            RoverAccountFactory::PASSWORD
        );

        expect($result->allowed())->toBeTrue()
            ->and($result->authenticated())->toBeTrue()
            ->and($result->code)->toBe(
                RoverAuthenticationCode::AllowedAuthenticated
            )
            ->and($result->account?->id)->toBe(
                $account->id
            )
            ->and(
                $account
                    ->fresh()
                    ->last_authenticated_at
            )->not->toBeNull();
    }
);

test(
    'closed sessions do not consume connection limit',
    function (): void {
        [$mountpoint, $account] =
            createRoverAuthenticationFixture(
                accountOverrides: [
                    'max_connections' => 1,
                ]
            );

        NtripSession::factory()
            ->disconnected()
            ->create([
                'mountpoint_id' => $mountpoint->id,

                'rover_account_id' => $account->id,

                'authenticated_username' => $account->username,
            ]);

        $result = $this->service->authenticate(
            $mountpoint->name,
            $account->username,
            RoverAccountFactory::PASSWORD
        );

        expect($result->allowed())->toBeTrue();
    }
);
