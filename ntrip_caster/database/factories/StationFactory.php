<?php

namespace Database\Factories;

use App\Models\Station;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<Station>
 */
class StationFactory extends Factory
{
    protected $model = Station::class;

    public function definition(): array
    {
        return [
            'device_id' => 'TEST-BASE-'.Str::upper(
                Str::random(10)
            ),

            'name' => 'Test Base Station '.$this->faker->unique()->numberBetween(
                1,
                999999
            ),

            'enabled' => true,

            'source_token_hash' => Hash::make('source-test-token'),

            'source_connected' => true,

            'last_seen_at' => now(),

            'last_ip' => $this->faker->ipv4(),

            'firmware_version' => 'test',
        ];
    }
}
