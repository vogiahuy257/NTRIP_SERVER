<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'alert_rule_states',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->foreignId('station_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->string('rule', 64);

                /*
                 * true khi rule đã tạo một Alert
                 * đang active.
                 */
                $table
                    ->boolean('condition_active')
                    ->default(false);

                /*
                 * Thời điểm điều kiện lỗi bắt đầu.
                 * Dùng cho debounce.
                 */
                $table
                    ->timestamp('condition_started_at')
                    ->nullable();

                /*
                 * Thời điểm bắt đầu phục hồi.
                 * Dùng cho recovery delay.
                 */
                $table
                    ->timestamp('recovery_started_at')
                    ->nullable();

                /*
                 * Mẫu gần nhất, ví dụ:
                 * {
                 *   "crc_errors": 12,
                 *   "upload_bps": 5600,
                 *   "age_ms": 120
                 * }
                 */
                $table
                    ->json('last_sample')
                    ->nullable();

                $table
                    ->timestamp('last_evaluated_at')
                    ->nullable();

                $table->timestamps();

                $table->unique([
                    'station_id',
                    'rule',
                ]);

                $table->index([
                    'rule',
                    'condition_active',
                ]);
            },
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'alert_rule_states',
        );
    }
};
