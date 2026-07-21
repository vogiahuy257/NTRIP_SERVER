<?php

namespace App\Services\Ntrip\Devices;

use InvalidArgumentException;

final class SourceDeviceIdentityParser
{
    private const HEADER_HARDWARE_ID =
        'x-hardware-id';

    private const HEADER_DEVICE_ID =
        'x-device-id';

    private const HEADER_MOUNTPOINT =
        'x-mountpoint';

    private const HEADER_FIRMWARE_VERSION =
        'x-firmware-version';

    private const HEADER_PROVISIONING_STATE =
        'x-provisioning-state';

    /**
     * @param  array<string, string>  $headers
     */
    public function supports(
        array $headers,
    ): bool {
        $headers = $this->normalizeHeaders(
            $headers,
        );

        /*
        * Chỉ kiểm tra header có xuất hiện hay không.
        * Giá trị rỗng hoặc sai sẽ được parse() từ chối.
        */
        return array_key_exists(
            self::HEADER_HARDWARE_ID,
            $headers,
        );
    }

    /**
     * @param  array<string, string>  $headers
     */
    public function parse(
        array $headers,
        ?string $requestMountpoint = null,
    ): SourceDeviceIdentity {
        $headers = $this->normalizeHeaders(
            $headers,
        );

        $hardwareId = $this->requiredValue(
            value: $headers[self::HEADER_HARDWARE_ID]
                    ?? null,
            field: 'X-Hardware-ID',
            maxLength: 64,
            uppercase: true,
        );

        $deviceId = $this->optionalValue(
            value: $headers[self::HEADER_DEVICE_ID]
                    ?? null,
            field: 'X-Device-ID',
            maxLength: 64,
        );

        $reportedMountpoint =
            $this->normalizeMountpoint(
                $headers[self::HEADER_MOUNTPOINT]
                    ?? null,
            );

        $requestMountpoint =
            $this->normalizeMountpoint(
                $requestMountpoint,
            );

        /*
         * Header do ESP32 báo lên được ưu tiên.
         * Nếu firmware cũ chưa gửi header này thì
         * dùng mountpoint từ request path.
         */
        $mountpoint =
            $reportedMountpoint
            ?? $requestMountpoint;

        $firmwareVersion =
            $this->optionalValue(
                value: $headers[
                        self::HEADER_FIRMWARE_VERSION
                    ] ?? null,
                field: 'X-Firmware-Version',
                maxLength: 64,
            );

        $provisioningState = strtolower(
            $this->optionalValue(
                value: $headers[
                        self::HEADER_PROVISIONING_STATE
                    ] ?? null,
                field: 'X-Provisioning-State',
                maxLength: 24,
            ) ?? 'bootstrap',
        );

        if (
            ! in_array(
                $provisioningState,
                [
                    'bootstrap',
                    'provisioned',
                ],
                true,
            )
        ) {
            throw new InvalidArgumentException(
                'X-Provisioning-State must be bootstrap or provisioned.',
            );
        }

        return new SourceDeviceIdentity(
            hardwareId: $hardwareId,
            deviceId: $deviceId,
            mountpoint: $mountpoint,
            firmwareVersion: $firmwareVersion,
            provisioningState: $provisioningState,
        );
    }

    /**
     * Header HTTP không phân biệt chữ hoa và chữ thường.
     *
     * @param  array<string, string>  $headers
     * @return array<string, string>
     */
    private function normalizeHeaders(
        array $headers,
    ): array {
        $normalized = [];

        foreach ($headers as $name => $value) {
            $normalized[strtolower(trim($name))] =
                trim($value);
        }

        return $normalized;
    }

    private function requiredValue(
        ?string $value,
        string $field,
        int $maxLength,
        bool $uppercase = false,
    ): string {
        $value = $this->optionalValue(
            value: $value,
            field: $field,
            maxLength: $maxLength,
        );

        if ($value === null) {
            throw new InvalidArgumentException(
                "{$field} is required.",
            );
        }

        if ($uppercase) {
            $value = strtoupper($value);
        }

        return $value;
    }

    private function optionalValue(
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

        /*
         * Không chấp nhận CR/LF trong giá trị header.
         */
        if (
            str_contains($value, "\r")
            || str_contains($value, "\n")
        ) {
            throw new InvalidArgumentException(
                "{$field} contains invalid characters.",
            );
        }

        if (strlen($value) > $maxLength) {
            throw new InvalidArgumentException(
                "{$field} cannot exceed {$maxLength} characters.",
            );
        }

        return $value;
    }

    private function normalizeMountpoint(
        ?string $mountpoint,
    ): ?string {
        $mountpoint = $this->optionalValue(
            value: $mountpoint,
            field: 'mountpoint',
            maxLength: 64,
        );

        if ($mountpoint === null) {
            return null;
        }

        /*
         * Request path có thể là /BASE-001.
         * Trong database chỉ lưu BASE-001.
         */
        $mountpoint = ltrim(
            $mountpoint,
            '/',
        );

        return $mountpoint !== ''
            ? $mountpoint
            : null;
    }
}
