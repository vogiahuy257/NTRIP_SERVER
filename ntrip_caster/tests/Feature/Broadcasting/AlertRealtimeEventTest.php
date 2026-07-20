<?php

use App\Events\Alerts\AlertAcknowledged;
use App\Events\Alerts\AlertOpened;
use App\Events\Alerts\AlertResolved;
use App\Events\Alerts\AlertUpdated;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

it(
    'defines the alert realtime contract',
    function (): void {
        $occurredAt =
            now()->toIso8601String();

        $payload = [
            'id' => 10,
            'type' => 'source_disconnected',
            'severity' => 'critical',
            'status' => 'open',
        ];

        $events = [
            'alert.opened' => new AlertOpened(
                alert: $payload,
                occurredAt: $occurredAt,
            ),

            'alert.updated' => new AlertUpdated(
                alert: $payload,
                occurredAt: $occurredAt,
            ),

            'alert.acknowledged' => new AlertAcknowledged(
                alert: $payload,
                occurredAt: $occurredAt,
            ),

            'alert.resolved' => new AlertResolved(
                alert: $payload,
                occurredAt: $occurredAt,
            ),
        ];

        foreach (
            $events as $expectedName => $event
        ) {
            expect($event)
                ->toBeInstanceOf(
                    ShouldBroadcast::class,
                )
                ->and(
                    $event->broadcastAs(),
                )
                ->toBe($expectedName);

            $channels =
                $event->broadcastOn();

            expect($channels)
                ->toHaveCount(1)
                ->and($channels[0])
                ->toBeInstanceOf(
                    PrivateChannel::class,
                )
                ->and($channels[0]->name)
                ->toBe(
                    'private-ntrip.dashboard',
                );

            expect(
                $event->broadcastWith(),
            )->toBe([
                'version' => 1,
                'entity' => 'alert',
                'action' => str_replace(
                    'alert.',
                    '',
                    $expectedName,
                ),
                'occurred_at' => $occurredAt,
                'alert' => $payload,
            ]);
        }
    },
)->group('backend');
