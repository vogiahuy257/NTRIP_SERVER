<?php

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\DashboardSnapshotController;
use App\Http\Controllers\Api\DeviceProvisioningController;
use App\Http\Controllers\Api\MountpointController;
use App\Http\Controllers\Api\NtripSessionController;
use App\Http\Controllers\Api\PendingDeviceController;
use App\Http\Controllers\Api\RoverAccountController;
use App\Http\Controllers\Api\RoverAccountMountpointController;
use App\Http\Controllers\Api\RtcmFlowHistoryController;
use App\Http\Controllers\Api\RtcmFlowSnapshotController;
use App\Http\Controllers\Api\StationConfigController;
use App\Http\Controllers\Api\StationController;
use App\Http\Controllers\Api\StationTelemetryController;
use App\Http\Controllers\Api\SystemStatusController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/health', function (): JsonResponse {
    return response()->json([
        'success' => true,
        'service' => 'NTRIP Caster Backend',
        'status' => 'running',
        'timestamp' => now()->toIso8601String(),
    ]);
});

Route::prefix('v1')->group(function (): void {

    /*
     * Public endpoint để ESP32 kiểm tra trạng thái
     * và tải cấu hình sau khi được duyệt.
     */
    Route::get(
        'device-provisioning/{hardwareId}',
        DeviceProvisioningController::class,
    )->name('device-provisioning.show');

    // system status
    Route::get(
        '/system/status',
        SystemStatusController::class
    );

    // stations
    Route::get(
        '/stations/{deviceId}/config',
        [StationConfigController::class, 'show']
    );

    Route::put(
        '/stations/{station}/config',
        [StationConfigController::class, 'update']
    );

    Route::post(
        '/stations/{deviceId}/telemetry',
        [StationTelemetryController::class, 'store']
    );

    Route::apiResource(
        'stations',
        StationController::class
    );

    // mountpoints
    Route::get(
        '/mountpoints',
        [MountpointController::class, 'index']
    );

    Route::get(
        '/mountpoints/{mountpoint}',
        [MountpointController::class, 'show']
    );

    Route::put(
        '/mountpoints/{mountpoint}',
        [MountpointController::class, 'update']
    );

    // rover accounts
    Route::middleware(['auth:sanctum', 'verified'])->group(function (): void {

        Route::get(
            'observability/rtcm-flow/snapshot',
            RtcmFlowSnapshotController::class,
        )->name(
            'observability.rtcm-flow.snapshot',
        );
        Route::get(
            'observability/rtcm-flow/history',
            RtcmFlowHistoryController::class,
        )->name(
            'observability.rtcm-flow.history',
        );

        Route::get(
            'pending-devices',
            [PendingDeviceController::class, 'index'],
        )->name('pending-devices.index');

        Route::get(
            'pending-devices/{pendingDevice}',
            [PendingDeviceController::class, 'show'],
        )->name('pending-devices.show');

        Route::post(
            'pending-devices/{pendingDevice}/approve',
            [PendingDeviceController::class, 'approve'],
        )->name('pending-devices.approve');

        Route::post(
            'pending-devices/{pendingDevice}/reject',
            [PendingDeviceController::class, 'reject'],
        )->name('pending-devices.reject');

        Route::get(
            'alerts',
            [
                AlertController::class,
                'index',
            ],
        )->name('alerts.index');

        Route::get(
            'alerts/summary',
            [
                AlertController::class,
                'summary',
            ],
        )->name('alerts.summary');

        Route::post(
            'alerts/{alert}/acknowledge',
            [
                AlertController::class,
                'acknowledge',
            ],
        )->name('alerts.acknowledge');

        Route::get('ntrip/sessions', [NtripSessionController::class, 'index'])->name('ntrip.sessions.index');

        Route::get('ntrip/sessions/active', [NtripSessionController::class, 'active'])->name('ntrip.sessions.active');

        Route::get(
            'dashboard/snapshot',
            DashboardSnapshotController::class,
        )->name('dashboard.snapshot');

        Route::get(
            'rover-accounts/{roverAccount}/mountpoints',
            [
                RoverAccountMountpointController::class,
                'index',
            ]
        )->name(
            'rover-accounts.mountpoints.index'
        );

        Route::put(
            'rover-accounts/{roverAccount}/mountpoints',
            [
                RoverAccountMountpointController::class,
                'update',
            ]
        )->name(
            'rover-accounts.mountpoints.update'
        );

        Route::apiResource(
            'rover-accounts',
            RoverAccountController::class
        )->parameters([
            'rover-accounts' => 'roverAccount',
        ]);
    });

});
