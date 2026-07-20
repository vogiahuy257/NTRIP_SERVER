<?php

namespace App\Services\Alerts;

use App\Models\Alert;
use App\Models\AlertRuleState;
use App\Models\Station;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

final class AlertRuleEvaluator
{
    public function __construct(
        private readonly AlertService $alerts,
    ) {}

    /**
     * @return array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * }
     */
    public function evaluateAll(): array
    {
        $summary = $this->emptySummary();

        Station::query()
            ->with([
                'config',
                'mountpoint',
                'telemetry',
            ])
            ->orderBy('id')
            ->chunkById(
                100,
                function (
                    Collection $stations,
                ) use (&$summary): void {
                    foreach ($stations as $station) {
                        $result =
                            $this->evaluateStation(
                                $station,
                            );

                        $summary =
                            $this->mergeSummary(
                                $summary,
                                $result,
                            );
                    }
                },
            );

        return $summary;
    }

    /**
     * @return array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * }
     */
    public function evaluateStation(
        Station $station,
    ): array {
        $station->loadMissing([
            'config',
            'mountpoint',
            'telemetry',
        ]);

        $now = CarbonImmutable::now();

        if (! $station->enabled) {
            return $this->resolveDisabledStation(
                station: $station,
                now: $now,
            );
        }

        $summary = $this->emptySummary();
        $summary['stations'] = 1;

        $payload =
            $this->telemetryPayload(
                $station,
            );

        $rtcm = $this->rtcmPayload(
            $payload,
        );

        $stationOffline =
            $this->isStationOffline(
                station: $station,
                now: $now,
            );

        $this->recordResult(
            $summary,
            $this->evaluateStationOffline(
                station: $station,
                condition: $stationOffline,
                now: $now,
            ),
        );

        $this->recordResult(
            $summary,
            $this->evaluateSourceDisconnected(
                station: $station,
                stationOffline: $stationOffline,
                now: $now,
            ),
        );

        $this->recordResult(
            $summary,
            $this->evaluateRtcmStalled(
                station: $station,
                stationOffline: $stationOffline,
                rtcm: $rtcm,
                now: $now,
            ),
        );

        $this->recordResult(
            $summary,
            $this->evaluateCrcErrors(
                station: $station,
                stationOffline: $stationOffline,
                rtcm: $rtcm,
                now: $now,
            ),
        );

        return $summary;
    }

    private function evaluateStationOffline(
        Station $station,
        bool $condition,
        CarbonInterface $now,
    ): string {
        $rule =
            Alert::TYPE_STATION_OFFLINE;

        $lastSeenAt =
            $station->last_seen_at;

        $offlineSeconds =
            $this->secondsSince(
                $lastSeenAt ??
                    $station->created_at,
                $now,
            );

        return $this->evaluateState(
            state: $this->state(
                station: $station,
                rule: $rule,
            ),

            condition: $condition,

            openAfterSeconds: 0,

            resolveAfterSeconds: (int) config(
                'alerts.rules.station_offline.resolve_after_seconds',
                10,
            ),

            fingerprint: $this->fingerprint(
                rule: $rule,
                station: $station,
            ),

            alertDefinition: [
                'type' => $rule,

                'severity' => Alert::SEVERITY_CRITICAL,

                'title' => 'Station offline',

                'message' => "{$station->name} has stopped sending telemetry.",

                'station_id' => $station->id,

                'mountpoint_id' => $station
                    ->mountpoint
                    ?->id,

                'metadata' => [
                    'offline_seconds' => $offlineSeconds,

                    'last_seen_at' => $lastSeenAt
                        ?->toIso8601String(),
                ],
            ],

            sample: [
                'offline_seconds' => $offlineSeconds,

                'last_seen_at' => $lastSeenAt
                    ?->toIso8601String(),
            ],

            now: $now,
        );
    }

