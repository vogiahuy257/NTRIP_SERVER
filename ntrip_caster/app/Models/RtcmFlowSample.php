<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RtcmFlowSample extends Model
{
    protected $guarded = [
        'id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sampled_at' => 'immutable_datetime',

            'rolled_up_at' => 'immutable_datetime',

            'source_connected' => 'boolean',

            'source_last_received_age_ms' => 'float',

            'source_gap_max_ms' => 'float',

            'fanout_coverage' => 'float',

            'socket_drain_ratio' => 'float',

            'fanout_duration_avg_ms' => 'float',

            'fanout_duration_p95_ms' => 'float',

            'fanout_duration_max_ms' => 'float',

            'maximum_buffer_age_ms' => 'float',
        ];
    }
}
