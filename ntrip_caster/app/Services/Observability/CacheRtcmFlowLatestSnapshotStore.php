<?php

namespace App\Services\Observability;

use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;
use Illuminate\Contracts\Cache\Repository;

final class CacheRtcmFlowLatestSnapshotStore implements RtcmFlowLatestSnapshotStore
{
    private const CACHE_KEY =
        'ntrip:observability:rtcm-flow:latest:v1';

    public function __construct(
        private readonly Repository $cache,
        private readonly int $ttlSeconds,
    ) {}

    public function put(
        array $snapshot,
    ): void {
        $this->cache->put(
            self::CACHE_KEY,
            $snapshot,
            max(
                1,
                $this->ttlSeconds,
            ),
        );
    }

    public function get(): ?array
    {
        $value = $this->cache->get(
            self::CACHE_KEY,
        );

        if (! is_array($value)) {
            return null;
        }

        foreach (array_keys($value) as $key) {
            if (! is_string($key)) {
                return null;
            }
        }

        /** @var array<string, mixed> $value */
        return $value;
    }
}
