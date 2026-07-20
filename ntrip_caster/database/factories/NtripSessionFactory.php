<?php

namespace Database\Factories;

use App\Models\Mountpoint;
use App\Models\NtripSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NtripSession>
 */
class NtripSessionFactory extends Factory
{
    protected $model = NtripSession::class;

    public function definition(): array
    {
        return [
            'mountpoint_id' => Mountpoint::factory(),

            'station_id' => null,

            'rover_account_id' => null,

            'connection_type' => NtripSession::TYPE_ROVER,

            'authenticated_username' => null,

            'client_agent' => 'Test NTRIP Client',

            'ntrip_version' => 'Ntrip/2.0',

            'remote_ip' => $this->faker->ipv4(),

            'connected_at' => now(),

            'disconnected_at' => null,

            'bytes_transferred' => 0,

            'disconnect_reason' => null,

            'valid_rtcm_frames' => 0,

            'rtcm_crc_errors' => 0,

            'rtcm_message_counts' => [],
        ];
    }

    public function disconnected(): static
    {
        return $this->state([
            'disconnected_at' => now(),
        ]);
    }
}
