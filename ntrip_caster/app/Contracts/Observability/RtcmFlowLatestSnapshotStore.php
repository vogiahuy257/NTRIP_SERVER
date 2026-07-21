<?php

namespace App\Contracts\Observability;

interface RtcmFlowLatestSnapshotStore
{
    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function put(
        array $snapshot,
    ): void;

    /**
     * @return array<string, mixed>|null
     */
    public function get(): ?array;
}
