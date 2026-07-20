<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mountpoint extends Model
{
    use HasFactory;

    public const ACCESS_PUBLIC = 'public';

    public const ACCESS_AUTHENTICATED = 'authenticated';

    protected $fillable = [
        'station_id',
        'name',
        'identifier',
        'format',
        'format_details',
        'nav_system',
        'latitude',
        'longitude',
        'country',
        'enabled',
        'is_primary',
        'access_mode',
        'max_rover_connections',

        /*
         * Credential cũ được giữ tạm cho tới khi NtripCaster
         * chuyển hoàn toàn sang RoverAccount.
         */
        'rover_username',
        'rover_password_hash',
    ];

    protected $hidden = [
        'rover_password_hash',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_primary' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'max_rover_connections' => 'integer',
        ];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(
            Station::class
        );
    }

    public function roverAccounts(): BelongsToMany
    {
        return $this->belongsToMany(
            RoverAccount::class,
            'mountpoint_rover_account'
        )
            ->using(MountpointRoverAccount::class)
            ->withPivot([
                'enabled',
                'max_connections',
                'starts_at',
                'expires_at',
                'created_by',
            ])
            ->withTimestamps();
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(
            NtripSession::class
        );
    }

    public function scopeEnabled(
        Builder $query
    ): Builder {
        return $query->where(
            'enabled',
            true
        );
    }

    public function scopePrimary(
        Builder $query
    ): Builder {
        return $query->where(
            'is_primary',
            true
        );
    }

    public function requiresAuthentication(): bool
    {
        return $this->access_mode
            === self::ACCESS_AUTHENTICATED;
    }

    public function isPublic(): bool
    {
        return $this->access_mode
            === self::ACCESS_PUBLIC;
    }
}
