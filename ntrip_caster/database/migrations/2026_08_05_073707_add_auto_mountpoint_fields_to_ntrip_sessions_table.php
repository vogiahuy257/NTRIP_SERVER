<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                /*
                 * AUTO chưa có Base tại thời điểm kết nối,
                 * vì vậy mountpoint_id phải được phép null.
                 *
                 * Sau GGA đầu tiên, mountpoint_id sẽ chứa
                 * Base thật đang được sử dụng.
                 */
                $table->unsignedBigInteger('mountpoint_id')
                    ->nullable()
                    ->change();

                $table->string(
                    'requested_mountpoint',
                    100,
                )
                    ->nullable()
                    ->after('mountpoint_id');

                $table->boolean('auto_mountpoint')
                    ->default(false)
                    ->after('requested_mountpoint');

                $table->unsignedInteger(
                    'mountpoint_switch_count',
                )
                    ->default(0)
                    ->after('auto_mountpoint');

                $table->timestamp(
                    'last_mountpoint_switch_at',
                )
                    ->nullable()
                    ->after('mountpoint_switch_count');
            },
        );
    }

    public function down(): void
    {
        /*
         * Session AUTO chưa được gán Base không thể tồn tại
         * sau khi mountpoint_id trở lại NOT NULL.
         */
        DB::table('ntrip_sessions')
            ->whereNull('mountpoint_id')
            ->delete();

        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                $table->dropColumn([
                    'requested_mountpoint',
                    'auto_mountpoint',
                    'mountpoint_switch_count',
                    'last_mountpoint_switch_at',
                ]);
            },
        );

        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('mountpoint_id')
                    ->nullable(false)
                    ->change();
            },
        );
    }
};
