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

    public function config(): HasOne
    {
        return $this->hasOne(
            StationConfig::class
        );
    }

    /*
     * Quan hệ chính theo kiến trúc mới:
     * một Station có nhiều Mountpoint.
     */
    public function mountpoints(): HasMany
    {
        return $this->hasMany(
            Mountpoint::class
        );
    }

    /*
     * Alias tương thích cho firmware, controller và frontend cũ.
     * Chỉ trả về Mountpoint primary.
     */
    public function mountpoint(): HasOne
    {
        return $this->hasOne(
            Mountpoint::class
        )
            ->where('is_primary', true)
            ->orderBy('id');
    }

    public function telemetry(): HasOne
    {
        return $this->hasOne(
            StationTelemetry::class
        );
    }

    /*
     * Các Source session được gắn trực tiếp với Station.
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(
            NtripSession::class
        );
    }
}
