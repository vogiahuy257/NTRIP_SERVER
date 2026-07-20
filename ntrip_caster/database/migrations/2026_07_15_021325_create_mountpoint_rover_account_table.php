<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'mountpoint_rover_account',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId('mountpoint_id')
                    ->constrained('mountpoints')
                    ->cascadeOnDelete();

                $table->foreignId('rover_account_id')
                    ->constrained('rover_accounts')
                    ->cascadeOnDelete();

                $table->boolean('enabled')
                    ->default(true);

                $table->unsignedSmallInteger('max_connections')
                    ->nullable();

                $table->timestamp('starts_at')
                    ->nullable();

                $table->timestamp('expires_at')
                    ->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    [
                        'mountpoint_id',
                        'rover_account_id',
                    ],
                    'mountpoint_rover_account_unique'
                );

                $table->index(
                    [
                        'mountpoint_id',
                        'enabled',
                    ],
                    'mountpoint_rover_enabled_index'
                );

                $table->index(
                    [
                        'rover_account_id',
                        'enabled',
                    ],
                    'rover_account_mountpoint_enabled_index'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'mountpoint_rover_account'
        );
    }
};
