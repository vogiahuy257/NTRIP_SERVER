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
            || ! hash_equals(
                $expected,
                $provided,
            ),
            403,
            'Invalid provisioning key.',
        );

        $device = PendingDevice::query()
            ->where(
                'hardware_id',
                strtoupper(
                    trim($hardwareId),
                ),
            )
            ->first();

        if ($device === null || $device->isPending()) {
            return $this->jsonResponse([
                'status' => PendingDevice::STATUS_PENDING,
            ]);
        }

        if ($device->isRejected()) {
            return $this->jsonResponse([
                'status' => PendingDevice::STATUS_REJECTED,
            ]);
        }

        return $this->jsonResponse([
            'status' => $device->status,
            'data' => $service->payload(
                $device,
            ),
        ]);
    }

    /**
     * Trả JSON có Content-Length rõ ràng để ESP-IDF
     * không hiểu response là chunked/incomplete.
     *
     * @param array<string, mixed> $payload
     */
    private function jsonResponse(
        array $payload,
        int $status = 200,
    ): JsonResponse {
        $response = response()->json(
            data: $payload,
            status: $status,
        );

        $content = (string) $response->getContent();

        $response->headers->set(
            'Content-Length',
            (string) strlen($content),
        );

        /*
         * ESP32 đang dùng request ngắn cho provisioning.
         * Đóng connection sau response giúp framing HTTP rõ ràng.
         */
        $response->headers->set(
            'Connection',
            'close',
        );

        /*
         * Không để response vừa có Content-Length
         * vừa có Transfer-Encoding.
         */
        $response->headers->remove(
            'Transfer-Encoding',
        );

        return $response;
    }
}