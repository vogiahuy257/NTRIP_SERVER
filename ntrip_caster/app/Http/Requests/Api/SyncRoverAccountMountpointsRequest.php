<?php

namespace App\Http\Requests\Api;

use App\Models\RoverAccount;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SyncRoverAccountMountpointsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'mountpoints' => [
                'present',
                'array',
                'max:500',
            ],

            'mountpoints.*.id' => [
                'required',
                'integer',
                'distinct',
                'exists:mountpoints,id',
            ],

            'mountpoints.*.enabled' => [
                'sometimes',
                'boolean',
            ],

            'mountpoints.*.max_connections' => [
                'nullable',
                'integer',
                'min:1',
                'max:1000',
            ],

            'mountpoints.*.starts_at' => [
                'nullable',
                'date',
            ],

            'mountpoints.*.expires_at' => [
                'nullable',
                'date',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var RoverAccount|null $roverAccount */
            $roverAccount = $this->route('roverAccount');

            foreach ($this->input('mountpoints', []) as $index => $item) {
                $maxConnections =
                    $item['max_connections'] ?? null;

                if (
                    $maxConnections !== null
                    && $roverAccount !== null
                    && (int) $maxConnections
                        > $roverAccount->max_connections
                ) {
                    $validator->errors()->add(
                        "mountpoints.{$index}.max_connections",
                        implode(' ', [
                            'The Mountpoint connection limit cannot',
                            'exceed the Rover Account limit.',
                        ])
                    );
                }

                $startsAt = $item['starts_at'] ?? null;
                $expiresAt = $item['expires_at'] ?? null;

                if ($startsAt === null || $expiresAt === null) {
                    continue;
                }

                if (
                    CarbonImmutable::parse($expiresAt)
                        ->lessThanOrEqualTo(
                            CarbonImmutable::parse($startsAt)
                        )
                ) {
                    $validator->errors()->add(
                        "mountpoints.{$index}.expires_at",
                        'The expiration time must be later than the start time.'
                    );
                }
            }
        });
    }
}
