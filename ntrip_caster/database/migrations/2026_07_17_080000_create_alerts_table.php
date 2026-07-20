<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'alerts',
            function (Blueprint $table): void {
                $table->id();

                $table
                    ->foreignId('station_id')
                    ->nullable()
                    ->constrained()
                    ->nullOnDelete();

                $table
                    ->foreignId('mountpoint_id')
                    ->nullable()
                    ->constrained()
                    ->nullOnDelete();

                $table
                    ->foreignId('ntrip_session_id')
                    ->nullable()
                    ->constrained('ntrip_sessions')
                    ->nullOnDelete();

                $table->string('type', 64);
                $table->string('severity', 16);
                $table
                    ->string('status', 24)
                    ->default('open');

                /*
                 * Fingerprint xác định cùng một loại lỗi
                 * trên cùng một đối tượng.
                 *
                 * Ví dụ:
                 * source_disconnected:station:3
                 */
                $table->string(
                    'fingerprint',
                    191,
                );

                /*
                 * Chỉ Alert chưa resolve mới giữ active_key.
                 *
                 * unique(active_key) ngăn tạo hai Alert đang
                 * hoạt động có cùng fingerprint.
                 *
                 * Khi resolve, active_key được đặt thành null,
                 * cho phép lỗi tái diễn tạo Alert mới.
                 */
                $table
                    ->string('active_key', 191)
                    ->nullable()
                    ->unique();

                $table->string('title', 160);
                $table->text('message');

                $table
                    ->json('metadata')
                    ->nullable();

                $table
                    ->unsignedInteger(
                        'occurrence_count',
                    )
                    ->default(1);

                $table->timestamp('opened_at');

                $table->timestamp(
                    'last_observed_at',
                );

                $table
                    ->timestamp('acknowledged_at')
                    ->nullable();

                $table
                    ->foreignId(
                        'acknowledged_by_user_id',
                    )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->timestamp('resolved_at')
                    ->nullable();

                $table
                    ->foreignId(
                        'resolved_by_user_id',
                    )
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table
                    ->text('resolution_note')
                    ->nullable();

                $table->timestamps();

                $table->index([
                    'status',
                    'severity',
                ]);

                $table->index([
                    'station_id',
                    'status',
                ]);

                $table->index([
                    'type',
                    'status',
                ]);

                $table->index(
                    'opened_at',
                );
            },
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