    private function evaluateSourceDisconnected(
        Station $station,
        bool $stationOffline,
        CarbonInterface $now,
    ): string {
        $rule =
            Alert::TYPE_SOURCE_DISCONNECTED;

        /*
         * Khi Station đã offline, chỉ giữ Alert
         * Station Offline để tránh alert storm.
         */
        $condition =
            ! $stationOffline
            && ! $station->source_connected;

        return $this->evaluateState(
            state: $this->state(
                station: $station,
                rule: $rule,
            ),

            condition: $condition,

            openAfterSeconds: (int) config(
                'alerts.rules.source_disconnected.open_after_seconds',
                10,
            ),

            resolveAfterSeconds: (int) config(
                'alerts.rules.source_disconnected.resolve_after_seconds',
                5,
            ),

            fingerprint: $this->fingerprint(
                rule: $rule,
                station: $station,
            ),

            alertDefinition: [
                'type' => $rule,

                'severity' => Alert::SEVERITY_CRITICAL,

                'title' => 'Source disconnected',

                'message' => "{$station->name} is online but its NTRIP Source is disconnected.",

                'station_id' => $station->id,

                'mountpoint_id' => $station
                    ->mountpoint
                    ?->id,

                'metadata' => [
                    'source_connected' => (bool) $station
                        ->source_connected,

                    'last_seen_at' => $station
                        ->last_seen_at
                        ?->toIso8601String(),
                ],
            ],

            sample: [
                'source_connected' => (bool) $station
                    ->source_connected,
            ],

            now: $now,
        );
    }

    /**
     * @param  array<string, mixed>|null  $rtcm
     */
    private function evaluateRtcmStalled(
        Station $station,
        bool $stationOffline,
        ?array $rtcm,
        CarbonInterface $now,
    ): string {
        $rule =
            Alert::TYPE_RTCM_STREAM_STALLED;

        $sourceConnected =
            (bool) $station
                ->source_connected;

        /*
         * null nghĩa là chưa đủ dữ liệu để kết luận.
         */
        $condition = null;

        $uploadBps = null;
        $ageMs = null;

        $maxAgeMs =
            (int) (
                $station
                    ->config
                    ?->max_rtcm_age_ms
                ?? config(
                    'alerts.rules.rtcm_stream_stalled.max_age_ms',
                    1500,
                )
            );

        if (
            $stationOffline
            || ! $sourceConnected
        ) {
            /*
             * Alert cấp cao hơn đang giải thích
             * nguyên nhân, nên Stalled được phục hồi.
             */
            $condition = false;
        } elseif ($rtcm !== null) {
            $uploadBps =
                $this->integerOrNull(
                    $rtcm['upload_bps']
                        ?? null,
                );

            $ageMs =
                $this->integerOrNull(
                    $rtcm['age_ms']
                        ?? null,
                );

            $condition =
                ($uploadBps ?? 0) <= 0
                || $ageMs === null
                || $ageMs > $maxAgeMs;
        }

        return $this->evaluateState(
            state: $this->state(
                station: $station,
                rule: $rule,
            ),

            condition: $condition,

            openAfterSeconds: (int) config(
                'alerts.rules.rtcm_stream_stalled.open_after_seconds',
                15,
            ),

            resolveAfterSeconds: (int) config(
                'alerts.rules.rtcm_stream_stalled.resolve_after_seconds',
                5,
            ),

            fingerprint: $this->fingerprint(
                rule: $rule,
                station: $station,
            ),

            alertDefinition: [
                'type' => $rule,

                'severity' => Alert::SEVERITY_CRITICAL,

                'title' => 'RTCM stream stalled',

                'message' => "{$station->name} is connected but RTCM data is not flowing.",

                'station_id' => $station->id,

                'mountpoint_id' => $station
                    ->mountpoint
                    ?->id,

                'metadata' => [
                    'upload_bps' => $uploadBps,

                    'age_ms' => $ageMs,

                    'max_age_ms' => $maxAgeMs,
                ],
            ],

            sample: [
                'upload_bps' => $uploadBps,

                'age_ms' => $ageMs,

                'max_age_ms' => $maxAgeMs,
            ],

            now: $now,
        );
    }

