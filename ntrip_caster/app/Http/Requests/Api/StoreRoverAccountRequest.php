<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class StoreRoverAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge([
                'username' => Str::lower(
                    trim($this->string('username')->toString())
                ),
            ]);
        }

        if (is_string($this->input('display_name'))) {
            $this->merge([
                'display_name' => trim(
                    $this->string('display_name')->toString()
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'username' => [
                'required',
                'string',
                'min:3',
                'max:80',
                'regex:/^[a-z0-9][a-z0-9._-]*$/',
                'unique:rover_accounts,username',
            ],

            'display_name' => [
                'nullable',
                'string',
                'max:120',
            ],

            'password' => [
                'required',
                'string',
                'min:12',
                'max:255',
                'confirmed',
            ],

            'enabled' => [
                'sometimes',
                'boolean',
            ],

            'max_connections' => [
                'sometimes',
                'integer',
                'min:1',
                'max:1000',
            ],

            'expires_at' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'username.regex' => implode(' ', [
                'Username chỉ được chứa chữ thường, số,',
                'dấu chấm, gạch dưới và gạch ngang.',
            ]),
        ];
    }
}
