<?php

namespace Database\Factories;

use App\Models\RoverAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<RoverAccount>
 */
class RoverAccountFactory extends Factory
{
    public const PASSWORD = 'StrongPassword@123';

    protected $model = RoverAccount::class;

    private static ?string $passwordHash = null;

    public function definition(): array
    {
        $username = 'rover-'.Str::lower(
            Str::random(12)
        );

        return [
            'username' => $username,

            'display_name' => 'Test '.$username,

            'password_hash' => self::$passwordHash ??=
                    Hash::make(self::PASSWORD),

            'enabled' => true,

            'max_connections' => 3,

            'expires_at' => null,

            'last_authenticated_at' => null,

            'notes' => null,

            'created_by' => null,
        ];
    }

    public function disabled(): static
    {
        return $this->state([
            'enabled' => false,
        ]);
    }

    public function expired(): static
    {
        return $this->state([
            'expires_at' => now()->subMinute(),
        ]);
    }
}
