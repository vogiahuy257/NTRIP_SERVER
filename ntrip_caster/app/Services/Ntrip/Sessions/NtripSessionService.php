<?php

namespace App\Services\Ntrip\Sessions;

use App\Events\NtripSessionEnded;
use App\Events\NtripSessionStarted;
use App\Events\NtripSessionUpdated;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use Illuminate\Support\Facades\DB;
use Throwable;

final class NtripSessionService
{
    public function createSource(
        int $mountpointId,
        int $stationId,
        string $remoteIp,
        ?string $clientAgent = null,
        ?string $ntripVersion = null,
    ): NtripSession {
        $session = NtripSession::query()->create([
            'mountpoint_id' => $mountpointId,
            'station_id' => $stationId,
            'rover_account_id' => null,
            'connection_type' => NtripSession::TYPE_SOURCE,
            'authenticated_username' => null,
            'client_agent' => $clientAgent,
            'ntrip_version' => $ntripVersion,
            'remote_ip' => $remoteIp,
            'connected_at' => now(),
            'bytes_transferred' => 0,
            'valid_rtcm_frames' => 0,
            'rtcm_crc_errors' => 0,
            'rtcm_message_counts' => [],
        ]);

        $session->load([
            'mountpoint:id,station_id,name',
            'mountpoint.station:id,device_id,name',
        ]);

        $this->broadcastAfterCommit(
            new NtripSessionStarted(
                session: $this->fullPayload($session),
                occurredAt: $session->connected_at->toIso8601String(),
            ),
        );

        return $session;
    }

    public function createRover(
        Mountpoint $mountpoint,
        ?RoverAccount $account,
        string $remoteIp,
        ?string $clientAgent = null,
        ?string $ntripVersion = null,
    ): NtripSession {
        $session = NtripSession::query()->create([
            'mountpoint_id' => $mountpoint->id,
            'station_id' => null,
            'rover_account_id' => $account?->id,
            'connection_type' => NtripSession::TYPE_ROVER,
            'authenticated_username' => $account?->username,
            'client_agent' => $clientAgent,
            'ntrip_version' => $ntripVersion,
            'remote_ip' => $remoteIp,
            'connected_at' => now(),
            'bytes_transferred' => 0,
            'valid_rtcm_frames' => 0,
            'rtcm_crc_errors' => 0,
            'rtcm_message_counts' => [],
        ]);

        $session->load([
            'mountpoint:id,station_id,name',
            'mountpoint.station:id,device_id,name',
        ]);

        $this->broadcastAfterCommit(
            new NtripSessionStarted(
                session: $this->fullPayload($session),
                occurredAt: $session->connected_at->toIso8601String(),
            ),
        );

        return $session;
    }

    /**
     * Cập nhật thống kê định kỳ của session đang hoạt động.
     *
     * Source có thêm thống kê RTCM.
     * Rover chỉ cần bytes_transferred.
     *
     * @param  array<array-key, int>|null  $rtcmMessageCounts
     */
    public function updateStats(
        int $sessionId,
        int $bytesTransferred,
        ?int $validRtcmFrames = null,
        ?int $rtcmCrcErrors = null,
        ?array $rtcmMessageCounts = null,
    ): bool {
        $updateData = [
            'bytes_transferred' => max(
                0,
                $bytesTransferred,
            ),
        ];

        if ($validRtcmFrames !== null) {
            $updateData['valid_rtcm_frames'] = max(
                0,
                $validRtcmFrames,
            );
        }

        if ($rtcmCrcErrors !== null) {
            $updateData['rtcm_crc_errors'] = max(
                0,
                $rtcmCrcErrors,
            );
        }

        if ($rtcmMessageCounts !== null) {
            $updateData['rtcm_message_counts'] =
                $this->normaliseMessageCounts(
                    $rtcmMessageCounts,
                );
        }

        $updated = NtripSession::query()
            ->active()
            ->whereKey($sessionId)
            ->update($updateData);

        if ($updated === 0) {
            return false;
        }

        $occurredAt = now()->toIso8601String();

        $payload = [
            'id' => $sessionId,
            'bytes_transferred' => $updateData['bytes_transferred'],
            'updated_at' => $occurredAt,
        ];

        if (array_key_exists(
            'valid_rtcm_frames',
            $updateData,
        )) {
            $payload['valid_rtcm_frames'] =
                $updateData['valid_rtcm_frames'];
        }

        if (array_key_exists(
            'rtcm_crc_errors',
            $updateData,
        )) {
            $payload['rtcm_crc_errors'] =
                $updateData['rtcm_crc_errors'];
        }

        if (array_key_exists(
            'rtcm_message_counts',
            $updateData,
        )) {
            $payload['rtcm_message_counts'] =
                $updateData['rtcm_message_counts'];
        }

        $this->broadcastAfterCommit(
            new NtripSessionUpdated(
                session: $payload,
                occurredAt: $occurredAt,
            ),
        );

        return true;
    }

