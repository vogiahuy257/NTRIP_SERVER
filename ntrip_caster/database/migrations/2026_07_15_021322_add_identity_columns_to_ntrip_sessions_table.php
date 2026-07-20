<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                /*
                 * Source session:
                 * station_id != null
                 *
                 * Rover session:
                 * rover_account_id != null
                 */
                $table->foreignId('station_id')
                    ->nullable()
                    ->after('mountpoint_id')
                    ->constrained()
                    ->nullOnDelete();

                $table->foreignId('rover_account_id')
                    ->nullable()
                    ->after('station_id')
                    ->constrained()
                    ->nullOnDelete();

                /*
                 * Snapshot username tại thời điểm xác thực.
                 * Vẫn giữ được lịch sử khi tài khoản đổi username
                 * hoặc bị xóa mềm.
                 */
                $table->string(
                    'authenticated_username',
                    80
                )
                    ->nullable()
                    ->after('connection_type');

                $table->string('client_agent', 255)
                    ->nullable()
                    ->after('authenticated_username');

                $table->string('ntrip_version', 24)
                    ->nullable()
                    ->after('client_agent');

                $table->index(
                    [
                        'mountpoint_id',
                        'connection_type',
                        'disconnected_at',
                    ],
                    'ntrip_sessions_mountpoint_active_index'
                );

                $table->index(
                    [
                        'rover_account_id',
                        'disconnected_at',
                    ],
                    'ntrip_sessions_rover_active_index'
                );

                $table->index(
                    [
                        'station_id',
                        'disconnected_at',
                    ],
                    'ntrip_sessions_station_active_index'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                $table->dropIndex(
                    'ntrip_sessions_mountpoint_active_index'
                );

                $table->dropIndex(
                    'ntrip_sessions_rover_active_index'
                );

                $table->dropIndex(
                    'ntrip_sessions_station_active_index'
                );

                $table->dropConstrainedForeignId(
                    'rover_account_id'
                );

                $table->dropConstrainedForeignId(
                    'station_id'
                );

                $table->dropColumn([
                    'authenticated_username',
                    'client_agent',
                    'ntrip_version',
                ]);
            }
        );
    }
};
