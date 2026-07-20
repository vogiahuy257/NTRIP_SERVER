<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\AlertResource;
use App\Models\Alert;
use App\Services\Alerts\AlertService;
use DomainException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AlertController extends Controller
{
    public function index(
        Request $request,
    ): JsonResponse {
        $data = $request->validate([
            'status' => [
                'nullable',
                Rule::in([
                    'active',
                    Alert::STATUS_OPEN,
                    Alert::STATUS_ACKNOWLEDGED,
                    Alert::STATUS_RESOLVED,
                    'all',
                ]),
            ],

            'severity' => [
                'nullable',
                Rule::in([
                    Alert::SEVERITY_WARNING,
                    Alert::SEVERITY_CRITICAL,
                ]),
            ],

            'station_id' => [
                'nullable',
                'integer',
            ],

            'search' => [
                'nullable',
                'string',
                'max:120',
            ],

            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ]);

        $query = Alert::query()
            ->with([
                'station:id,device_id,name',
                'mountpoint:id,station_id,name',

                'ntripSession:id,mountpoint_id,connection_type,remote_ip',

                'acknowledgedBy:id,name',
                'resolvedBy:id,name',
            ]);

        $status =
            $data['status'] ?? 'active';

        match ($status) {
            'active' => $query->active(),

            Alert::STATUS_OPEN => $query->where(
                'status',
                Alert::STATUS_OPEN,
            ),

            Alert::STATUS_ACKNOWLEDGED => $query->where(
                'status',
                Alert::STATUS_ACKNOWLEDGED,
            ),

            Alert::STATUS_RESOLVED => $query->where(
                'status',
                Alert::STATUS_RESOLVED,
            ),

            default => null,
        };

        if (
            isset($data['severity'])
        ) {
            $query->where(
                'severity',
                $data['severity'],
            );
        }

        if (
            isset($data['station_id'])
        ) {
            $query->where(
                'station_id',
                $data['station_id'],
            );
        }

        $search = trim(
            (string) (
                $data['search'] ?? ''
            ),
        );

        if ($search !== '') {
            $query->where(
                function (
                    Builder $builder,
                ) use ($search): void {
                    $pattern =
                        '%'.$search.'%';

                    $builder
                        ->where(
                            'title',
                            'like',
                            $pattern,
                        )
                        ->orWhere(
                            'message',
                            'like',
                            $pattern,
                        )
                        ->orWhereHas(
                            'station',
                            function (
                                Builder $stationQuery,
                            ) use ($pattern): void {
                                $stationQuery
                                    ->where(
                                        'name',
                                        'like',
                                        $pattern,
                                    )
                                    ->orWhere(
                                        'device_id',
                                        'like',
                                        $pattern,
                                    );
                            },
                        )
                        ->orWhereHas(
                            'mountpoint',
                            function (
                                Builder $mountpointQuery,
                            ) use ($pattern): void {
                                $mountpointQuery
                                    ->where(
                                        'name',
                                        'like',
                                        $pattern,
                                    );
                            },
                        );
                },
            );
        }

        $query
            ->orderByRaw(
                <<<'SQL'
                CASE severity
                    WHEN 'critical' THEN 0
                    WHEN 'warning' THEN 1
                    ELSE 2
                END
                SQL,
            )
            ->latest('opened_at');

        $paginator = $query->paginate(
            perPage: $data['per_page'] ?? 25,
        );

        $items = collect(
            $paginator->items(),
        )->map(
            fn (Alert $alert): array => (new AlertResource($alert))
                ->resolve($request),
        )->values();

        return response()->json([
            'success' => true,

            'data' => $items,

            'meta' => [
                'current_page' => $paginator
                    ->currentPage(),

                'last_page' => $paginator
                    ->lastPage(),

                'per_page' => $paginator
                    ->perPage(),

                'total' => $paginator
                    ->total(),
            ],
        ]);
    }

    public function summary(): JsonResponse
    {
        $activeQuery =
            Alert::query()->active();

        $openCount =
            (clone $activeQuery)
                ->where(
                    'status',
                    Alert::STATUS_OPEN,
                )
                ->count();

        $acknowledgedCount =
            (clone $activeQuery)
                ->where(
                    'status',
                    Alert::STATUS_ACKNOWLEDGED,
                )
                ->count();

        $criticalCount =
            (clone $activeQuery)
                ->where(
                    'severity',
                    Alert::SEVERITY_CRITICAL,
                )
                ->count();

        $warningCount =
            (clone $activeQuery)
                ->where(
                    'severity',
                    Alert::SEVERITY_WARNING,
                )
                ->count();

        return response()->json([
            'success' => true,

            'data' => [
                'active' => $openCount +
                    $acknowledgedCount,

                'unacknowledged' => $openCount,

                'acknowledged' => $acknowledgedCount,

                'critical' => $criticalCount,

                'warning' => $warningCount,

                'highest_severity' => $criticalCount > 0
                        ? Alert::SEVERITY_CRITICAL
                        : (
                            $warningCount > 0
                                ? Alert::SEVERITY_WARNING
                                : null
                        ),
            ],
        ]);
    }

    public function acknowledge(
        Request $request,
        Alert $alert,
        AlertService $alertService,
    ): JsonResponse {
        try {
            $alert = $alertService
                ->acknowledge(
                    alert: $alert,
                    user: $request->user(),
                );
        } catch (DomainException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Alert acknowledged.',

            'data' => (new AlertResource($alert))
                ->resolve($request),
        ]);
    }
}
