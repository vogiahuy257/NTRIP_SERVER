<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'station_telemetries',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId('station_id')
                    ->unique()
                    ->constrained()
                    ->cascadeOnDelete();

                $table->json('payload');
                $table->timestamp('received_at');

                $table->timestamps();
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('station_telemetries');
    }
};
