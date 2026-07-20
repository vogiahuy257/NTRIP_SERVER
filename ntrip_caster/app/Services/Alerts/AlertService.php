<?php

namespace App\Services\Alerts;

use App\Events\Alerts\AlertAcknowledged;
use App\Events\Alerts\AlertOpened;
use App\Events\Alerts\AlertResolved;
use App\Events\Alerts\AlertUpdated;
use App\Models\Alert;
use App\Models\User;
use Carbon\CarbonInterface;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

final class AlertService
{
    /**
     * Mở Alert mới hoặc cập nhật Alert đang hoạt động.
     *
     * Khi fingerprint đang active:
     * - không tạo record mới;
     * - tăng occurrence_count;
     * - cập nhật last_observed_at;
     * - chỉ broadcast khi nội dung quan trọng thay đổi.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function openOrTouch(
        string $type,
        string $severity,
        string $fingerprint,
        string $title,
        string $message,
        ?int $stationId = null,
        ?int $mountpointId = null,
        ?int $ntripSessionId = null,
        array $metadata = [],
        ?CarbonInterface $observedAt = null,
    ): Alert {
        $this->validateSeverity($severity);

        $fingerprint = trim($fingerprint);

        if ($fingerprint === '') {
            throw new InvalidArgumentException(
                'Alert fingerprint cannot be empty.',
            );
        }

        $observedAt ??= now();

        return DB::transaction(
            function () use (
                $type,
                $severity,
                $fingerprint,
                $title,
                $message,
                $stationId,
                $mountpointId,
                $ntripSessionId,
                $metadata,
                $observedAt,
            ): Alert {
                $alert = Alert::query()
                    ->where(
                        'active_key',
                        $fingerprint,
                    )
                    ->lockForUpdate()
                    ->first();

                if ($alert !== null) {
                    $alert->fill([
                        'station_id' => $stationId,

                        'mountpoint_id' => $mountpointId,

                        'ntrip_session_id' => $ntripSessionId,

                        'type' => $type,
                        'severity' => $severity,
                        'title' => $title,
                        'message' => $message,
                        'metadata' => $metadata,
                    ]);

                    $meaningfulChange =
                        $alert->isDirty([
                            'station_id',
                            'mountpoint_id',
                            'ntrip_session_id',
                            'type',
                            'severity',
                            'title',
                            'message',
                            'metadata',
                        ]);

                    $alert->last_observed_at =
                        $observedAt;

                    $alert->occurrence_count =
                        (int) $alert
                            ->occurrence_count + 1;

                    $alert->save();

                    $alert = $this
                        ->loadRelations($alert);

                    if ($meaningfulChange) {
                        $this->broadcastAfterCommit(
                            new AlertUpdated(
                                alert: $this->payload(
                                    $alert,
                                ),
                                occurredAt: $observedAt
                                    ->toIso8601String(),
                            ),
                        );
                    }

                    return $alert;
                }

                $alert = Alert::query()->create([
                    'station_id' => $stationId,

                    'mountpoint_id' => $mountpointId,

                    'ntrip_session_id' => $ntripSessionId,

                    'type' => $type,
                    'severity' => $severity,
                    'status' => Alert::STATUS_OPEN,

                    'fingerprint' => $fingerprint,

                    'active_key' => $fingerprint,

                    'title' => $title,
                    'message' => $message,
                    'metadata' => $metadata,

                    'occurrence_count' => 1,

                    'opened_at' => $observedAt,

                    'last_observed_at' => $observedAt,
                ]);

                $alert = $this
                    ->loadRelations($alert);

                $this->broadcastAfterCommit(
                    new AlertOpened(
                        alert: $this->payload(
                            $alert,
                        ),
                        occurredAt: $observedAt
                            ->toIso8601String(),
                    ),
                );

                return $alert;
            },
        );
    }

    public function acknowledge(
        Alert $alert,
        User $user,
    ): Alert {
        return DB::transaction(
            function () use (
                $alert,
                $user,
            ): Alert {
                $lockedAlert = Alert::query()
                    ->whereKey(
                        $alert->getKey(),
                    )
                    ->lockForUpdate()
                    ->firstOrFail();

                if (
                    $lockedAlert->status ===
                    Alert::STATUS_RESOLVED
                ) {
                    throw new DomainException(
                        'Resolved alerts cannot be acknowledged.',
                    );
                }

                if (
                    $lockedAlert->status ===
                    Alert::STATUS_ACKNOWLEDGED
                ) {
                    return $this
                        ->loadRelations(
                            $lockedAlert,
                        );
                }

                $acknowledgedAt = now();

                $lockedAlert->update([
                    'status' => Alert::STATUS_ACKNOWLEDGED,

                    'acknowledged_at' => $acknowledgedAt,

                    'acknowledged_by_user_id' => $user->id,
                ]);

                $lockedAlert =
                    $this->loadRelations(
                        $lockedAlert,
                    );

                $this->broadcastAfterCommit(
                    new AlertAcknowledged(
                        alert: $this->payload(
                            $lockedAlert,
                        ),
                        occurredAt: $acknowledgedAt
                            ->toIso8601String(),
                    ),
                );

                return $lockedAlert;
            },
        );
    }

    public function resolve(
        Alert $alert,
        ?User $user = null,
        ?string $resolutionNote = null,
        ?CarbonInterface $resolvedAt = null,
    ): Alert {
        $resolvedAt ??= now();

        return DB::transaction(
            function () use (
                $alert,
                $user,
                $resolutionNote,
                $resolvedAt,
            ): Alert {
                $lockedAlert = Alert::query()
                    ->whereKey(
                        $alert->getKey(),
                    )
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($lockedAlert->isResolved()) {
                    return $this
                        ->loadRelations(
                            $lockedAlert,
                        );
                }

                $lockedAlert->update([
                    'status' => Alert::STATUS_RESOLVED,

                    /*
                     * Giải phóng unique active_key,
                     * cho phép cùng lỗi tái diễn.
                     */
                    'active_key' => null,

