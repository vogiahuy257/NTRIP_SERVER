<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'pending_devices',
            function (Blueprint $table): void {
                $table->id();

                /*
                 * Định danh vật lý cố định lấy từ MAC/eFuse.
                 * Đây là khóa dùng để chống tạo thiết bị trùng.
                 */
                $table->string(
                    'hardware_id',
                    64
                )->unique();

                /*
                 * Giá trị bootstrap mà ESP32 đang báo lên
                 * trước khi được server provision.
                 */
                $table->string(
                    'reported_device_id',
                    64
                )->nullable();

                $table->string(
                    'reported_mountpoint',
                    64
                )->nullable();

                $table->string(
                    'reported_provisioning_state',
                    24
                )->default('bootstrap');

                $table->string(
                    'firmware_version',
                    64
                )->nullable();

                $table->string(
                    'remote_ip',
                    45
                )->nullable();

                /*
                 * Lifecycle phía backend:
                 *
                 * pending
                 * approved
                 * rejected
                 * provisioned
                 */
                $table->string(
                    'status',
                    24
                )->default('pending');

                $table->unsignedInteger(
                    'connection_attempts'
                )->default(1);

                $table->timestamp(
                    'first_seen_at'
                );

                $table->timestamp(
                    'last_seen_at'
                );

                /*
                 * Sau khi approve, pending device được liên kết
                 * với Station do backend tự tạo.
                 */
                $table->foreignId(
                    'station_id'
                )
                    ->nullable()
                    ->unique()
                    ->constrained()
                    ->nullOnDelete();

                /*
                 * Source token cần được trả cho ESP32 trong lần
                 * provisioning. Service sau sẽ mã hóa giá trị này.
                 */
                $table->text(
                    'source_token_encrypted'
                )->nullable();

                $table->timestamp(
                    'approved_at'
                )->nullable();

                $table->timestamp(
                    'rejected_at'
                )->nullable();

                $table->timestamp(
                    'provisioned_at'
                )->nullable();

                $table->text(
                    'rejection_reason'
                )->nullable();

                $table->timestamps();

                $table->index(
                    ['status', 'last_seen_at'],
                    'pending_devices_status_seen_index'
                );

                $table->index(
                    'reported_device_id',
                    'pending_devices_reported_device_index'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'pending_devices'
        );
    }
};
