<?php

use App\Events\Observability\RtcmFlowSnapshotUpdated;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

test(
    'it defines the RTCM flow realtime contract',
    function (): void {
        $snapshot = [
            'version' => 1,
            'sequence' => 10,
            'mountpoints' => [],
            'rovers' => [],
        ];

        $event =
            new RtcmFlowSnapshotUpdated(
                $snapshot,
            );

        expect($event)
            ->toBeInstanceOf(
                ShouldBroadcastNow::class,
            );

        $channels = $event->broadcastOn();

        expect($channels)
            ->toHaveCount(1)
            ->and($channels[0])
            ->toBeInstanceOf(
                PrivateChannel::class,
            )
            ->and($channels[0]->name)
            ->toBe(
                'private-ntrip.dashboard',
            )
            ->and($event->broadcastAs())
            ->toBe(
                'rtcm.flow.snapshot.updated',
            )
            ->and($event->broadcastWith())
            ->toBe([
                'snapshot' => $snapshot,
            ]);
    },
)->group('backend');
