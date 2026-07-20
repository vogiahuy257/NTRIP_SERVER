<?php

namespace Database\Factories;

use App\Models\Mountpoint;
use App\Models\Station;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Mountpoint>
 */
class MountpointFactory extends Factory
{
    protected $model = Mountpoint::class;

    public function definition(): array
    {
        $name = 'TEST-RTCM-'.Str::upper(
            Str::random(10)
        );

        return [
            'station_id' => Station::factory(),

            'name' => $name,

            'identifier' => $name,

            'format' => 'RTCM 3.3',

            'format_details' => '1005,1074,1084,1094,1124,1230',

            'nav_system' => 'GPS+GLO+GAL+BDS',

            'latitude' => 10.9801234,

            'longitude' => 106.6745678,

            'country' => 'VNM',

            'enabled' => true,

            'is_primary' => true,

            'access_mode' => Mountpoint::ACCESS_AUTHENTICATED,

            'max_rover_connections' => null,

            'rover_username' => null,

            'rover_password_hash' => null,
        ];
    }

    public function publicAccess(): static
    {
        return $this->state([
            'access_mode' => Mountpoint::ACCESS_PUBLIC,
        ]);
    }

    public function disabled(): static
    {
        return $this->state([
            'enabled' => false,
        ]);
    }
}
