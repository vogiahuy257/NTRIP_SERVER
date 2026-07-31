<?php

namespace App\Providers;

use App\Contracts\Observability\RtcmFlowDatagramReceiver;
use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;
use App\Contracts\Observability\RtcmFlowMetricsSink;
use App\Contracts\Observability\RtcmFlowSnapshotTransport;
use App\Services\Observability\CacheRtcmFlowLatestSnapshotStore;
use App\Services\Observability\NullRtcmFlowMetricsSink;
use App\Services\Observability\RtcmFlowHistoryService;
use App\Services\Observability\RtcmFlowProbe;
use App\Services\Observability\RtcmFlowRetentionService;
use App\Services\Observability\RtcmFlowRollupCalculator;
use App\Services\Observability\RtcmFlowRollupService;
use App\Services\Observability\RtcmFlowSampleAggregator;
use App\Services\Observability\RtcmFlowSnapshotAssembler;
use App\Services\Observability\UdpRtcmFlowDatagramReceiver;
use App\Services\Observability\UdpRtcmFlowSnapshotTransport;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Queue\Events\QueueFailedOver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use InvalidArgumentException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(
            RtcmFlowSnapshotTransport::class,
            function (): RtcmFlowSnapshotTransport {
                return new UdpRtcmFlowSnapshotTransport(
                    host: (string) config(
                        'ntrip.observability.udp.host',
                    ),

                    port: (int) config(
                        'ntrip.observability.udp.port',
                    ),

                    maxPacketBytes: (int) config(
                        'ntrip.observability.udp.max_packet_bytes',
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowMetricsSink::class,
            function ($app): RtcmFlowMetricsSink {
                if (
                    ! (bool) config(
                        'ntrip.observability.enabled',
                    )
                ) {
                    return new NullRtcmFlowMetricsSink;
                }

                $driver = (string) config(
                    'ntrip.observability.driver',
                );

                if ($driver !== 'udp') {
                    throw new InvalidArgumentException(
                        "Unsupported NTRIP observability driver: {$driver}",
                    );
                }

                return new RtcmFlowProbe(
                    transport: $app->make(
                        RtcmFlowSnapshotTransport::class,
                    ),

                    snapshotIntervalMs: (int) config(
                        'ntrip.observability.snapshot_interval_ms',
                    ),

                    mountpointsPerPacket: (int) config(
                        'ntrip.observability.mountpoints_per_packet',
                    ),

                    roversPerPacket: (int) config(
                        'ntrip.observability.rovers_per_packet',
                    ),

                    maxLatencySamplesPerInterval: (int) config(
                        'ntrip.observability.max_latency_samples_per_interval',
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowDatagramReceiver::class,
            function (): RtcmFlowDatagramReceiver {
                return new UdpRtcmFlowDatagramReceiver(
                    host: (string) config(
                        'ntrip.observability.collector.bind_host',
                    ),

                    port: (int) config(
                        'ntrip.observability.udp.port',
                    ),

                    receiveBufferBytes: (int) config(
                        'ntrip.observability.collector.receive_buffer_bytes',
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowSnapshotAssembler::class,
            function (): RtcmFlowSnapshotAssembler {
                return new RtcmFlowSnapshotAssembler(
                    assemblyTimeoutSeconds: (int) config(
                        'ntrip.observability.collector.assembly_timeout_seconds',
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowSampleAggregator::class,
            function (): RtcmFlowSampleAggregator {
                return new RtcmFlowSampleAggregator(
                    sampleIntervalSeconds: max(
                        1,
                        (int) config(
                            'ntrip.observability.database_sample_seconds',
                        ),
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowRollupService::class,
            function (
                Application $app,
            ): RtcmFlowRollupService {
                return new RtcmFlowRollupService(
                    calculator: $app->make(
                        RtcmFlowRollupCalculator::class,
                    ),

                    rollupDelaySeconds: max(
                        0,
                        (int) config(
                            'ntrip.observability.maintenance.rollup_delay_seconds',
                        ),
                    ),

                    maxBucketsPerRun: max(
                        1,
                        (int) config(
                            'ntrip.observability.maintenance.max_buckets_per_run',
                        ),
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowRetentionService::class,
            function (): RtcmFlowRetentionService {
                return new RtcmFlowRetentionService(
                    detailRetentionHours: max(
                        1,
                        (int) config(
                            'ntrip.observability.detail_retention_hours',
                        ),
                    ),

                    rollupRetentionDays: max(
                        1,
                        (int) config(
                            'ntrip.observability.rollup_retention_days',
                        ),
                    ),

                    deleteBatchSize: max(
                        1,
                        (int) config(
                            'ntrip.observability.maintenance.delete_batch_size',
                        ),
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowLatestSnapshotStore::class,
            function (): RtcmFlowLatestSnapshotStore {
                return new CacheRtcmFlowLatestSnapshotStore(
                    cache: Cache::store(
                        (string) config(
                            'ntrip.observability.latest_snapshot.cache_store',
                            'file',
                        ),
                    ),

                    ttlSeconds: max(
                        1,
                        (int) config(
                            'ntrip.observability.latest_snapshot.ttl_seconds',
                            10,
                        ),
                    ),
                );
            },
        );

        $this->app->singleton(
            RtcmFlowHistoryService::class,
            function (): RtcmFlowHistoryService {
                return new RtcmFlowHistoryService(
                    detailRetentionHours: max(
                        1,
                        (int) config(
                            'ntrip.observability.detail_retention_hours',
                            24,
                        ),
                    ),

                    rollupRetentionDays: max(
                        1,
                        (int) config(
                            'ntrip.observability.rollup_retention_days',
                            30,
                        ),
                    ),

                    autoDetailMaxMinutes: max(
                        1,
                        (int) config(
                            'ntrip.observability.history.auto_detail_max_minutes',
                            120,
                        ),
                    ),
                );
            },
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureQueueMonitoring();
    }

    /**
     * Register queue backlog and failover monitoring.
     */
    protected function configureQueueMonitoring(): void
    {
        Event::listen(
            QueueBusy::class,
            function (QueueBusy $event): void {
                Log::warning(
                    'Queue backlog threshold exceeded.',
                    [
                        'connection' => $event->connectionName,
                        'queue' => $event->queue,
                        'size' => $event->size,
                        'threshold' => 100,
                    ],
                );
            },
        );

        Event::listen(
            QueueFailedOver::class,
            function (QueueFailedOver $event): void {
                $command = match (true) {
                    is_object($event->command) => $event->command::class,

                    is_string($event->command) => $event->command,

                    default => get_debug_type(
                        $event->command,
                    ),
                };

                Log::error(
                    'Queue connection failed over.',
                    [
                        'failed_connection' => $event->connectionName,

                        'command' => $command,

                        'exception' => $event->exception::class,

                        'message' => $event->exception->getMessage(),
                    ],
                );
            },
        );
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
