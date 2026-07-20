<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardSnapshotService;
use Illuminate\Http\JsonResponse;

final class DashboardSnapshotController extends Controller
{
    public function __invoke(
        DashboardSnapshotService $snapshotService,
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'data' => $snapshotService->build(),
        ]);
    }
}
