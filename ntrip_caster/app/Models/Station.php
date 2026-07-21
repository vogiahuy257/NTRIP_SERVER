<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Station extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'name',
        'enabled',
        'source_token_hash',
        'source_connected',
        'last_seen_at',
        'last_ip',
        'firmware_version',
    ];

    protected $hidden = [
        'source_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'source_connected' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * @return HasOne<StationConfig, $this>
     */
    public function config(): HasOne
    {
        return $this->hasOne(
            StationConfig::class
        );
    }

    /**
     * @return HasMany<Mountpoint, $this>
     */
    public function mountpoints(): HasMany
    {
        return $this->hasMany(
            Mountpoint::class
        );
    }

    /**
     * @return HasOne<Mountpoint, $this>
     */
    public function mountpoint(): HasOne
    {
        return $this->hasOne(
            Mountpoint::class
        )
            ->where('is_primary', true)
            ->orderBy('id');
    }

    /**
     * @return HasOne<StationTelemetry, $this>
     */
    public function telemetry(): HasOne
    {
        return $this->hasOne(
            StationTelemetry::class
        );
    }

    /**
     * @return HasMany<NtripSession, $this>
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(
            NtripSession::class
        );
    }
}
