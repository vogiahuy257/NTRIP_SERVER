<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingDevice extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_PROVISIONED = 'provisioned';

    protected $fillable = [
        'hardware_id',
        'reported_device_id',
        'reported_mountpoint',
        'reported_provisioning_state',
        'firmware_version',
        'remote_ip',
        'status',
        'connection_attempts',
        'first_seen_at',
        'last_seen_at',
        'station_id',
        'source_token_encrypted',
        'approved_at',
        'rejected_at',
        'provisioned_at',
        'rejection_reason',
    ];

    protected $hidden = [
        'source_token_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'connection_attempts' => 'integer',

            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',

            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'provisioned_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Station, $this>
     */
    public function station(): BelongsTo
    {
        return $this->belongsTo(
            Station::class
        );
    }

    public function scopePending(
        Builder $query
    ): Builder {
        return $query->where(
            'status',
            self::STATUS_PENDING
        );
    }

    public function scopeStatus(
        Builder $query,
        string $status
    ): Builder {
        return $query->where(
            'status',
            $status
        );
    }

    public function isPending(): bool
    {
        return $this->status
            === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status
            === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status
            === self::STATUS_REJECTED;
    }

    public function isProvisioned(): bool
    {
        return $this->status
            === self::STATUS_PROVISIONED;
    }
}
