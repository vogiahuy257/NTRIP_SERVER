<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStationConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $station = $this->route('station');
        $mountpointId = $station?->mountpoint?->id;

        return [
            'caster_host' => [
                'sometimes',
                'string',
                'max:255',
            ],
            'caster_port' => [
                'sometimes',
                'integer',
                'between:1,65535',
            ],
            'mountpoint' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('mountpoints', 'name')
                    ->ignore($mountpointId),
            ],
            'uart_baud' => [
                'sometimes',
                'integer',
                'between:9600,3000000',
            ],
            'telemetry_interval_ms' => [
                'sometimes',
                'integer',
                'between:500,60000',
            ],
            'config_poll_interval_ms' => [
                'sometimes',
                'integer',
                'between:5000,3600000',
            ],
            'max_rtcm_age_ms' => [
                'sometimes',
                'integer',
                'between:100,60000',
            ],
        ];
    }
}