<?php

use App\Events\Devices\PendingDeviceDiscovered;
use App\Events\Devices\PendingDeviceUpdated;
use Illuminate\Broadcasting\PrivateChannel;

it(
    'defines the pending device realtime event contract',
    function (): void {
        $occurredAt =
            '2026-07-20T08:00:00+00:00';

        $device = [
            'id' => 10,

            'hardware_id' => 'ESP32-F024F90E449C',

            'reported_device_id' => 'CTUAV-BASE-REAL-001',

            'reported_mountpoint' => 'CTUAV-RTCM-REAL-001',

            'reported_provisioning_state' => 'bootstrap',

            'firmware_version' => '1.1.0',

            'remote_ip' => '192.168.1.50',

            'status' => 'pending',

            'connection_attempts' => 1,

            'station_id' => null,

            'first_seen_at' => $occurredAt,

            'last_seen_at' => $occurredAt,

            'approved_at' => null,
            'rejected_at' => null,
            'provisioned_at' => null,

            'rejection_reason' => null,
        ];

        $events = [
            [
                new PendingDeviceDiscovered(
                    device: $device,
                    occurredAt: $occurredAt,
                ),
                'device.discovered',
                'discovered',
            ],

            [
                new PendingDeviceUpdated(
                    device: $device,
                    occurredAt: $occurredAt,
                ),
                'device.updated',
                'updated',
            ],
        ];

        foreach ($events as [
            $event,
            $eventName,
            $action,
        ]) {
            $channels =
                $event->broadcastOn();

            $payload =
                $event->broadcastWith();

            expect($event->broadcastAs())
                ->toBe($eventName);

            expect($channels)
                ->toHaveCount(1);

            expect($channels[0])
                ->toBeInstanceOf(
                    PrivateChannel::class,
                );

            expect($channels[0]->name)
                ->toBe(
                    'private-ntrip.dashboard',
                );

            expect($payload['version'])
                ->toBe(1);

            expect($payload['entity'])
                ->toBe(
                    'pending_device',
                );

            expect($payload['action'])
                ->toBe($action);

            expect($payload['occurred_at'])
                ->toBe($occurredAt);

            expect($payload['device'])
                ->toBe($device);

            expect($payload['device'])
                ->not
                ->toHaveKey(
                    'source_token_encrypted',
                );
        }
    },
)->group(
    'backend',
    'devices',
);