    /**
     * @param  array<string, mixed>|null  $rtcm
     */
    private function evaluateCrcErrors(
        Station $station,
        bool $stationOffline,
        ?array $rtcm,
        CarbonInterface $now,
    ): string {
        $rule =
            Alert::TYPE_RTCM_CRC_ERRORS;

        $state = $this->state(
            station: $station,
            rule: $rule,
        );

        $currentCrc = $rtcm === null
            ? null
            : $this->integerOrNull(
                $rtcm['crc_errors']
                    ?? null,
            );

        $previousCrc =
            $this->integerOrNull(
                $state
                    ->last_sample[
                        'crc_errors'
                    ]
                ?? null,
            );

        $delta = 0;
        $condition = null;

        if (
            $stationOffline
            || ! $station->source_connected
        ) {
            $condition = false;
        } elseif ($currentCrc !== null) {
            if (
                $previousCrc === null
                || $currentCrc <
                    $previousCrc
            ) {
                /*
                 * Mẫu đầu tiên hoặc counter vừa reset:
                 * chỉ tạo baseline, không cảnh báo.
                 */
                $condition = false;
            } else {
                $delta =
                    $currentCrc -
                    $previousCrc;

                $condition =
                    $delta > 0;
            }
        }

        return $this->evaluateState(
            state: $state,

            condition: $condition,

            openAfterSeconds: (int) config(
                'alerts.rules.rtcm_crc_errors.open_after_seconds',
                0,
            ),

            resolveAfterSeconds: (int) config(
                'alerts.rules.rtcm_crc_errors.resolve_after_seconds',
                60,
            ),

            fingerprint: $this->fingerprint(
                rule: $rule,
                station: $station,
            ),

            alertDefinition: [
                'type' => $rule,

                'severity' => Alert::SEVERITY_WARNING,

                'title' => 'RTCM CRC errors detected',

                'message' => "{$station->name} recorded {$delta} new RTCM CRC errors.",

                'station_id' => $station->id,

                'mountpoint_id' => $station
                    ->mountpoint
                    ?->id,

                'metadata' => [
                    'new_errors' => $delta,

                    'total_errors' => $currentCrc,
                ],
            ],

            sample: [
                'crc_errors' => $currentCrc,
            ],

            now: $now,

            /*
             * Mỗi đợt CRC mới cập nhật Alert
             * và tăng occurrence_count.
             */
            touchWhileActive: $condition === true,
        );
    }

    /**
     * @param array{
     *     type: string,
     *     severity: string,
     *     title: string,
     *     message: string,
     *     station_id: int,
     *     mountpoint_id: int|null,
     *     metadata: array<string, mixed>
     * } $alertDefinition
     * @param  array<string, mixed>  $sample
     */
    private function evaluateState(
        AlertRuleState $state,
        ?bool $condition,
        int $openAfterSeconds,
        int $resolveAfterSeconds,
        string $fingerprint,
        array $alertDefinition,
        array $sample,
        CarbonInterface $now,
        bool $touchWhileActive = false,
    ): string {
        $state->last_sample = $sample;
        $state->last_evaluated_at =
            $now;

        /*
         * Không đủ dữ liệu:
         * giữ nguyên trạng thái hiện tại.
         */
        if ($condition === null) {
            $state->save();

            return 'none';
        }

        if ($condition) {
            $state->recovery_started_at =
                null;

            if (
                $state
                    ->condition_started_at ===
                null
            ) {
                $state
                    ->condition_started_at =
                    $now;
            }

            $badForSeconds =
                $this->secondsSince(
                    $state
                        ->condition_started_at,
                    $now,
                );

            if (
                ! $state->condition_active
                && $badForSeconds >=
                    $openAfterSeconds
            ) {
                $this->openAlert(
                    definition: $alertDefinition,
                    fingerprint: $fingerprint,
                    now: $now,
                );

                $state->condition_active =
                    true;

                $state->save();

                return 'opened';
            }

            if (
                $state->condition_active
                && $touchWhileActive
            ) {
                $this->openAlert(
                    definition: $alertDefinition,
                    fingerprint: $fingerprint,
                    now: $now,
                );

                $state->save();

                return 'updated';
            }

            $state->save();

            return 'none';
        }

        $state->condition_started_at =
            null;

        if (! $state->condition_active) {
            $state->recovery_started_at =
                null;

            $state->save();

            return 'none';
        }

        if (
            $state
                ->recovery_started_at ===
            null
        ) {
            $state->recovery_started_at =
                $now;

            $state->save();

            return 'none';
        }

        $healthyForSeconds =
            $this->secondsSince(
                $state
                    ->recovery_started_at,
                $now,
            );

        if (
            $healthyForSeconds <
            $resolveAfterSeconds
        ) {
            $state->save();

            return 'none';
        }

        $resolved =
            $this->alerts
                ->resolveByFingerprint(
                    fingerprint: $fingerprint,

                    resolutionNote: 'The monitored condition recovered.',

                    resolvedAt: $now,
                );

        $state->condition_active = false;
        $state->recovery_started_at =
            null;

        $state->save();

        return $resolved === null
            ? 'none'
            : 'resolved';
    }

