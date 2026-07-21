<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RtcmFlowRollup extends Model
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
            'bucket_started_at' => 'immutable_datetime',

            'source_connected_ratio' => 'float',

            'source_last_received_age_ms_max' => 'float',

            'source_gap_max_ms' => 'float',

            'active_rovers_avg' => 'float',

            'fanout_coverage_avg' => 'float',

            'fanout_coverage_min' => 'float',

            'socket_drain_ratio_avg' => 'float',

            'socket_drain_ratio_min' => 'float',

            'fanout_duration_avg_ms' => 'float',

            'fanout_duration_p95_worst_ms' => 'float',

            'fanout_duration_max_ms' => 'float',

            'maximum_buffer_age_ms' => 'float',
        ];
    }
}
