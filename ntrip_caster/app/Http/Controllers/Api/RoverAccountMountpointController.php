<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SyncRoverAccountMountpointsRequest;
use App\Http\Resources\Api\MountpointAccessResource;
use App\Models\RoverAccount;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class RoverAccountMountpointController extends Controller
{
    public function index(
        RoverAccount $roverAccount
    ): AnonymousResourceCollection {
        $mountpoints = $roverAccount
            ->mountpoints()
            ->with(
                'station:id,device_id,name,source_connected'
            )
            ->orderBy('name')
            ->get();

        return MountpointAccessResource::collection(
            $mountpoints
        );
    }

    public function update(
        SyncRoverAccountMountpointsRequest $request,
        RoverAccount $roverAccount
    ): AnonymousResourceCollection {
        $mountpoints = $request->validated(
            'mountpoints'
        );

        DB::transaction(
            function () use (
                $mountpoints,
                $request,
                $roverAccount
            ): void {
                $existingCreators = DB::table(
                    'mountpoint_rover_account'
                )
                    ->where(
                        'rover_account_id',
                        $roverAccount->id
                    )
                    ->pluck(
                        'created_by',
                        'mountpoint_id'
                    );

                $syncPayload = [];

                foreach ($mountpoints as $item) {
                    $mountpointId = (int) $item['id'];

                    $syncPayload[$mountpointId] = [
                        'enabled' => $item['enabled'] ?? true,

                        'max_connections' => $item['max_connections'] ?? null,

                        'starts_at' => $item['starts_at'] ?? null,

                        'expires_at' => $item['expires_at'] ?? null,

                        'created_by' => $existingCreators
                            ->get($mountpointId)
                            ?? $request->user()?->id,
                    ];
                }

                /*
                 * PUT mang ý nghĩa thay thế toàn bộ quyền hiện tại.
                 * Mountpoint không nằm trong payload sẽ bị thu hồi.
                 */
                $roverAccount
                    ->mountpoints()
                    ->sync($syncPayload);
            }
        );

        return $this->index(
            $roverAccount->fresh()
        );
    }
}
