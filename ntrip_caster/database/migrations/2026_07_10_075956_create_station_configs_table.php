<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'station_configs',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId('station_id')
                    ->unique()
                    ->constrained()
                    ->cascadeOnDelete();

                $table->unsignedBigInteger('revision')->default(1);

                $table->string('caster_host', 255);
                $table->unsignedSmallInteger('caster_port')
                    ->default(2101);

                $table->unsignedInteger('uart_baud')
                    ->default(115200);

                $table->unsignedInteger('telemetry_interval_ms')
                    ->default(2000);

                $table->unsignedInteger('config_poll_interval_ms')
                    ->default(30000);

                $table->unsignedInteger('max_rtcm_age_ms')
                    ->default(1500);

                $table->timestamps();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('station_configs');
    }
};
