<?php

namespace App\Services\Devices;

use App\Events\Devices\PendingDeviceUpdated;
use App\Models\Mountpoint;
use App\Models\PendingDevice;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class PendingDeviceProvisioningService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function approve(
        PendingDevice $device,
        array $data,
    ): PendingDevice {
        $token = Str::random(64);

        $device = DB::transaction(
            function () use (
                $device,
                $data,
                $token,
            ): PendingDevice {
                $station = $device->station()->create([
                    'device_id' => $data['device_id'],
                    'name' => $data['name'],
                    'enabled' => true,
                    'source_token_hash' => Hash::make($token),
                    'source_connected' => false,
                    'last_ip' => $device->remote_ip,
                    'firmware_version' => $device->firmware_version,
                ]);

                $station->config()->create([
                    'revision' => 1,
                    'caster_host' => $data['caster_host'],
                    'caster_port' => $data['caster_port'],
                    'uart_baud' => $data['uart_baud'],
                    'telemetry_interval_ms' => $data['telemetry_interval_ms'],
                    'config_poll_interval_ms' => $data['config_poll_interval_ms'],
                    'max_rtcm_age_ms' => $data['max_rtcm_age_ms'],
                ]);

                $station->mountpoints()->create([
                    'name' => $data['mountpoint'],
                    'identifier' => $station->name,
                    'enabled' => true,
                    'is_primary' => true,
                    'access_mode' => Mountpoint::ACCESS_PUBLIC,
                ]);

                $device->update([
                    'station_id' => $station->id,
                    'source_token_encrypted' => Crypt::encryptString($token),
                    'status' => PendingDevice::STATUS_APPROVED,
                    'approved_at' => now(),
                    'rejected_at' => null,
                    'rejection_reason' => null,
                ]);

                return $device->fresh([
                    'station.config',
                    'station.mountpoint',
                ]);
            },
        );

        PendingDeviceUpdated::dispatch(
            device: $device->toArray(),
            occurredAt: now()->toIso8601String(),
        );

        return $device;
    }

    public function reject(
        PendingDevice $device,
        ?string $reason,
    ): PendingDevice {
        $device->update([
            'status' => PendingDevice::STATUS_REJECTED,
            'rejected_at' => now(),
            'rejection_reason' => $reason,
        ]);

        $device = $device->fresh();

        PendingDeviceUpdated::dispatch(
            device: $device->toArray(),
            occurredAt: now()->toIso8601String(),
        );

        return $device;
    }

    public function markProvisioned(
        ?int $pendingDeviceId,
        int $stationId,
    ): ?PendingDevice {
        if ($pendingDeviceId === null) {
            return null;
        }

        return DB::transaction(
            function () use (
                $pendingDeviceId,
                $stationId,
            ): ?PendingDevice {
                $device = PendingDevice::query()
                    ->whereKey($pendingDeviceId)
                    ->where('station_id', $stationId)
                    ->lockForUpdate()
                    ->first();

                if (
                    $device === null
                    || $device->isPending()
                    || $device->isRejected()
                ) {
                    return $device;
                }

                /*
                * Source reconnect nhiều lần không được
                * phát event provisioned lặp lại.
                */
                if ($device->isProvisioned()) {
                    return $device;
                }

                $device->update([
                    'status' => PendingDevice::STATUS_PROVISIONED,

                    'reported_provisioning_state' => 'provisioned',

                    'provisioned_at' => now(),
                ]);

                $device = $device->fresh();

                if ($device === null) {
                    return null;
                }

                $payload = $device->toArray();
                $occurredAt = now()->toIso8601String();

                DB::afterCommit(
                    static function () use (
                        $payload,
                        $occurredAt,
                    ): void {
                        PendingDeviceUpdated::dispatch(
                            device: $payload,
                            occurredAt: $occurredAt,
                        );
                    },
                );

                return $device;
            },
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(
        PendingDevice $device,
    ): array {
        $device->loadMissing([
            'station.config',
            'station.mountpoint',
        ]);

        $station = $device->station;
        $config = $station?->config;
        $mountpoint = $station?->mountpoint;

        abort_if(
            $station === null
            || $config === null
            || $mountpoint === null
            || $device->source_token_encrypted === null,
            409,
            'Provisioning configuration is incomplete.',
        );

        return [
            'device_id' => $station->device_id,
            'mountpoint' => $mountpoint->name,

            'source_token' => Crypt::decryptString(
                $device->source_token_encrypted,
            ),

            'caster_host' => $config->caster_host,
            'caster_port' => $config->caster_port,

            'management_port' => config('ntrip.management_port'),

            'uart_baud' => $config->uart_baud,

            'telemetry_interval_ms' => $config->telemetry_interval_ms,

            'config_poll_interval_ms' => $config->config_poll_interval_ms,

            'max_rtcm_age_ms' => $config->max_rtcm_age_ms,

            'revision' => $config->revision,
        ];
    }
}
