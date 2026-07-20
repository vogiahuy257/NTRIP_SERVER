<?php

use App\Enums\Ntrip\RoverAuthenticationCode;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Models\Station;
use App\Services\Ntrip\Auth\RoverConnectionService;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Database\Factories\RoverAccountFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

pest()->group('backend');

beforeEach(function (): void {
    $this->connections = app(RoverConnectionService::class);
    $this->sessions = app(NtripSessionService::class);
});

test('public Rover connection creates anonymous session', function (): void {
    $mountpoint = Mountpoint::factory()
        ->publicAccess()
        ->create();

    $result = $this->connections->connect(
        mountpointName: $mountpoint->name,
        headers: [
            'user-agent' => 'Test Rover Client',
            'ntrip-version' => 'Ntrip/2.0',
        ],
        remoteIp: '10.5.10.50',
    );

    expect($result->allowed())->toBeTrue()
        ->and($result->authentication->code)->toBe(
            RoverAuthenticationCode::AllowedPublic
        )
        ->and($result->session)->not->toBeNull()
        ->and($result->session?->rover_account_id)->toBeNull()
        ->and($result->session?->authenticated_username)->toBeNull()
        ->and($result->session?->station_id)->toBeNull()
        ->and($result->session?->client_agent)->toBe(
            'Test Rover Client'
        )
        ->and($result->session?->ntrip_version)->toBe(
            'Ntrip/2.0'
        );
});

test('authenticated Rover connection creates identified session', function (): void {
    $mountpoint = Mountpoint::factory()->create();
    $account = RoverAccount::factory()->create();

    $account->mountpoints()->attach($mountpoint->id, [
        'enabled' => true,
        'max_connections' => 1,
    ]);

    $result = $this->connections->connect(
        mountpointName: $mountpoint->name,
        headers: [
            'authorization' => 'Basic '.base64_encode(
                $account->username.':'.RoverAccountFactory::PASSWORD
            ),
            'user-agent' => 'RTKLIB/2.4.3',
            'ntrip-version' => 'Ntrip/2.0',
        ],
        remoteIp: '10.5.10.51',
    );

    expect($result->allowed())->toBeTrue()
        ->and($result->authentication->code)->toBe(
            RoverAuthenticationCode::AllowedAuthenticated
        )
        ->and($result->session?->rover_account_id)->toBe(
            $account->id
        )
        ->and($result->session?->authenticated_username)->toBe(
            $account->username
        )
        ->and($result->session?->mountpoint_id)->toBe(
            $mountpoint->id
        )
        ->and($result->session?->remote_ip)->toBe(
            '10.5.10.51'
        );
});

test('denied Rover connection does not create session', function (): void {
    $mountpoint = Mountpoint::factory()->create();

    $result = $this->connections->connect(
        mountpointName: $mountpoint->name,
        headers: [],
        remoteIp: '10.5.10.52',
    );

    expect($result->allowed())->toBeFalse()
        ->and($result->authentication->code)->toBe(
            RoverAuthenticationCode::CredentialsRequired
        )
        ->and($result->session)->toBeNull()
        ->and(NtripSession::query()->count())->toBe(0);
});

test('source session stores Station identity', function (): void {
    $station = Station::factory()->create();
    $mountpoint = Mountpoint::factory()
        ->for($station)
        ->create();

    $session = $this->sessions->createSource(
        mountpointId: $mountpoint->id,
        stationId: $station->id,
        remoteIp: '10.5.10.25',
        clientAgent: 'ESP-IDF NTRIP Source',
        ntripVersion: 'Ntrip/2.0',
    );

    expect($session->connection_type)->toBe(
        NtripSession::TYPE_SOURCE
    )
        ->and($session->station_id)->toBe($station->id)
        ->and($session->mountpoint_id)->toBe($mountpoint->id)
        ->and($session->rover_account_id)->toBeNull()
        ->and($session->authenticated_username)->toBeNull();
});
