<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'rtcm_flow_samples',
            function (Blueprint $table): void {
                /*
                 * Số lần fan-out RTCM trong cửa sổ mẫu.
                 *
                 * Cần để tính average latency có trọng số
                 * khi tổng hợp thành rollup một phút.
                 */
                $table
                    ->unsignedInteger('fanout_count')
                    ->default(0);

                /*
                 * Null:
                 * raw sample chưa được đưa vào rollup.
                 *
                 * Có giá trị:
                 * raw sample đã được tổng hợp thành công.
                 */
                $table
                    ->timestampTz('rolled_up_at')
                    ->nullable();

                $table->index(
                    [
                        'rolled_up_at',
                        'sampled_at',
                    ],
                    'rtcm_flow_samples_rollup_pending_index',
                );
            },
        );
    }

    public function down(): void
    {
        Schema::table(
            'rtcm_flow_samples',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'rtcm_flow_samples_rollup_pending_index',
                );

                $table->dropColumn([
                    'fanout_count',
                    'rolled_up_at',
                ]);
            },
        );
    }
};
