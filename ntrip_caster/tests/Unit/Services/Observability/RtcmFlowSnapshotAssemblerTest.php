<?php

namespace Tests\Unit\Services\Observability;

use App\Services\Observability\RtcmFlowSnapshotAssembler;
use PHPUnit\Framework\TestCase;

final class RtcmFlowSnapshotAssemblerTest extends TestCase
{
    public function test_it_assembles_mountpoint_and_rover_parts(): void
    {
        $assembler =
            new RtcmFlowSnapshotAssembler(
                assemblyTimeoutSeconds: 5,
            );

        $base = [
            'version' => 1,
            'sequence' => 10,
            'process_id' => 500,
            'emitted_at_unix_ms' => 1_000_000,
            'interval_ms' => 1000,
        ];

        self::assertNull(
            $assembler->push(
                json_encode(
                    [
                        ...$base,
                        'kind' => 'mountpoints',
                        'part' => 2,
                        'parts' => 2,
                        'mountpoints' => [
                            [
                                'mountpoint_id' => 2,
                            ],
                        ],
                    ],
                    JSON_THROW_ON_ERROR,
                ),
                1_000_001,
            ),
        );

        self::assertNull(
            $assembler->push(
                json_encode(
                    [
                        ...$base,
                        'kind' => 'rovers',
                        'part' => 1,
                        'parts' => 1,
                        'rovers' => [
                            [
                                'session_id' => 100,
                            ],
                        ],
                    ],
                    JSON_THROW_ON_ERROR,
                ),
                1_000_002,
            ),
        );

        $snapshot = $assembler->push(
            json_encode(
                [
                    ...$base,
                    'kind' => 'mountpoints',
                    'part' => 1,
                    'parts' => 2,
                    'mountpoints' => [
                        [
                            'mountpoint_id' => 1,
                        ],
                    ],
                ],
                JSON_THROW_ON_ERROR,
            ),
            1_000_003,
        );

        self::assertNotNull($snapshot);

        self::assertSame(
            10,
            $snapshot['sequence'],
        );

        self::assertSame(
            [
                ['mountpoint_id' => 1],
                ['mountpoint_id' => 2],
            ],
            $snapshot['mountpoints'],
        );

        self::assertSame(
            [
                ['session_id' => 100],
            ],
            $snapshot['rovers'],
        );
    }

    public function test_it_rejects_invalid_datagrams(): void
    {
        $assembler =
            new RtcmFlowSnapshotAssembler(
                assemblyTimeoutSeconds: 5,
            );

        self::assertNull(
            $assembler->push(
                'not-json',
                1000,
            ),
        );

        self::assertNull(
            $assembler->push(
                json_encode(
                    [
                        'version' => 1,
                        'sequence' => 1,
                        'kind' => 'invalid',
                    ],
                    JSON_THROW_ON_ERROR,
                ),
                1000,
            ),
        );
    }
}
