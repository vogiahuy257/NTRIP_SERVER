<?php

namespace App\Services\Devices;

use App\Events\Devices\PendingDeviceDiscovered;
use App\Events\Devices\PendingDeviceUpdated;
use App\Models\PendingDevice;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class PendingDeviceService
{
    public function discover(
        string $hardwareId,
        ?string $reportedDeviceId = null,
        ?string $reportedMountpoint = null,
        ?string $reportedProvisioningState = null,
        ?string $firmwareVersion = null,
        ?string $remoteIp = null,
        ?CarbonInterface $seenAt = null,
    ): PendingDeviceDiscoveryResult {
        $hardwareId = $this->normalizeRequired(
            value: $hardwareId,
            field: 'hardware_id',
            maxLength: 64,
            uppercase: true,
        );

        $reportedDeviceId = $this->normalizeOptional(
            value: $reportedDeviceId,
            field: 'reported_device_id',
            maxLength: 64,
        );

        $reportedMountpoint = $this->normalizeOptional(
            value: $reportedMountpoint,
            field: 'reported_mountpoint',
            maxLength: 64,
        );

        $reportedProvisioningState =
            $this->normalizeOptional(
                value: $reportedProvisioningState,
                field: 'reported_provisioning_state',
                maxLength: 24,
            );

        $firmwareVersion = $this->normalizeOptional(
            value: $firmwareVersion,
            field: 'firmware_version',
            maxLength: 64,
        );

        $remoteIp = $this->normalizeOptional(
            value: $remoteIp,
            field: 'remote_ip',
            maxLength: 45,
        );

        $seenAt ??= now();

        return DB::transaction(
            function () use (
                $hardwareId,
                $reportedDeviceId,
                $reportedMountpoint,
                $reportedProvisioningState,
                $firmwareVersion,
                $remoteIp,
                $seenAt,
            ): PendingDeviceDiscoveryResult {
                $device = PendingDevice::query()
                    ->where(
                        'hardware_id',
                        $hardwareId,
                    )
                    ->lockForUpdate()
                    ->first();

                /*
                 * Thiết bị xuất hiện lần đầu.
                 */
                if ($device === null) {
                    $device = PendingDevice::query()->create([
                        'hardware_id' => $hardwareId,

                        'reported_device_id' => $reportedDeviceId,

                        'reported_mountpoint' => $reportedMountpoint,

                        'reported_provisioning_state' => $reportedProvisioningState
                            ?? 'bootstrap',

                        'firmware_version' => $firmwareVersion,

                        'remote_ip' => $remoteIp,

                        'status' => PendingDevice::STATUS_PENDING,

                        'connection_attempts' => 1,

                        'first_seen_at' => $seenAt,
                        'last_seen_at' => $seenAt,
                    ]);

                    $this->broadcastAfterCommit(
                        device: $device,
                        eventType: 'discovered',
                        occurredAt: $seenAt,
                    );

                    return new PendingDeviceDiscoveryResult(
                        device: $device,
                        discovered: true,
                        changed: true,
                    );
                }

                /*
                 * Không ghi null đè lên thông tin cũ nếu một
                 * request kết nối thiếu một header tùy chọn.
                 */
                $attributes = [
                    'connection_attempts' => (int) $device->connection_attempts + 1,

                    'last_seen_at' => $seenAt,
                ];

                if ($reportedDeviceId !== null) {
                    $attributes['reported_device_id'] =
                        $reportedDeviceId;
                }

                if ($reportedMountpoint !== null) {
                    $attributes['reported_mountpoint'] =
                        $reportedMountpoint;
                }

                if (
                    $reportedProvisioningState !== null
                ) {
                    $attributes[
                        'reported_provisioning_state'
                    ] = $reportedProvisioningState;
                }

                if ($firmwareVersion !== null) {
                    $attributes['firmware_version'] =
                        $firmwareVersion;
                }

                if ($remoteIp !== null) {
                    $attributes['remote_ip'] =
                        $remoteIp;
                }

                $device->fill($attributes);

                /*
                 * Không tính last_seen_at và số lần kết nối
                 * là meaningful change, tránh phát event
                 * device.updated ở mọi lần reconnect.
                 */
                $changed = $device->isDirty([
                    'reported_device_id',
                    'reported_mountpoint',
                    'reported_provisioning_state',
                    'firmware_version',
                    'remote_ip',
                ]);

                /*
                 * Không thay đổi status tại đây.
                 *
                 * rejected vẫn rejected.
                 * approved vẫn approved.
                 * provisioned vẫn provisioned.
                 */
                $device->save();

                if ($changed) {
                    $this->broadcastAfterCommit(
                        device: $device,
                        eventType: 'updated',
                        occurredAt: $seenAt,
                    );
                }

                return new PendingDeviceDiscoveryResult(
                    device: $device,
                    discovered: false,
                    changed: $changed,
                );
            },
        );
    }

    private function normalizeRequired(
        string $value,
        string $field,
        int $maxLength,
        bool $uppercase = false,
    ): string {
        $value = trim($value);

        if ($uppercase) {
            $value = strtoupper($value);
        }

        if ($value === '') {
            throw new InvalidArgumentException(
                "{$field} cannot be empty.",
            );
        }

        if (strlen($value) > $maxLength) {
            throw new InvalidArgumentException(
                "{$field} cannot exceed {$maxLength} characters.",
            );
        }

        return $value;
    }

    private function normalizeOptional(
        ?string $value,
        string $field,
        int $maxLength,
    ): ?string {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (strlen($value) > $maxLength) {
            throw new InvalidArgumentException(
                "{$field} cannot exceed {$maxLength} characters.",
            );
        }

        return $value;
    }

    /**
     * @return array<string, mixed>
     */
    private function realtimePayload(
        PendingDevice $device,
    ): array {
        /*
        * Chuyển model thành dữ liệu đã được Eloquent
        * cast và serialize, đặc biệt là các timestamp.
        *
        * Không đưa source_token_encrypted vào payload.
        */
        $serialized = $device->attributesToArray();

        return [
            'id' => $device->id,

            'hardware_id' => $device->hardware_id,

            'reported_device_id' => $device->reported_device_id,

            'reported_mountpoint' => $device->reported_mountpoint,

            'reported_provisioning_state' => $device->reported_provisioning_state,

            'firmware_version' => $device->firmware_version,

            'remote_ip' => $device->remote_ip,

            'status' => $device->status,

            'connection_attempts' => $device->connection_attempts,

            'station_id' => $device->station_id,

            'first_seen_at' => $serialized['first_seen_at'] ?? null,

            'last_seen_at' => $serialized['last_seen_at'] ?? null,

            'approved_at' => $serialized['approved_at'] ?? null,

            'rejected_at' => $serialized['rejected_at'] ?? null,

            'provisioned_at' => $serialized['provisioned_at'] ?? null,

            'rejection_reason' => $device->rejection_reason,
        ];
    }

    private function broadcastAfterCommit(
        PendingDevice $device,
        string $eventType,
        CarbonInterface $occurredAt,
    ): void {
        /*
        * Chụp payload ngay trong transaction.
        * Callback sau commit không phụ thuộc vào
        * trạng thái model có thể thay đổi tiếp.
        */
        $payload = $this->realtimePayload(
            $device,
        );

        $occurredAtIso =
            $occurredAt->toIso8601String();

        DB::afterCommit(
            static function () use (
                $eventType,
                $payload,
                $occurredAtIso,
            ): void {
                if ($eventType === 'discovered') {
                    PendingDeviceDiscovered::dispatch(
                        device: $payload,
                        occurredAt: $occurredAtIso,
                    );

                    return;
                }

                PendingDeviceUpdated::dispatch(
                    device: $payload,
                    occurredAt: $occurredAtIso,
                );
            },
        );
    }
}
