<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class AutoMountpointCoordinator
{
    /**
     * @var array<int, array{
     *     expires_at: int,
     *     rules: array<int, array{
     *         grant_limit: ?int,
     *         mountpoint_limit: ?int
     *     }>
     * }>
     */
    private array $accessCache = [];

    public function __construct(
        private readonly AutoMountpointCandidateProvider $candidates,
        private readonly AutoMountpointRouter $router,
    ) {}

    /**
     * @param  array<string, array<string, mixed>>  $catalog
     * @param  iterable<string>  $connectedMountpoints
     * @param  array<int, int>  $activeMountpointCounts
     * @param  array<int, int>  $activeGrantCounts
     */
    public function decide(
        int $roverAccountId,
        float $roverLatitude,
        float $roverLongitude,
        ?int $currentMountpointId,
        array $catalog,
        iterable $connectedMountpoints,
        array $activeMountpointCounts = [],
        array $activeGrantCounts = [],
    ): AutoMountpointDecision {
        $candidateList = $this->candidates->fromRuntimeCatalog(
            catalog: $catalog,
            connectedMountpoints: $connectedMountpoints,
            virtualMountpointName: (string) config(
                'ntrip.auto_mountpoint.name',
                'AUTO',
            ),
            allowedMountpointIds: $this->eligibleMountpointIds(
                roverAccountId: $roverAccountId,
                currentMountpointId: $currentMountpointId,
                activeMountpointCounts: $activeMountpointCounts,
                activeGrantCounts: $activeGrantCounts,
            ),
        );

        return $this->router->decide(
            roverLatitude: $roverLatitude,
            roverLongitude: $roverLongitude,
            currentMountpointId: $currentMountpointId,
            candidates: $candidateList,
            serviceRadiusMeters: max(
                1.0,
                (float) config(
                    'ntrip.auto_mountpoint.service_radius_meters',
                    10_000,
                ),
            ),
        );
    }

    /**
     * @param  array<int, int>  $activeMountpointCounts
     * @param  array<int, int>  $activeGrantCounts
     * @return list<int>
     */
    private function eligibleMountpointIds(
        int $roverAccountId,
        ?int $currentMountpointId,
        array $activeMountpointCounts,
        array $activeGrantCounts,
    ): array {
        $eligible = [];

        foreach ($this->accessRules($roverAccountId) as $mountpointId => $rule) {
            if ($mountpointId === $currentMountpointId) {
                $eligible[] = $mountpointId;

                continue;
            }

            if (
                $this->limitReached(
                    $activeMountpointCounts[$mountpointId] ?? 0,
                    $rule['mountpoint_limit'],
                )
                || $this->limitReached(
                    $activeGrantCounts[$mountpointId] ?? 0,
                    $rule['grant_limit'],
                )
            ) {
                continue;
            }

            $eligible[] = $mountpointId;
        }

        return $eligible;
    }

    /**
     * @return array<int, array{
     *     grant_limit: ?int,
     *     mountpoint_limit: ?int
     * }>
     */
    private function accessRules(int $roverAccountId): array
    {
        $nowTimestamp = time();
        $cached = $this->accessCache[$roverAccountId] ?? null;

        if ($cached !== null && $cached['expires_at'] > $nowTimestamp) {
            return $cached['rules'];
        }

        $now = now();

        $rows = DB::table('mountpoint_rover_account as grants')
            ->join(
                'mountpoints',
                'mountpoints.id',
                '=',
                'grants.mountpoint_id',
            )
            ->where('grants.rover_account_id', $roverAccountId)
            ->where('grants.enabled', true)
            ->where('mountpoints.enabled', true)
            ->where(function (Builder $query) use ($now): void {
                $query
                    ->whereNull('grants.starts_at')
                    ->orWhere('grants.starts_at', '<=', $now);
            })
            ->where(function (Builder $query) use ($now): void {
                $query
                    ->whereNull('grants.expires_at')
                    ->orWhere('grants.expires_at', '>', $now);
            })
            ->get([
                'grants.mountpoint_id',
                'grants.max_connections as grant_limit',
                'mountpoints.max_rover_connections as mountpoint_limit',
            ]);

        $rules = [];

        foreach ($rows as $row) {
            $mountpointId = (int) $row->mountpoint_id;

            $rules[$mountpointId] = [
                'grant_limit' => $row->grant_limit === null
                    ? null
                    : (int) $row->grant_limit,
                'mountpoint_limit' => $row->mountpoint_limit === null
                    ? null
                    : (int) $row->mountpoint_limit,
            ];
        }

        $this->accessCache[$roverAccountId] = [
            'expires_at' => $nowTimestamp + max(
                1,
                (int) config(
                    'ntrip.auto_mountpoint.access_refresh_seconds',
                    10,
                ),
            ),
            'rules' => $rules,
        ];

        return $rules;
    }

    private function limitReached(int $active, ?int $limit): bool
    {
        return $limit !== null && $active >= $limit;
    }
}
