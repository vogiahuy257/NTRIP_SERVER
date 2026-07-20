<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mountpoints', function (Blueprint $table): void {
            $table->dropUnique(
                'mountpoints_station_id_unique'
            );

            $table->index(
                'station_id',
                'mountpoints_station_id_index'
            );

            /*
             * Mountpoint mà firmware của Station sử dụng mặc định.
             * Một Station có thể có nhiều Mountpoint nhưng chỉ một
             * Mountpoint nên được đánh dấu primary.
             */
            $table->boolean('is_primary')
                ->default(false)
                ->after('enabled');

            /*
             * public:
             * Rover không cần tài khoản.
             *
             * authenticated:
             * Rover phải có tài khoản và quyền Mountpoint.
             */
            $table->string('access_mode', 24)
                ->default('authenticated')
                ->after('is_primary');

            /*
             * Null nghĩa là không giới hạn số Rover ở cấp
             * Mountpoint.
             */
            $table->unsignedSmallInteger(
                'max_rover_connections'
            )
                ->nullable()
                ->after('access_mode');

            $table->index(
                ['enabled', 'access_mode'],
                'mountpoints_enabled_access_mode_index'
            );

            $table->index(
                ['station_id', 'is_primary'],
                'mountpoints_station_primary_index'
            );
        });

        /*
         * Database hiện tại đang có đúng một Mountpoint cho mỗi
         * Station, nên toàn bộ Mountpoint cũ trở thành primary.
         */
        DB::table('mountpoints')->update([
            'is_primary' => true,
            'access_mode' => 'public',
        ]);
    }

    public function down(): void
    {
        Schema::table('mountpoints', function (Blueprint $table): void {
            $table->dropIndex(
                'mountpoints_enabled_access_mode_index'
            );

            $table->dropIndex(
                'mountpoints_station_primary_index'
            );

            $table->dropColumn([
                'is_primary',
                'access_mode',
                'max_rover_connections',
            ]);

            $table->dropIndex(
                'mountpoints_station_id_index'
            );

            $table->unique(
                'station_id',
                'mountpoints_station_id_unique'
            );
        });
    }
};
