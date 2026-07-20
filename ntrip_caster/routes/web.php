<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->get('/sessions', fn () => Inertia::render('sessions/index'))->name('sessions.index');

Route::middleware(['auth', 'verified'])->get('/rtcm', fn () => Inertia::render('rtcm/index'))->name('rtcm.index');

Route::middleware(['auth', 'verified'])->group(function (): void {

    Route::inertia('/dashboard', 'dashboard/index')->name('dashboard');

    Route::prefix('stations')
        ->name('web.stations.')
        ->group(function (): void {
            Route::inertia('/', 'stations/index')
                ->name('index');

            Route::inertia('/create', 'stations/create')
                ->name('create');

            Route::get('/{station}/edit', function (string $station) {
                return Inertia::render('stations/edit', [
                    'stationId' => $station,
                ]);
            })
                ->whereNumber('station')
                ->name('edit');

            Route::get('/{station}', function (string $station) {
                return Inertia::render('stations/show', [
                    'stationId' => $station,
                ]);
            })
                ->whereNumber('station')
                ->name('show');
        });

    Route::prefix('mountpoints')
        ->name('web.mountpoints.')
        ->group(function (): void {
            Route::inertia('/', 'mountpoints/index')
                ->name('index');
        });
});

require __DIR__.'/settings.php';
