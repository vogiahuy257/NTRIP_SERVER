<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NtripSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NtripSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = NtripSession::query()
            ->with([
                'mountpoint:id,name,station_id',
                'mountpoint.station:id,device_id,name',
            ])
            ->latest('connected_at');

        $type = strtolower(
            $request->string('type')->toString(),
        );

        if (in_array(
            $type,
            [
                NtripSession::TYPE_SOURCE,
                NtripSession::TYPE_ROVER,
            ],
            true,
        )) {
            $query->where(
                'connection_type',
                $type,
            );
        }

        $status = strtolower(
            $request
                ->string('status', 'all')
                ->toString(),
        );

        if ($status === 'active') {
            $query->active();
        }

        if ($status === 'ended') {
            $query->whereNotNull(
                'disconnected_at',
            );
        }

        $search = trim(
            $request
                ->string('search')
                ->toString(),
        );

        if ($search !== '') {
            $query->where(
                function (
                    Builder $builder,
                ) use ($search): void {
                    $pattern = '%'.$search.'%';

                    $builder
                        ->where(
                            'authenticated_username',
                            'like',
                            $pattern,
                        )
                        ->orWhere(
                            'remote_ip',
                            'like',
                            $pattern,
                        )
                        ->orWhere(
                            'client_agent',
                            'like',
                            $pattern,
                        )
                        ->orWhere(
                            'ntrip_version',
                            'like',
                            $pattern,
                        )
                        ->orWhereHas(
                            'mountpoint',
                            function (
                                Builder $mountpointQuery,
                            ) use ($pattern): void {
                                $mountpointQuery->where(
                                    'name',
                                    'like',
                                    $pattern,
                                );
                            },
                        );
                },
            );
        }

        $perPage = max(
            1,
            min(
                $request->integer(
                    'per_page',
                    25,
                ),
                100,
            ),
        );

        $sessions = $query->paginate(
            perPage: $perPage,
        );

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    public function active(): JsonResponse
    {
        $sessions = NtripSession::query()
            ->active()
            ->with([
                'mountpoint:id,name,station_id',
                'mountpoint.station:id,device_id,name',
            ])
            ->latest('connected_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }
}
