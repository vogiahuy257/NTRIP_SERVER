<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreStationTelemetryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'firmware_version' => [
                'sometimes',
                'nullable',
                'string',
                'max:64',
            ],

            'source_connected' => [
                'sometimes',
                'boolean',
            ],

            'network' => [
                'sometimes',
                'array',
            ],
            'network.type' => [
                'sometimes',
                'nullable',
                'string',
                'max:32',
            ],
            'network.ip' => [
                'sometimes',
                'nullable',
                'ip',
            ],
            'network.rssi' => [
                'sometimes',
                'nullable',
                'numeric',
            ],

            'survey_in' => [
                'sometimes',
                'array',
            ],
            'survey_in.active' => [
                'sometimes',
                'boolean',
            ],
            'survey_in.valid' => [
                'sometimes',
                'boolean',
            ],
            'survey_in.duration_s' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],
            'survey_in.mean_accuracy_m' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],

            'rtcm' => [
                'sometimes',
                'array',
            ],
            'rtcm.bytes_sent' => [
                'sometimes',
                'integer',
                'min:0',
            ],
            'rtcm.frames_valid' => [
                'sometimes',
                'integer',
                'min:0',
            ],
            'rtcm.crc_errors' => [
                'sometimes',
                'integer',
                'min:0',
            ],
            'rtcm.upload_bps' => [
                'sometimes',
                'numeric',
                'min:0',
            ],

            'system' => [
                'sometimes',
                'array',
            ],
            'system.uptime_s' => [
                'sometimes',
                'integer',
                'min:0',
            ],
            'system.free_heap_bytes' => [
                'sometimes',
                'integer',
                'min:0',
            ],
            'system.temperature_c' => [
                'sometimes',
                'nullable',
                'numeric',
            ],
        ];
    }
}