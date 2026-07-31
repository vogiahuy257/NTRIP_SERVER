<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ntrip_sessions', function (Blueprint $table): void {
            $table->decimal('rover_latitude', 10, 7)
                ->nullable();

            $table->decimal('rover_longitude', 10, 7)
                ->nullable();

            $table->decimal('rover_altitude_m', 10, 3)
                ->nullable();

            $table->decimal(
                'rover_geoid_separation_m',
                10,
                3,
            )->nullable();

            $table->unsignedTinyInteger(
                'rover_fix_quality',
            )->nullable();

            $table->string(
                'rover_fix_type',
                24,
            )->nullable();

            $table->unsignedTinyInteger(
                'rover_satellites',
            )->nullable();

            $table->decimal(
                'rover_hdop',
                6,
                2,
            )->nullable();

            /*
             * Thời gian UTC nằm trong chính câu GGA.
             * GGA chỉ chứa giờ, không chứa ngày.
             */
            $table->string(
                'rover_gga_utc',
                16,
            )->nullable();

            /*
             * Thời điểm server nhận câu GGA hợp lệ gần nhất,
             * kể cả câu no-fix.
             */
            $table->timestamp(
                'rover_gga_received_at',
            )->nullable();

            /*
             * Thời điểm server nhận được cặp tọa độ hợp lệ
             * gần nhất. Không bị ghi đè khi Rover báo no-fix.
             */
            $table->timestamp(
                'rover_position_received_at',
            )->nullable();

            /*
             * Tối ưu truy vấn danh sách nhiều Rover đang online.
             */
            $table->index(
                [
                    'connection_type',
                    'disconnected_at',
                    'connected_at',
                ],
                'ntrip_sessions_active_rover_index',
            );
        });
    }

    public function down(): void
    {
        Schema::table('ntrip_sessions', function (Blueprint $table): void {
            $table->dropIndex(
                'ntrip_sessions_active_rover_index',
            );

            $table->dropColumn([
                'rover_latitude',
                'rover_longitude',
                'rover_altitude_m',
                'rover_geoid_separation_m',
                'rover_fix_quality',
                'rover_fix_type',
                'rover_satellites',
                'rover_hdop',
                'rover_gga_utc',
                'rover_gga_received_at',
                'rover_position_received_at',
            ]);
        });
    }
};