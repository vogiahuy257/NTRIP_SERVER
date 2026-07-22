<?php

namespace App\Http\Requests\Api;

use App\Models\RoverAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateRoverAccountRequest extends FormRequest
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
        /** @var RoverAccount|null $roverAccount */
        $roverAccount = $this->route('roverAccount');

        return [
            'username' => [
                'sometimes',
                'required',
                'string',
                'min:3',
                'max:80',
                'regex:/^[a-z0-9][a-z0-9._-]*$/',
                Rule::unique(
                    'rover_accounts',
                    'username'
                )->ignore($roverAccount?->id),
            ],

            'display_name' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
            ],

            'password' => [
                'sometimes',
                'nullable',
                'string',
                'min:6',
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
                'sometimes',
                'nullable',
                'date',
            ],

            'notes' => [
                'sometimes',
                'nullable',
                'string',
                'max:5000',
            ],
        ];
    }
}
