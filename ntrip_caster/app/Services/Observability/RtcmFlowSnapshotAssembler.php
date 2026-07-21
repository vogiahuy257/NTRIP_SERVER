<?php

namespace App\Services\Observability;

use InvalidArgumentException;
use JsonException;

/**
 * @phpstan-type SnapshotItem array<string, mixed>
 * @phpstan-type Assembly array{
 *     version: int,
 *     sequence: int,
 *     process_id: int|null,
 *     emitted_at_unix_ms: int,
 *     interval_ms: int,
 *     updated_at_unix_ms: int,
 *     mountpoints_parts: int|null,
 *     rovers_parts: int|null,
 *     mountpoints: array<int, list<SnapshotItem>>,
 *     rovers: array<int, list<SnapshotItem>>
 * }
 */
final class RtcmFlowSnapshotAssembler
{
    /** @var array<string, Assembly> */
    private array $assemblies = [];

    public function __construct(
        private readonly int $assemblyTimeoutSeconds,
    ) {
        if ($this->assemblyTimeoutSeconds < 1) {
            throw new InvalidArgumentException(
                'Snapshot assembly timeout must be positive.',
            );
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function push(
        string $payload,
        int $receivedAtUnixMs,
    ): ?array {
        try {
            $decoded = json_decode(
                $payload,
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        $kind = $decoded['kind'] ?? null;

        if (
            $kind !== 'mountpoints'
            && $kind !== 'rovers'
        ) {
            return null;
        }

        $version = $this->integerAtLeast(
            $decoded['version'] ?? null,
            1,
        );

        $sequence = $this->integerAtLeast(
            $decoded['sequence'] ?? null,
            1,
        );

        $emittedAtUnixMs = $this->integerAtLeast(
            $decoded['emitted_at_unix_ms'] ?? null,
            0,
        );

        $intervalMs = $this->integerAtLeast(
            $decoded['interval_ms'] ?? null,
            1,
        );

        $part = $this->integerAtLeast(
            $decoded['part'] ?? null,
            1,
        );

        $parts = $this->integerAtLeast(
            $decoded['parts'] ?? null,
            1,
        );

        $processIdValue =
            $decoded['process_id'] ?? null;

        if (
            $processIdValue !== null
            && ! is_int($processIdValue)
        ) {
            return null;
        }

        $processId = $processIdValue;

        if (
            $version === null
            || $sequence === null
            || $emittedAtUnixMs === null
            || $intervalMs === null
            || $part === null
            || $parts === null
            || $part > $parts
        ) {
            return null;
        }

        $items = $this->normaliseItems(
            $decoded[$kind] ?? null,
        );

        if ($items === null) {
            return null;
        }

        $this->removeExpiredAssemblies(
            $receivedAtUnixMs,
        );

        $key = sprintf(
            '%d:%d:%d',
            $processId ?? 0,
            $sequence,
            $emittedAtUnixMs,
        );

        if (! isset($this->assemblies[$key])) {
            $this->assemblies[$key] = [
                'version' => $version,
                'sequence' => $sequence,
                'process_id' => $processId,
                'emitted_at_unix_ms' => $emittedAtUnixMs,
                'interval_ms' => $intervalMs,
                'updated_at_unix_ms' => $receivedAtUnixMs,

                'mountpoints_parts' => null,
                'rovers_parts' => null,

                'mountpoints' => [],
                'rovers' => [],
            ];
        }

        $assembly = &$this->assemblies[$key];

        if (
            $assembly['version'] !== $version
            || $assembly['sequence'] !== $sequence
            || $assembly['process_id'] !== $processId
            || $assembly['emitted_at_unix_ms']
                !== $emittedAtUnixMs
            || $assembly['interval_ms'] !== $intervalMs
        ) {
            unset($assembly);
            unset($this->assemblies[$key]);

            return null;
        }

        $assembly['updated_at_unix_ms'] =
            $receivedAtUnixMs;

        if ($kind === 'mountpoints') {
            if (
                $assembly['mountpoints_parts'] !== null
                && $assembly['mountpoints_parts']
                    !== $parts
            ) {
                unset($assembly);
                unset($this->assemblies[$key]);

                return null;
            }

            $assembly['mountpoints_parts'] =
                $parts;

            $assembly['mountpoints'][$part] =
                $items;
        } else {
            if (
                $assembly['rovers_parts'] !== null
                && $assembly['rovers_parts']
                    !== $parts
            ) {
                unset($assembly);
                unset($this->assemblies[$key]);

                return null;
            }

            $assembly['rovers_parts'] =
                $parts;

            $assembly['rovers'][$part] =
                $items;
        }

        if (! $this->isComplete($assembly)) {
            unset($assembly);

            return null;
        }

        $mountpoints = $this->mergeParts(
            parts: $assembly['mountpoints'],
            expectedParts: $assembly['mountpoints_parts'],
        );

        $rovers = $this->mergeParts(
            parts: $assembly['rovers'],
            expectedParts: $assembly['rovers_parts'],
        );

        if (
            $mountpoints === null
            || $rovers === null
        ) {
            unset($assembly);
            unset($this->assemblies[$key]);

            return null;
        }

        $snapshot = [
            'version' => $assembly['version'],
            'sequence' => $assembly['sequence'],
            'process_id' => $assembly['process_id'],
            'emitted_at_unix_ms' => $assembly['emitted_at_unix_ms'],
            'interval_ms' => $assembly['interval_ms'],
            'received_at_unix_ms' => $receivedAtUnixMs,

            'mountpoints' => $mountpoints,
            'rovers' => $rovers,
        ];

        unset($assembly);
        unset($this->assemblies[$key]);

        return $snapshot;
    }

    /**
     * @param  Assembly  $assembly
     */
    private function isComplete(
        array $assembly,
    ): bool {
        $mountpointParts =
            $assembly['mountpoints_parts'];

        $roverParts =
            $assembly['rovers_parts'];

        if (
            $mountpointParts === null
            || $roverParts === null
        ) {
            return false;
        }

        return count($assembly['mountpoints'])
                === $mountpointParts
            && count($assembly['rovers'])
                === $roverParts;
    }

    /**
     * @param  array<int, list<array<string, mixed>>>  $parts
     * @return list<array<string, mixed>>|null
     */
    private function mergeParts(
        array $parts,
        ?int $expectedParts,
    ): ?array {
        if ($expectedParts === null) {
            return null;
        }

        $merged = [];

        for (
            $part = 1;
            $part <= $expectedParts;
            $part++
        ) {
            if (! isset($parts[$part])) {
                return null;
            }

            foreach ($parts[$part] as $item) {
                $merged[] = $item;
            }
        }

        return $merged;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function normaliseItems(
        mixed $value,
    ): ?array {
        if (
            ! is_array($value)
            || ! array_is_list($value)
        ) {
            return null;
        }

        $items = [];

        foreach ($value as $item) {
            if (! is_array($item)) {
                return null;
            }

            foreach (
                array_keys($item) as $itemKey
            ) {
                if (! is_string($itemKey)) {
                    return null;
                }
            }

            /** @var array<string, mixed> $item */
            $items[] = $item;
        }

        return $items;
    }

    private function removeExpiredAssemblies(
        int $nowUnixMs,
    ): void {
        $timeoutMs =
            $this->assemblyTimeoutSeconds * 1000;

        foreach (
            $this->assemblies as $key => $assembly
        ) {
            if (
                $nowUnixMs
                    - $assembly['updated_at_unix_ms']
                <= $timeoutMs
            ) {
                continue;
            }

            unset($this->assemblies[$key]);
        }
    }

    private function integerAtLeast(
        mixed $value,
        int $minimum,
    ): ?int {
        if (
            ! is_int($value)
            || $value < $minimum
        ) {
            return null;
        }

        return $value;
    }
}
