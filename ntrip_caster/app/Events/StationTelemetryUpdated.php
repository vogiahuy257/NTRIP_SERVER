<?php

namespace App\Events;

use App\Models\Station;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StationTelemetryUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly Station $station,
        public readonly array $telemetry,
        public readonly string $receivedAt,
    ) {}

    /**
     * Event được phát đồng thời đến:
     *
     * 1. Dashboard chung.
     * 2. Channel riêng của station.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel(
                'ntrip.dashboard',
            ),

            new PrivateChannel(
                'stations.'.$this->station->device_id,
            ),
        ];
    }

    /**
     * Tên event mà frontend Echo sẽ lắng nghe.
     *
     * Do có broadcastAs(), frontend phải dùng:
     *
     * .station.telemetry.updated
     */
    public function broadcastAs(): string
    {
        return 'station.telemetry.updated';
    }

    /**
     * Payload gửi qua WebSocket.
     *
     * Không gửi toàn bộ model Eloquent để tránh payload dư thừa
     * hoặc vô tình lộ các trường nội bộ.
     */
    public function broadcastWith(): array
    {
        return [
            /*
             * Metadata chuẩn của realtime event.
             */
            'version' => 1,
            'entity' => 'station',
            'action' => 'telemetry.updated',
            'occurred_at' => $this->receivedAt,

            /*
             * Thông tin station cần để frontend xác định
             * station nào phải được cập nhật.
             */
            'station' => [
                'id' => $this->station->id,
                'device_id' => $this->station->device_id,
                'name' => $this->station->name,
                'enabled' => $this->station->enabled,
                'source_connected' => $this->station->source_connected,
                'last_seen_at' => $this->station
                    ->last_seen_at
                    ?->toIso8601String(),
                'firmware_version' => $this->station->firmware_version,
            ],

            /*
             * Payload telemetry đã được request validation kiểm tra.
             */
            'telemetry' => $this->telemetry,

            /*
             * Giữ lại field cũ để tương thích với code hiện tại.
             */
            'received_at' => $this->receivedAt,
        ];
    }
}
