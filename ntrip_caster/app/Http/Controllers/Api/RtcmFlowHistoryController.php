<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RtcmFlowHistoryRequest;
use App\Services\Observability\RtcmFlowHistoryService;
use Illuminate\Http\JsonResponse;

final class RtcmFlowHistoryController extends Controller
{
    public function __invoke(
        RtcmFlowHistoryRequest $request,
        RtcmFlowHistoryService $history,
    ): JsonResponse {
        [
            $from,
            $to,
        ] = $request->range();

        $result = $history->fetch(
            mountpointId: $request->mountpointId(),

            from: $from,
            to: $to,

            requestedResolution: $request->resolution(),

            maxPoints: $request->maxPoints(),
        );

        return response()->json([
            'success' => true,
            'data' => $result['points'],
            'meta' => $result['meta'],
        ]);
    }
}
