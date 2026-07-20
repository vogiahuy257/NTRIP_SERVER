<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class AlertResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(
        Request $request,
    ): array {
        return [
            'id' => $this->id,

            'type' => $this->type,
            'severity' => $this->severity,
            'status' => $this->status,

            'title' => $this->title,
            'message' => $this->message,

            'metadata' => $this->metadata ?? [],

            'occurrence_count' => $this->occurrence_count,

            'opened_at' => $this
                ->opened_at
                ?->toIso8601String(),

            'last_observed_at' => $this
                ->last_observed_at
                ?->toIso8601String(),

            'acknowledged_at' => $this
                ->acknowledged_at
                ?->toIso8601String(),

            'resolved_at' => $this
                ->resolved_at
                ?->toIso8601String(),

            'resolution_note' => $this->resolution_note,

            'station' => $this->station === null
                    ? null
                    : [
                        'id' => $this
                            ->station
                            ->id,

                        'device_id' => $this
                            ->station
                            ->device_id,

                        'name' => $this
                            ->station
                            ->name,
                    ],

            'mountpoint' => $this->mountpoint === null
                    ? null
                    : [
                        'id' => $this
                            ->mountpoint
                            ->id,

                        'station_id' => $this
                            ->mountpoint
                            ->station_id,

                        'name' => $this
                            ->mountpoint
                            ->name,
                    ],

            'ntrip_session' => $this->ntripSession === null
                    ? null
                    : [
                        'id' => $this
                            ->ntripSession
                            ->id,

                        'mountpoint_id' => $this
                            ->ntripSession
                            ->mountpoint_id,

                        'connection_type' => $this
                            ->ntripSession
                            ->connection_type,

                        'remote_ip' => $this
                            ->ntripSession
                            ->remote_ip,
                    ],

            'acknowledged_by' => $this->acknowledgedBy === null
                    ? null
                    : [
                        'id' => $this
                            ->acknowledgedBy
                            ->id,

                        'name' => $this
                            ->acknowledgedBy
                            ->name,
                    ],

            'resolved_by' => $this->resolvedBy === null
                    ? null
                    : [
                        'id' => $this
                            ->resolvedBy
                            ->id,

                        'name' => $this
                            ->resolvedBy
                            ->name,
                    ],
        ];
    }
}
