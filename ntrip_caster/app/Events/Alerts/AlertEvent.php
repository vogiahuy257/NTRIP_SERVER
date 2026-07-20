<?php

namespace App\Events\Alerts;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

abstract class AlertEvent implements ShouldBroadcast
{
    use Dispatchable;

    /**
     * @param  array<string, mixed>  $alert
     */
    public function __construct(
        public readonly array $alert,
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
        return 'alert.'.$this->action();
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'version' => 1,
            'entity' => 'alert',
            'action' => $this->action(),
            'occurred_at' => $this->occurredAt,
            'alert' => $this->alert,
        ];
    }

    abstract protected function action(): string;
}
