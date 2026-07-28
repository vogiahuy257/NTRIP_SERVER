<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rover_accounts', function (Blueprint $table): void {
            $table->id();

            $table->string('username', 80)
                ->unique();

            $table->string('display_name', 120)
                ->nullable();

            $table->string('password_hash');

            $table->boolean('enabled')
                ->default(true);

            $table->unsignedSmallInteger('max_connections')
                ->default(1);

            $table->timestamp('expires_at')
                ->nullable();

            $table->timestamp('last_authenticated_at')
                ->nullable();

            $table->text('notes')
                ->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(
                ['enabled', 'expires_at'],
                'rover_accounts_enabled_expires_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rover_accounts');
    }
};
