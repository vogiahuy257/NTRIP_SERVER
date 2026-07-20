<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'ntrip_sessions',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId('mountpoint_id')
                    ->nullable()
                    ->constrained()
                    ->nullOnDelete();

                $table->string('connection_type', 16);

                $table->string('remote_ip', 45)->nullable();

                $table->timestamp('connected_at');
                $table->timestamp('disconnected_at')->nullable();

                $table->unsignedBigInteger('bytes_transferred')
                    ->default(0);

                $table->string('disconnect_reason', 120)->nullable();

                $table->timestamps();

                $table->index([
                    'connection_type',
                    'connected_at',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('ntrip_sessions');
    }
};
