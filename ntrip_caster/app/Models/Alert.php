<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Alert extends Model
{
    public const TYPE_STATION_OFFLINE =
        'station_offline';

    public const TYPE_SOURCE_DISCONNECTED =
        'source_disconnected';

    public const TYPE_RTCM_STREAM_STALLED =
        'rtcm_stream_stalled';

    public const TYPE_RTCM_CRC_ERRORS =
        'rtcm_crc_errors';

    public const SEVERITY_WARNING =
        'warning';

    public const SEVERITY_CRITICAL =
        'critical';

    public const STATUS_OPEN =
        'open';

    public const STATUS_ACKNOWLEDGED =
        'acknowledged';

    public const STATUS_RESOLVED =
        'resolved';

    protected $fillable = [
        'station_id',
        'mountpoint_id',
        'ntrip_session_id',

        'type',
        'severity',
        'status',

        'fingerprint',
        'active_key',

        'title',
        'message',
        'metadata',

        'occurrence_count',

        'opened_at',
        'last_observed_at',

        'acknowledged_at',
        'acknowledged_by_user_id',

        'resolved_at',
        'resolved_by_user_id',
        'resolution_note',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',

            'occurrence_count' => 'integer',

            'opened_at' => 'datetime',
            'last_observed_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(
            Station::class,
        );
    }

    public function mountpoint(): BelongsTo
    {
        return $this->belongsTo(
            Mountpoint::class,
        );
    }

    public function ntripSession(): BelongsTo
    {
        return $this->belongsTo(
            NtripSession::class,
        );
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'acknowledged_by_user_id',
        );
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'resolved_by_user_id',
        );
    }

    public function scopeActive(
        Builder $query,
    ): Builder {
        return $query->whereIn(
            'status',
            [
                self::STATUS_OPEN,
                self::STATUS_ACKNOWLEDGED,
            ],
        );
    }

    public function scopeUnacknowledged(
        Builder $query,
    ): Builder {
        return $query->where(
            'status',
            self::STATUS_OPEN,
        );
    }

    public function isResolved(): bool
    {
        return $this->status ===
            self::STATUS_RESOLVED;
    }
}
