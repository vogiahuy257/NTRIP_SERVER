<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoverAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = 'active';

        if (! $this->enabled) {
            $status = 'disabled';
        } elseif (
            $this->expires_at !== null
            && $this->expires_at->isPast()
        ) {
            $status = 'expired';
        }

        return [
            'id' => $this->id,
            'username' => $this->username,
            'display_name' => $this->display_name,
            'enabled' => $this->enabled,
            'status' => $status,
            'max_connections' => $this->max_connections,

            'expires_at' => $this->expires_at?->toIso8601String(),

            'last_authenticated_at' => $this->last_authenticated_at?->toIso8601String(),

            'notes' => $this->notes,

            'mountpoint_count' => $this->whenCounted(
                'mountpoints'
            ),

            'active_session_count' => $this->whenCounted(
                'activeSessions'
            ),

            'creator' => $this->whenLoaded(
                'creator',
                fn (): array => [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                    'email' => $this->creator->email,
                ]
            ),

            'mountpoints' => MountpointAccessResource::collection(
                $this->whenLoaded('mountpoints')
            ),

            'created_at' => $this->created_at?->toIso8601String(),

            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