    /**
     * Kết thúc một session đang hoạt động.
     *
     * @param  array<array-key, int>|null  $rtcmMessageCounts
     */
    public function end(
        int $sessionId,
        int $bytesTransferred,
        string $disconnectReason,
        ?int $validRtcmFrames = null,
        ?int $rtcmCrcErrors = null,
        ?array $rtcmMessageCounts = null,
    ): bool {
        $session = NtripSession::query()
            ->active()
            ->with([
                'mountpoint:id,station_id,name',
                'mountpoint.station:id,device_id,name',
            ])
            ->find($sessionId);

        if ($session === null) {
            return false;
        }

        $disconnectedAt = now();

        $session->disconnected_at = $disconnectedAt;
        $session->bytes_transferred = max(
            0,
            $bytesTransferred,
        );
        $session->disconnect_reason =
            $disconnectReason;

        if ($validRtcmFrames !== null) {
            $session->valid_rtcm_frames = max(
                0,
                $validRtcmFrames,
            );
        }

        if ($rtcmCrcErrors !== null) {
            $session->rtcm_crc_errors = max(
                0,
                $rtcmCrcErrors,
            );
        }

        if ($rtcmMessageCounts !== null) {
            $session->rtcm_message_counts =
                $this->normaliseMessageCounts(
                    $rtcmMessageCounts,
                );
        }

        $session->save();

        $this->broadcastAfterCommit(
            new NtripSessionEnded(
                session: $this->fullPayload($session),
                occurredAt: $disconnectedAt->toIso8601String(),
            ),
        );

        return true;
    }

    /**
     * Đóng các session còn sót lại khi Caster khởi động lại.
     */
    public function endAllActive(
        string $disconnectReason,
    ): int {
        $sessions = NtripSession::query()
            ->active()
            ->with([
                'mountpoint:id,station_id,name',
                'mountpoint.station:id,device_id,name',
            ])
            ->get();

        $endedCount = 0;

        foreach ($sessions as $session) {
            if (
                $this->endLoadedSession(
                    session: $session,
                    disconnectReason: $disconnectReason,
                )
            ) {
                $endedCount += 1;
            }
        }

        return $endedCount;
    }

    private function endLoadedSession(
        NtripSession $session,
        string $disconnectReason,
    ): bool {
        if ($session->disconnected_at !== null) {
            return false;
        }

        $disconnectedAt = now();

        $session->disconnected_at = $disconnectedAt;
        $session->disconnect_reason =
            $disconnectReason;

        $session->save();

        $this->broadcastAfterCommit(
            new NtripSessionEnded(
                session: $this->fullPayload($session),
                occurredAt: $disconnectedAt->toIso8601String(),
            ),
        );

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function fullPayload(
        NtripSession $session,
    ): array {
        $mountpoint = $session->mountpoint;
        $station = $mountpoint?->station;

        return [
            'id' => $session->id,
            'mountpoint_id' => $session->mountpoint_id,
            'station_id' => $session->station_id,
            'rover_account_id' => $session->rover_account_id,

            'connection_type' => $session->connection_type,

            'authenticated_username' => $session->authenticated_username,

            'client_agent' => $session->client_agent,

            'ntrip_version' => $session->ntrip_version,

            'remote_ip' => $session->remote_ip,

            'connected_at' => $session
                ->connected_at
                ?->toIso8601String(),

            'disconnected_at' => $session
                ->disconnected_at
                ?->toIso8601String(),

            'bytes_transferred' => (int) $session->bytes_transferred,

            'disconnect_reason' => $session->disconnect_reason,

            'valid_rtcm_frames' => (int) $session->valid_rtcm_frames,

            'rtcm_crc_errors' => (int) $session->rtcm_crc_errors,

            'rtcm_message_counts' => $session->rtcm_message_counts ?? [],

            'mountpoint' => $mountpoint === null
                ? null
                : [
                    'id' => $mountpoint->id,
                    'station_id' => $mountpoint->station_id,
                    'name' => $mountpoint->name,

                    'station' => $station === null
                        ? null
                        : [
                            'id' => $station->id,
                            'device_id' => $station->device_id,
                            'name' => $station->name,
                        ],
                ],
        ];
    }

    /**
     * @param  array<array-key, int>  $counts
     * @return array<array-key, int>
     */
    private function normaliseMessageCounts(
        array $counts,
    ): array {
        $normalised = [];

        foreach ($counts as $type => $count) {
            $value = max(
                0,
                (int) $count,
            );

            if ($value === 0) {
                continue;
            }

            $normalised[(string) $type] =
                $value;
        }

        return $normalised;
    }

    /**
     * Không để lỗi Reverb làm dừng NTRIP Caster.
     */
    private function broadcastAfterCommit(
        object $event,
    ): void {
        DB::afterCommit(
            function () use ($event): void {
                try {
                    broadcast($event);
                } catch (Throwable $exception) {
                    report($exception);
                }
            },
        );
    }
}
