<?php

namespace App\Events\Devices;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

abstract class PendingDeviceEvent implements ShouldBroadcast
{
    use Dispatchable;

    /**
     * @param  array<string, mixed>  $device
     */
    public function __construct(
        public readonly array $device,
        public readonly string $occurredAt,
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
        return 'device.'.$this->action();
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'version' => 1,
            'entity' => 'pending_device',
            'action' => $this->action(),
            'occurred_at' => $this->occurredAt,
            'device' => $this->device,
        ];
    }

    abstract protected function action(): string;
}