    /**
     * @param array{
     *     type: string,
     *     severity: string,
     *     title: string,
     *     message: string,
     *     station_id: int,
     *     mountpoint_id: int|null,
     *     metadata: array<string, mixed>
     * } $definition
     */
    private function openAlert(
        array $definition,
        string $fingerprint,
        CarbonInterface $now,
    ): void {
        $this->alerts->openOrTouch(
            type: $definition['type'],

            severity: $definition['severity'],

            fingerprint: $fingerprint,

            title: $definition['title'],

            message: $definition['message'],

            stationId: $definition['station_id'],

            mountpointId: $definition[
                    'mountpoint_id'
                ],

            metadata: $definition['metadata'],

            observedAt: $now,
        );
    }

    private function state(
        Station $station,
        string $rule,
    ): AlertRuleState {
        $state =
            AlertRuleState::query()
                ->firstOrNew([
                    'station_id' => $station->id,

                    'rule' => $rule,
                ]);

        if (! $state->exists) {
            $state->condition_active =
                false;

            $state->last_sample = [];
        }

        return $state;
    }

    private function isStationOffline(
        Station $station,
        CarbonInterface $now,
    ): bool {
        $threshold =
            (int) config(
                'alerts.rules.station_offline.after_seconds',
                30,
            );

        $reference =
            $station->last_seen_at
            ?? $station->created_at;

        return $this->secondsSince(
            $reference,
            $now,
        ) >= $threshold;
    }

    /**
     * @return array<string, mixed>
     */
    private function telemetryPayload(
        Station $station,
    ): array {
        $payload =
            $station
                ->telemetry
                ?->payload;

        if (is_array($payload)) {
            return $payload;
        }

        if (is_string($payload)) {
            $decoded = json_decode(
                $payload,
                true,
            );

            return is_array($decoded)
                ? $decoded
                : [];
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function rtcmPayload(
        array $payload,
    ): ?array {
        $rtcm = $payload['rtcm']
            ?? null;

        return is_array($rtcm)
            ? $rtcm
            : null;
    }

    private function integerOrNull(
        mixed $value,
    ): ?int {
        if (
            is_int($value)
            || is_float($value)
        ) {
            return (int) $value;
        }

        if (
            is_string($value)
            && is_numeric($value)
        ) {
            return (int) $value;
        }

        return null;
    }

    private function secondsSince(
        ?CarbonInterface $since,
        CarbonInterface $now,
    ): int {
        if ($since === null) {
            return 0;
        }

        return max(
            0,
            $now->getTimestamp()
                - $since->getTimestamp(),
        );
    }

    private function fingerprint(
        string $rule,
        Station $station,
    ): string {
        return "{$rule}:station:{$station->id}";
    }

    /**
     * @return array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * }
     */
    private function resolveDisabledStation(
        Station $station,
        CarbonInterface $now,
    ): array {
        $summary = $this->emptySummary();
        $summary['stations'] = 1;

        foreach (
            [
                Alert::TYPE_STATION_OFFLINE,
                Alert::TYPE_SOURCE_DISCONNECTED,
                Alert::TYPE_RTCM_STREAM_STALLED,
                Alert::TYPE_RTCM_CRC_ERRORS,
            ] as $rule
        ) {
            $resolved =
                $this->alerts
                    ->resolveByFingerprint(
                        fingerprint: $this->fingerprint(
                            rule: $rule,
                            station: $station,
                        ),

                        resolutionNote: 'Station monitoring was disabled.',

                        resolvedAt: $now,
                    );

            if ($resolved !== null) {
                $summary['resolved']++;
            }
        }

        AlertRuleState::query()
            ->where(
                'station_id',
                $station->id,
            )
            ->update([
                'condition_active' => false,

                'condition_started_at' => null,

                'recovery_started_at' => null,

                'last_evaluated_at' => $now,
            ]);

        return $summary;
    }

    /**
     * @return array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * }
     */
    private function emptySummary(): array
    {
        return [
            'stations' => 0,
            'opened' => 0,
            'updated' => 0,
            'resolved' => 0,
        ];
    }

    /**
     * @param array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * } $left
     * @param array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * } $right
     * @return array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * }
     */
    private function mergeSummary(
        array $left,
        array $right,
    ): array {
        return [
            'stations' => $left['stations']
                + $right['stations'],

            'opened' => $left['opened']
                + $right['opened'],

            'updated' => $left['updated']
                + $right['updated'],

            'resolved' => $left['resolved']
                + $right['resolved'],
        ];
    }

    /**
     * @param array{
     *     stations: int,
     *     opened: int,
     *     updated: int,
     *     resolved: int
     * } $summary
     */
    private function recordResult(
        array &$summary,
        string $result,
    ): void {
        if (
            array_key_exists(
                $result,
                $summary,
            )
        ) {
            $summary[$result]++;
        }
    }
}
