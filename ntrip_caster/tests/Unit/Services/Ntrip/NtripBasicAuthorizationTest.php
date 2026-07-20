<?php

use App\Services\Ntrip\Auth\NtripBasicAuthorization;

pest()->group('backend');

beforeEach(function (): void {
    $this->parser = new NtripBasicAuthorization;
});

test('valid Basic authorization is parsed', function (): void {
    $header = 'Basic '.base64_encode(
        'rover-uav-001:StrongPassword@123'
    );

    expect($this->parser->parse($header))->toBe([
        'username' => 'rover-uav-001',
        'password' => 'StrongPassword@123',
    ]);
});

test('password may contain colon characters', function (): void {
    $header = 'Basic '.base64_encode(
        'rover-uav-001:password:with:colon'
    );

    expect($this->parser->parse($header))->toBe([
        'username' => 'rover-uav-001',
        'password' => 'password:with:colon',
    ]);
});

test('invalid Basic authorization returns null', function (
    ?string $header
): void {
    expect($this->parser->parse($header))->toBeNull();
})->with([
    'missing header' => null,
    'wrong scheme' => 'Bearer token',
    'invalid base64' => 'Basic !!!',
    'missing separator' => 'Basic '.base64_encode('rover-only'),
    'empty username' => 'Basic '.base64_encode(':password'),
]);
