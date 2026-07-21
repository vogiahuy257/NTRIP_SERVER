<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ApprovePendingDeviceRequest;
use App\Http\Requests\Api\RejectPendingDeviceRequest;
use App\Models\PendingDevice;
use App\Services\Devices\PendingDeviceProvisioningService;
use Illuminate\Http\JsonResponse;

class PendingDeviceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => PendingDevice::query()
                ->with([
                    'station.config',
                    'station.mountpoint',
                ])
                ->latest('last_seen_at')
                ->get(),
        ]);
    }

    public function show(
        PendingDevice $pendingDevice,
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'data' => $pendingDevice->load([
                'station.config',
                'station.mountpoint',
            ]),
        ]);
    }

    public function approve(
        ApprovePendingDeviceRequest $request,
        PendingDevice $pendingDevice,
        PendingDeviceProvisioningService $service,
    ): JsonResponse {
        abort_unless(
            $pendingDevice->isPending(),
            409,
            'Only pending devices can be approved.',
        );

        $device = $service->approve(
            $pendingDevice,
            $request->validated(),
        );

        return response()->json([
            'success' => true,
            'message' => 'Device approved and Station created.',
            'data' => $device,
        ]);
    }

    public function reject(
        RejectPendingDeviceRequest $request,
        PendingDevice $pendingDevice,
        PendingDeviceProvisioningService $service,
    ): JsonResponse {
        abort_unless(
            $pendingDevice->isPending(),
            409,
            'Only pending devices can be rejected.',
        );

        $device = $service->reject(
            $pendingDevice,
            $request->validated('reason'),
        );

        return response()->json([
            'success' => true,
            'message' => 'Device rejected.',
            'data' => $device,
        ]);
    }
}
