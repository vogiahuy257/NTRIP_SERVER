<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

abstract class NtripSessionEvent implements ShouldBroadcast
{
    use Dispatchable;

    /**
     * @param  array<string, mixed>  $session
     */
    public function __construct(
        public readonly array $session,
        public readonly string $occurredAt,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('ntrip.dashboard'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ntrip.session.'.$this->action();
    }

    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'version' => 1,
            'entity' => 'ntrip_session',
            'action' => $this->action(),
            'occurred_at' => $this->occurredAt,
            'session' => $this->session,
        ];
    }

    abstract protected function action(): string;
}
