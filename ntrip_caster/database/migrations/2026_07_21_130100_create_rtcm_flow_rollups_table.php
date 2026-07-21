<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'rtcm_flow_rollups',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->foreignId('mountpoint_id')
                    ->constrained()
                    ->cascadeOnDelete();

                /*
                 * Thời điểm bắt đầu bucket một phút.
                 */
                $table->timestampTz(
                    'bucket_started_at',
                );

                $table->unsignedInteger(
                    'sample_count',
                );

                /*
                 * BASE → Caster.
                 */
                $table->decimal(
                    'source_connected_ratio',
                    8,
                    6,
                );

                $table->unsignedBigInteger(
                    'source_bytes_sum',
                );

                $table->unsignedBigInteger(
                    'source_chunks_sum',
                );

                $table->unsignedBigInteger(
                    'source_bps_avg',
                );

                $table->unsignedBigInteger(
                    'source_bps_max',
                );

                $table
                    ->decimal(
                        'source_last_received_age_ms_max',
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
                 * Rover và fan-out.
                 */
                $table->decimal(
                    'active_rovers_avg',
                    12,
                    3,
                );

                $table->unsignedInteger(
                    'active_rovers_max',
                );

                $table->unsignedBigInteger(
                    'expected_egress_bytes_sum',
                );

                $table->unsignedBigInteger(
                    'queued_egress_bytes_sum',
                );

                $table->unsignedBigInteger(
                    'written_egress_bytes_sum',
                );

                $table->unsignedBigInteger(
                    'expected_egress_bps_avg',
                );

                $table->unsignedBigInteger(
                    'expected_egress_bps_max',
                );

                $table->unsignedBigInteger(
                    'queued_egress_bps_avg',
                );

                $table->unsignedBigInteger(
                    'queued_egress_bps_max',
                );

                $table->unsignedBigInteger(
                    'written_egress_bps_avg',
                );

                $table->unsignedBigInteger(
                    'written_egress_bps_max',
                );

                $table
                    ->decimal(
                        'fanout_coverage_avg',
                        8,
                        6,
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'fanout_coverage_min',
                        8,
                        6,
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'socket_drain_ratio_avg',
                        8,
                        6,
                    )
                    ->nullable();

                $table
                    ->decimal(
                        'socket_drain_ratio_min',
                        8,
                        6,
                    )
                    ->nullable();

                /*
                 * Latency.
                 */
                $table->unsignedBigInteger(
                    'fanout_count_sum',
                );

                $table->decimal(
                    'fanout_duration_avg_ms',
                    12,
                    3,
                );

                /*
                 * Đây là p95 lớn nhất trong các mẫu
                 * 5 giây, không tuyên bố là p95 chính
                 * xác của toàn bộ frame trong một phút.
                 */
                $table->decimal(
                    'fanout_duration_p95_worst_ms',
                    12,
                    3,
                );

                $table->decimal(
                    'fanout_duration_max_ms',
                    12,
                    3,
                );

                /*
                 * Buffer và backpressure.
                 */
                $table->unsignedBigInteger(
                    'backlog_bytes_avg',
                );

                $table->unsignedBigInteger(
                    'backlog_bytes_max',
                );

                $table->unsignedBigInteger(
                    'maximum_rover_buffer_bytes',
                );

                $table->decimal(
                    'maximum_buffer_age_ms',
                    12,
                    3,
                );

                $table->unsignedBigInteger(
                    'partial_writes_sum',
                );

                $table->unsignedBigInteger(
                    'zero_writes_sum',
                );

                $table->unsignedBigInteger(
                    'write_failures_sum',
                );

                $table->timestampsTz();

                /*
                 * Bảo đảm chạy maintenance nhiều lần
                 * không tạo bản rollup trùng.
                 */
                $table->unique(
                    [
                        'mountpoint_id',
                        'bucket_started_at',
                    ],
                    'rtcm_flow_rollups_bucket_unique',
                );

                $table->index(
                    'bucket_started_at',
                );
            },
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'rtcm_flow_rollups',
        );
    }
};
