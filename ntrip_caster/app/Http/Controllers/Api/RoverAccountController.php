<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreRoverAccountRequest;
use App\Http\Requests\Api\UpdateRoverAccountRequest;
use App\Http\Resources\Api\RoverAccountResource;
use App\Models\RoverAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RoverAccountController extends Controller
{
    public function index(
        Request $request,
    ): AnonymousResourceCollection {
        $search = trim(
            (string) $request->query(
                'search',
                '',
            ),
        );

        $status = (string) $request->query(
            'status',
            'all',
        );

        $perPage = min(
            max(
                $request->integer(
                    'per_page',
                    20,
                ),
                1,
            ),
            100,
        );

        $accounts = RoverAccount::query()
            ->withCount([
                'mountpoints',
                'activeSessions',
            ])
            ->when(
                $search !== '',
                function (Builder $query) use ($search): void {
                    $query->where(
                        function (Builder $query) use ($search): void {
                            $query
                                ->where(
                                    'username',
                                    'like',
                                    "%{$search}%",
                                )
                                ->orWhere(
                                    'display_name',
                                    'like',
                                    "%{$search}%",
                                );
                        },
                    );
                },
            )
            ->when(
                $status === 'active',
                function (Builder $query): void {
                    $query
                        ->where(
                            'enabled',
                            true,
                        )
                        ->where(
                            function (Builder $query): void {
                                $query
                                    ->whereNull(
                                        'expires_at',
                                    )
                                    ->orWhere(
                                        'expires_at',
                                        '>',
                                        now(),
                                    );
                            },
                        );
                },
            )
            ->when(
                $status === 'disabled',
                fn (Builder $query): Builder => $query->where(
                    'enabled',
                    false,
                ),
            )
            ->when(
                $status === 'expired',
                fn (Builder $query): Builder => $query
                    ->whereNotNull(
                        'expires_at',
                    )
                    ->where(
                        'expires_at',
                        '<=',
                        now(),
                    ),
            )
            ->orderBy('username')
            ->paginate($perPage)
            ->withQueryString();

        return RoverAccountResource::collection(
            $accounts,
        );
    }

    public function store(
        StoreRoverAccountRequest $request,
    ): RoverAccountResource {
        $data = $request->validated();

        $account = RoverAccount::query()->create([
            'username' => $data['username'],

            'display_name' =>
                $data['display_name'] ?? null,

            'password_hash' => Hash::make(
                $data['password'],
            ),

            'enabled' =>
                $data['enabled'] ?? true,

            'max_connections' =>
                $data['max_connections'] ?? 1,

            'expires_at' =>
                $data['expires_at'] ?? null,

            'notes' =>
                $data['notes'] ?? null,

            'created_by' =>
                $request->user()?->id,
        ]);

        return new RoverAccountResource(
            $account->loadCount([
                'mountpoints',
                'activeSessions',
            ]),
        );
    }

    public function show(
        RoverAccount $roverAccount,
    ): RoverAccountResource {
        $roverAccount->load([
            'creator:id,name,email',

            'mountpoints' => function (
                BelongsToMany $query,
            ): void {
                $query
                    ->with(
                        'station:id,device_id,name,source_connected',
                    )
                    ->orderBy('name');
            },
        ]);

        $roverAccount->loadCount([
            'mountpoints',
            'activeSessions',
        ]);

        return new RoverAccountResource(
            $roverAccount,
        );
    }

    public function update(
        UpdateRoverAccountRequest $request,
        RoverAccount $roverAccount,
    ): RoverAccountResource {
        $data = $request->validated();

        DB::transaction(
            function () use (
                $data,
                $roverAccount,
            ): void {
                $updates = [];

                foreach ([
                    'username',
                    'display_name',
                    'enabled',
                    'max_connections',
                    'expires_at',
                    'notes',
                ] as $field) {
                    if (
                        array_key_exists(
                            $field,
                            $data,
                        )
                    ) {
                        $updates[$field] =
                            $data[$field];
                    }
                }

                if (
                    isset($data['password'])
                    && $data['password'] !== ''
                ) {
                    $updates['password_hash'] =
                        Hash::make(
                            $data['password'],
                        );
                }

                if ($updates !== []) {
                    $roverAccount->update(
                        $updates,
                    );
                }

                /*
                 * Giới hạn riêng của từng Mountpoint
                 * không được lớn hơn giới hạn của tài khoản.
                 */
                if (
                    array_key_exists(
                        'max_connections',
                        $updates,
                    )
                ) {
                    DB::table(
                        'mountpoint_rover_account',
                    )
                        ->where(
                            'rover_account_id',
                            $roverAccount->id,
                        )
                        ->where(
                            'max_connections',
                            '>',
                            $roverAccount
                                ->max_connections,
                        )
                        ->update([
                            'max_connections' =>
                                $roverAccount
                                    ->max_connections,

                            'updated_at' => now(),
                        ]);
                }
            },
        );

        $roverAccount->refresh();

        return $this->show(
            $roverAccount,
        );
    }

    public function destroy(
        RoverAccount $roverAccount,
    ): JsonResponse|Response {
        if (
            $roverAccount
                ->activeSessions()
                ->exists()
        ) {
            return response()->json([
                'message' => implode(' ', [
                    'Cannot delete a Rover Account',
                    'while it has active connections.',
                ]),
            ], Response::HTTP_CONFLICT);
        }

        DB::transaction(
            function () use (
                $roverAccount,
            ): void {
                $roverAccount->update([
                    'enabled' => false,
                ]);

                $roverAccount->delete();
            },
        );

        return response()->noContent();
    }
}