<?php

namespace App\Http\Requests\Api;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class RtcmFlowHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $maximumPoints = max(
            100,
            (int) config(
                'ntrip.observability.history.maximum_points',
                5000,
            ),
        );

        return [
            'mountpoint_id' => [
                'required',
                'integer',
                'min:1',
                Rule::exists(
                    'mountpoints',
                    'id',
                ),
            ],

            'resolution' => [
                'sometimes',
                'string',
                Rule::in([
                    'auto',
                    'detail',
                    'minute',
                ]),
            ],

            'from' => [
                'sometimes',
                'date',
            ],

            'to' => [
                'sometimes',
                'date',
            ],

            'max_points' => [
                'sometimes',
                'integer',
                'min:100',
                "max:{$maximumPoints}",
            ],
        ];
    }

    public function mountpointId(): int
    {
        return (int) $this->validated(
            'mountpoint_id',
        );
    }

    public function resolution(): string
    {
        return (string) $this->validated(
            'resolution',
            'auto',
        );
    }

    public function maxPoints(): int
    {
        return (int) $this->validated(
            'max_points',
            max(
                100,
                (int) config(
                    'ntrip.observability.history.default_max_points',
                    1500,
                ),
            ),
        );
    }

    /**
     * @return array{
     *     0: CarbonImmutable,
     *     1: CarbonImmutable
     * }
     */
    public function range(): array
    {
        $toValue = $this->validated(
            'to',
        );

        $to = is_string($toValue)
            ? CarbonImmutable::parse(
                $toValue,
                'UTC',
            )->utc()
            : CarbonImmutable::now('UTC');

        $fromValue = $this->validated(
            'from',
        );

        $from = is_string($fromValue)
            ? CarbonImmutable::parse(
                $fromValue,
                'UTC',
            )->utc()
            : $to->subMinutes(
                max(
                    1,
                    (int) config(
                        'ntrip.observability.history.default_window_minutes',
                        60,
                    ),
                ),
            );

        if ($from->greaterThanOrEqualTo($to)) {
            throw ValidationException::withMessages([
                'to' => [
                    'The to time must be after the from time.',
                ],
            ]);
        }

        return [
            $from,
            $to,
        ];
    }
}
