<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NtripSession extends Model
{
    use HasFactory;

    public const TYPE_SOURCE = 'source';

    public const TYPE_ROVER = 'rover';

    protected $fillable = [
        'mountpoint_id',
        'station_id',
        'rover_account_id',
        'connection_type',
        'authenticated_username',
        'client_agent',
        'ntrip_version',
        'remote_ip',
        'connected_at',
        'disconnected_at',
        'bytes_transferred',
        'disconnect_reason',
        'valid_rtcm_frames',
        'rtcm_crc_errors',
        'rtcm_message_counts',
    ];

    protected function casts(): array
    {
        return [
            'connected_at' => 'datetime',
            'disconnected_at' => 'datetime',
            'bytes_transferred' => 'integer',
            'valid_rtcm_frames' => 'integer',
            'rtcm_crc_errors' => 'integer',
            'rtcm_message_counts' => 'array',
        ];
    }

    public function mountpoint(): BelongsTo
    {
        return $this->belongsTo(
            Mountpoint::class
        );
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(
            Station::class
        );
    }

    public function roverAccount(): BelongsTo
    {
        return $this->belongsTo(
            RoverAccount::class
        );
    }

    public function scopeActive(
        Builder $query
    ): Builder {
        return $query->whereNull(
            'disconnected_at'
        );
    }

    public function scopeRovers(
        Builder $query
    ): Builder {
        return $query->where(
            'connection_type',
            self::TYPE_ROVER
        );
    }

    public function scopeSources(
        Builder $query
    ): Builder {
        return $query->where(
            'connection_type',
            self::TYPE_SOURCE
        );
    }
}
