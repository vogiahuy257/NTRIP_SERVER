<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PendingDevice;
use App\Services\Devices\PendingDeviceProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceProvisioningController extends Controller
{
    public function __invoke(
        Request $request,
        string $hardwareId,
        PendingDeviceProvisioningService $service,
    ): JsonResponse {
        $expected = (string) config(
            'ntrip.provisioning_key',
        );

        $provided = $request->header(
            'X-Provisioning-Key',
            $request->bearerToken(),
        );

        abort_if(
            $expected === ''
            || ! is_string($provided)
            || ! hash_equals($expected, $provided),
            403,
            'Invalid provisioning key.',
        );

        $device = PendingDevice::query()
            ->where(
                'hardware_id',
                strtoupper(trim($hardwareId)),
            )
            ->first();

        if ($device === null) {
            return response()->json([
                'status' => 'pending',
            ]);
        }

        if ($device->isPending()) {
            return response()->json([
                'status' => 'pending',
            ]);
        }

        if ($device->isRejected()) {
            return response()->json([
                'status' => 'rejected',
            ]);
        }

        return response()->json([
            'status' => $device->status,
            'data' => $service->payload($device),
        ]);
    }
}
