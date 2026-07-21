<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StationConfig extends Model
{
    protected $fillable = [
        'station_id',
        'revision',
        'caster_host',
        'caster_port',
        'uart_baud',
        'telemetry_interval_ms',
        'config_poll_interval_ms',
        'max_rtcm_age_ms',
    ];

    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'caster_port' => 'integer',
            'uart_baud' => 'integer',
            'telemetry_interval_ms' => 'integer',
            'config_poll_interval_ms' => 'integer',
            'max_rtcm_age_ms' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Station, $this>
     */
    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }
}
