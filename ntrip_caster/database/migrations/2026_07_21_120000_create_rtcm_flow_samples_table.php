<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'rtcm_flow_samples',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->foreignId('mountpoint_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->timestampTz('sampled_at');

                $table->unsignedInteger(
                    'sample_interval_ms',
                );

                /*
                 * BASE → Caster.
                 */
                $table->boolean(
                    'source_connected',
                );

                $table->unsignedBigInteger(
                    'source_bytes_delta',
                );

                $table->unsignedBigInteger(
                    'source_bps',
                );

                $table->unsignedInteger(
                    'source_chunks_delta',
                );

                $table
                    ->decimal(
                        'source_last_received_age_ms',
                        12,
                        3,
                    )
                    ->nullable();

                $table->decimal(
                    'source_gap_max_ms',
                    12,
                    3,
                );

                /*
                 * Caster fan-out.
                 */
                $table->unsignedInteger(
                    'active_rovers',
                );

                $table->unsignedBigInteger(
                    'expected_egress_bytes_delta',
                );

                $table->unsignedBigInteger(
                    'queued_egress_bytes_delta',
                );

                $table->unsignedBigInteger(
                    'written_egress_bytes_delta',
                );

                $table->unsignedBigInteger(
                    'expected_egress_bps',
                );

                $table->unsignedBigInteger(
                    'queued_egress_bps',
                );

                $table->unsignedBigInteger(
                    'written_egress_bps',
                );

                $table
                    ->decimal(
                        'fanout_coverage',
                        8,
                        6,
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'socket_drain_ratio',
                        8,
                        6,
                    )
                    ->nullable();

                /*
                 * Latency và backpressure.
                 */
                $table->decimal(
                    'fanout_duration_avg_ms',
                    12,
                    3,
                );

                $table->decimal(
                    'fanout_duration_p95_ms',
                    12,
                    3,
                );

                $table->decimal(
                    'fanout_duration_max_ms',
                    12,
                    3,
                );

                /*
                 * Tổng RTCM đang tồn trong tất cả
                 * output buffer Rover.
                 */
                $table->unsignedBigInteger(
                    'backlog_bytes',
                );

                /*
                 * Buffer lớn nhất của một Rover
                 * trong cửa sổ lấy mẫu.
                 */
                $table->unsignedBigInteger(
                    'maximum_rover_buffer_bytes',
                );

                $table->decimal(
                    'maximum_buffer_age_ms',
                    12,
                    3,
                );

                $table->unsignedInteger(
                    'partial_writes_delta',
                );

                $table->unsignedInteger(
                    'zero_writes_delta',
                );

                $table->unsignedInteger(
                    'write_failures_delta',
                );

                $table->timestampsTz();

                $table->index([
                    'mountpoint_id',
                    'sampled_at',
                ]);

                $table->index('sampled_at');
            },
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'rtcm_flow_samples',
        );
    }
};
