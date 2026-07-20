<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateMountpointRequest;
use App\Models\Mountpoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class MountpointController extends Controller
{
    public function index(): JsonResponse
    {
        $mountpoints = Mountpoint::query()
            ->with([
                'station:id,device_id,name,enabled,source_connected',
            ])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $mountpoints,
        ]);
    }

    public function show(
        Mountpoint $mountpoint
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'data' => $mountpoint->load([
                'station',
            ]),
        ]);
    }

    public function update(
        UpdateMountpointRequest $request,
        Mountpoint $mountpoint
    ): JsonResponse {
        $data = $request->validated();

        if (array_key_exists('country', $data)) {
            $data['country'] = strtoupper(
                $data['country']
            );
        }

        if (array_key_exists('rover_username', $data)) {
            $username = $data['rover_username'];

            $data['rover_username'] =
                $username === null || trim($username) === ''
                    ? null
                    : trim($username);
        }

        if (array_key_exists('rover_password', $data)) {
            $password = $data['rover_password'];

            $data['rover_password_hash'] =
                $password === null || $password === ''
                    ? null
                    : Hash::make($password);

            unset($data['rover_password']);
        }

        /*
         * Nếu xóa username thì xóa luôn password hash.
         */
        if (
            array_key_exists('rover_username', $data)
            && $data['rover_username'] === null
        ) {
            $data['rover_password_hash'] = null;
        }

        $mountpoint->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Mountpoint updated successfully.',
            'data' => $mountpoint->fresh([
                'station',
            ]),
        ]);
    }
}
