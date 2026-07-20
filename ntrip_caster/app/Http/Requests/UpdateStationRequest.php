<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $station = $this->route('station');

        return [
            'device_id' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('stations', 'device_id')
                    ->ignore($station?->id),
            ],
            'name' => [
                'sometimes',
                'string',
                'max:120',
            ],
            'enabled' => [
                'sometimes',
                'boolean',
            ],
            'source_token' => [
                'sometimes',
                'string',
                'min:8',
                'max:255',
            ],
        ];
    }
}