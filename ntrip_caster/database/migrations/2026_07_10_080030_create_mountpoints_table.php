<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mountpoints', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('station_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            $table->string('name', 64)->unique();
            $table->string('identifier', 120)->nullable();

            $table->string('format', 32)
                ->default('RTCM 3.2');

            $table->string('format_details', 255)->nullable();

            $table->string('nav_system', 80)
                ->default('GPS+GLO+GAL+BDS');

            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->string('country', 3)->default('VNM');

            $table->boolean('enabled')->default(true);

            $table->string('rover_username', 80)->nullable();
            $table->string('rover_password_hash')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mountpoints');
    }
};
