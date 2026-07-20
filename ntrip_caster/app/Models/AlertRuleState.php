<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AlertRuleState extends Model
{
    protected $fillable = [
        'station_id',
        'rule',
        'condition_active',
        'condition_started_at',
        'recovery_started_at',
        'last_sample',
        'last_evaluated_at',
    ];

    protected function casts(): array
    {
        return [
            'condition_active' => 'boolean',

            'condition_started_at' => 'datetime',

            'recovery_started_at' => 'datetime',

            'last_sample' => 'array',

            'last_evaluated_at' => 'datetime',
        ];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(
            Station::class,
        );
    }
}
