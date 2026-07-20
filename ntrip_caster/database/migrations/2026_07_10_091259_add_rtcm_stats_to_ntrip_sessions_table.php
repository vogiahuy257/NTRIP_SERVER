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
                $table->unsignedBigInteger(
                    'valid_rtcm_frames'
                )->default(0);

                $table->unsignedBigInteger(
                    'rtcm_crc_errors'
                )->default(0);

                $table->json(
                    'rtcm_message_counts'
                )->nullable();
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'ntrip_sessions',
            function (Blueprint $table): void {
                $table->dropColumn([
                    'valid_rtcm_frames',
                    'rtcm_crc_errors',
                    'rtcm_message_counts',
                ]);
            }
        );
    }
};
