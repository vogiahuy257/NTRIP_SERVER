<?php

namespace App\Http\Controllers\Api;

use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

final class RtcmFlowSnapshotController extends Controller
{
    public function __invoke(
        RtcmFlowLatestSnapshotStore $store,
    ): JsonResponse {
        $snapshot = $store->get();

        return response()->json([
            'success' => true,

            'data' => $snapshot,

            'meta' => [
                'available' => $snapshot !== null,

                'served_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