                    'resolved_at' => $resolvedAt,

                    'resolved_by_user_id' => $user?->id,

                    'resolution_note' => $resolutionNote,
                ]);

                $lockedAlert =
                    $this->loadRelations(
                        $lockedAlert,
                    );

                $this->broadcastAfterCommit(
                    new AlertResolved(
                        alert: $this->payload(
                            $lockedAlert,
                        ),
                        occurredAt: $resolvedAt
                            ->toIso8601String(),
                    ),
                );

                return $lockedAlert;
            },
        );
    }

    public function resolveByFingerprint(
        string $fingerprint,
        ?User $user = null,
        ?string $resolutionNote = null,
        ?CarbonInterface $resolvedAt = null,
    ): ?Alert {
        $alert = Alert::query()
            ->where(
                'active_key',
                $fingerprint,
            )
            ->first();

        if ($alert === null) {
            return null;
        }

        return $this->resolve(
            alert: $alert,
            user: $user,
            resolutionNote: $resolutionNote,
            resolvedAt: $resolvedAt,
        );
    }

    private function validateSeverity(
        string $severity,
    ): void {
        if (
            ! in_array(
                $severity,
                [
                    Alert::SEVERITY_WARNING,
                    Alert::SEVERITY_CRITICAL,
                ],
                true,
            )
        ) {
            throw new InvalidArgumentException(
                "Unsupported alert severity: {$severity}",
            );
        }
    }

    private function loadRelations(
        Alert $alert,
    ): Alert {
        return $alert->loadMissing([
            'station:id,device_id,name',
            'mountpoint:id,station_id,name',

            'ntripSession:id,mountpoint_id,connection_type,remote_ip',

            'acknowledgedBy:id,name',
            'resolvedBy:id,name',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(
        Alert $alert,
    ): array {
        return [
            'id' => $alert->id,

            'type' => $alert->type,
            'severity' => $alert->severity,
            'status' => $alert->status,

            'title' => $alert->title,
            'message' => $alert->message,

            'metadata' => $alert->metadata ?? [],

            'occurrence_count' => $alert->occurrence_count,

            'opened_at' => $alert
                ->opened_at
                ?->toIso8601String(),

            'last_observed_at' => $alert
                ->last_observed_at
                ?->toIso8601String(),

            'acknowledged_at' => $alert
                ->acknowledged_at
                ?->toIso8601String(),

            'resolved_at' => $alert
                ->resolved_at
                ?->toIso8601String(),

            'resolution_note' => $alert->resolution_note,

            'station' => $alert->station === null
                    ? null
                    : [
                        'id' => $alert
                            ->station
                            ->id,

                        'device_id' => $alert
                            ->station
                            ->device_id,

                        'name' => $alert
                            ->station
                            ->name,
                    ],

            'mountpoint' => $alert->mountpoint === null
                    ? null
                    : [
                        'id' => $alert
                            ->mountpoint
                            ->id,

                        'station_id' => $alert
                            ->mountpoint
                            ->station_id,

                        'name' => $alert
                            ->mountpoint
                            ->name,
                    ],

            'ntrip_session' => $alert->ntripSession === null
                    ? null
                    : [
                        'id' => $alert
                            ->ntripSession
                            ->id,

                        'mountpoint_id' => $alert
                            ->ntripSession
                            ->mountpoint_id,

                        'connection_type' => $alert
                            ->ntripSession
                            ->connection_type,

                        'remote_ip' => $alert
                            ->ntripSession
                            ->remote_ip,
                    ],

            'acknowledged_by' => $alert->acknowledgedBy === null
                    ? null
                    : [
                        'id' => $alert
                            ->acknowledgedBy
                            ->id,

                        'name' => $alert
                            ->acknowledgedBy
                            ->name,
                    ],

            'resolved_by' => $alert->resolvedBy === null
                    ? null
                    : [
                        'id' => $alert
                            ->resolvedBy
                            ->id,

                        'name' => $alert
                            ->resolvedBy
                            ->name,
                    ],
        ];
    }

    private function broadcastAfterCommit(
        object $event,
    ): void {
        DB::afterCommit(
            function () use ($event): void {
                try {
                    event($event);
                } catch (Throwable $exception) {
                    /*
                     * Alert vẫn được lưu dù queue
                     * hoặc Reverb tạm thời bị lỗi.
                     */
                    report($exception);
                }
            },
        );
    }
}
