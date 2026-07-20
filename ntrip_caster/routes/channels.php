<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Channel mặc định của Laravel cho từng user.
 */
Broadcast::channel(
    'App.Models.User.{id}',
    function (User $user, int $id): bool {
        return (int) $user->id === $id;
    }
);

/*
 * Channel realtime chung cho toàn bộ NTRIP Dashboard.
 *
 * PrivateChannel yêu cầu người dùng phải đăng nhập.
 * Hiện tại mọi user đã đăng nhập đều được phép truy cập.
 *
 * Sau này khi xây role/permission, chỉ cần thay:
 *
 * return true;
 *
 * bằng:
 *
 * return $user->can('view-ntrip-dashboard');
 */
Broadcast::channel(
    'ntrip.dashboard',
    function (User $user): bool {
        return true;
    }
);

/*
 * Channel chi tiết cho từng station.
 *
 * Dùng cho trang Station Detail hoặc RTCM Live của riêng station.
 */
Broadcast::channel(
    'stations.{deviceId}',
    function (
        User $user,
        string $deviceId,
    ): bool {
        return true;
    }
);
