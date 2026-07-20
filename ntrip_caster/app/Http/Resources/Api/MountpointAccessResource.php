<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MountpointAccessResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'station_id' => $this->station_id,
            'name' => $this->name,
            'identifier' => $this->identifier,
            'format' => $this->format,
            'nav_system' => $this->nav_system,
            'enabled' => $this->enabled,
            'access_mode' => $this->access_mode,
            'is_primary' => $this->is_primary,

            'station' => $this->whenLoaded(
                'station',
                fn (): array => [
                    'id' => $this->station->id,
                    'device_id' => $this->station->device_id,
                    'name' => $this->station->name,
                    'source_connected' => $this->station->source_connected,
                ]
            ),

            'access' => $this->when(
                $this->pivot !== null,
                fn (): array => [
                    'enabled' => (bool) $this->pivot->enabled,

                    'max_connections' => $this->pivot->max_connections,

                    'starts_at' => $this->pivot->starts_at?->toIso8601String(),

                    'expires_at' => $this->pivot->expires_at?->toIso8601String(),

                    'created_by' => $this->pivot->created_by,
                ]
            ),
        ];
    }
}
