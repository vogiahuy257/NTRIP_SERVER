<?php

use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;

uses()->group('backend');

it('stores and retrieves the latest RTCM flow snapshot', function (): void {
    config()->set(
        'ntrip.observability.latest_snapshot.cache_store',
        'array',
    );

    config()->set(
        'ntrip.observability.latest_snapshot.ttl_seconds',
        10,
    );

    /*
     * Bảo đảm singleton được tạo lại sau khi thay config.
     */
    app()->forgetInstance(
        RtcmFlowLatestSnapshotStore::class,
    );

    $store = app(
        RtcmFlowLatestSnapshotStore::class,
    );

    $snapshot = [
        'sequence' => 123,
        'captured_at' => '2026-07-31T16:30:00+07:00',
        'mountpoints' => [
            [
                'name' => 'BASE',
                'bytes_per_second' => 4096,
            ],
        ],
        'rovers' => [
            [
                'username' => 'rover-01',
                'rtcm_age_ms' => 250,
            ],
        ],
    ];

    $store->put($snapshot);

    expect($store->get())
        ->toBe($snapshot);
});
