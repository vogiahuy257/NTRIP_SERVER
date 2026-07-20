<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMountpointRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $mountpoint = $this->route('mountpoint');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('mountpoints', 'name')
                    ->ignore($mountpoint?->id),
            ],

            'identifier' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
            ],

            'format' => [
                'sometimes',
                'string',
                'max:32',
            ],

            'format_details' => [
                'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'nav_system' => [
                'sometimes',
                'string',
                'max:80',
            ],

            'latitude' => [
                'sometimes',
                'nullable',
                'numeric',
                'between:-90,90',
            ],

            'longitude' => [
                'sometimes',
                'nullable',
                'numeric',
                'between:-180,180',
            ],

            'country' => [
                'sometimes',
                'string',
                'size:3',
            ],

            'enabled' => [
                'sometimes',
                'boolean',
            ],

            'rover_username' => [
                'sometimes',
                'nullable',
                'string',
                'max:80',
            ],

            'rover_password' => [
                'sometimes',
                'nullable',
                'string',
                'min:6',
                'max:255',
            ],
        ];
    }
}