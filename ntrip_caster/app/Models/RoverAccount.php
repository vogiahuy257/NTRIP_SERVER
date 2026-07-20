<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class RoverAccount extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'username',
        'display_name',
        'password_hash',
        'enabled',
        'max_connections',
        'expires_at',
        'last_authenticated_at',
        'notes',
        'created_by',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'max_connections' => 'integer',
            'expires_at' => 'datetime',
            'last_authenticated_at' => 'datetime',
        ];
    }

    public function mountpoints(): BelongsToMany
    {
        return $this->belongsToMany(
            Mountpoint::class,
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

    public function activeSessions(): HasMany
    {
        return $this->sessions()
            ->where(
                'connection_type',
                NtripSession::TYPE_ROVER
            )
            ->whereNull('disconnected_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
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

    public function scopeNotExpired(
        Builder $query
    ): Builder {
        return $query->where(
            function (Builder $query): void {
                $query
                    ->whereNull('expires_at')
                    ->orWhere(
                        'expires_at',
                        '>',
                        now()
                    );
            }
        );
    }

    public function isUsable(): bool
    {
        if (! $this->enabled) {
            return false;
        }

        return $this->expires_at === null
            || $this->expires_at->isFuture();
    }
}
