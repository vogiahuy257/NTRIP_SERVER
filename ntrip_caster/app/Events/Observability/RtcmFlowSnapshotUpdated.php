<?php

namespace App\Events\Observability;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class RtcmFlowSnapshotUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function __construct(
        public readonly array $snapshot,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel(
                'ntrip.dashboard',
            ),
        ];
    }

    public function broadcastAs(): string
    {
        return 'rtcm.flow.snapshot.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'snapshot' => $this->snapshot,
        ];
    }
}
