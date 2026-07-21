<?php

namespace App\Console\Commands;

use App\Contracts\Observability\RtcmFlowDatagramReceiver;
use App\Contracts\Observability\RtcmFlowLatestSnapshotStore;
use App\Events\Observability\RtcmFlowSnapshotUpdated;
use App\Services\Observability\RtcmFlowPersistenceService;
use App\Services\Observability\RtcmFlowRealtimeProjector;
use App\Services\Observability\RtcmFlowSampleAggregator;
use App\Services\Observability\RtcmFlowSnapshotAssembler;
use Illuminate\Console\Command;
use RuntimeException;
use Throwable;

class NtripObserveCommand extends Command
{
    protected $signature =
        'ntrip:observe
        {--debug : Print each assembled RTCM flow snapshot}';

    protected $description =
        'Receive and process NTRIP observability snapshots';

    private bool $shutdownRequested = false;

    private int $assembledSnapshots = 0;

    private int $persistedSamples = 0;

    private int $publishedRealtimeSnapshots = 0;

    private int $lastRealtimeFailureReportedAt = 0;

    public function handle(
        RtcmFlowDatagramReceiver $receiver,
        RtcmFlowSnapshotAssembler $assembler,
        RtcmFlowRealtimeProjector $realtimeProjector,
        RtcmFlowLatestSnapshotStore $latestSnapshotStore,
        RtcmFlowSampleAggregator $sampleAggregator,
        RtcmFlowPersistenceService $persistence,
    ): int {
        if (! extension_loaded('pcntl')) {
            throw new RuntimeException(
                'The PCNTL extension is required to run the NTRIP observability collector.',
            );
        }

        pcntl_async_signals(true);

        pcntl_signal(
            SIGINT,
            function (): void {
                $this->requestShutdown(
                    'SIGINT',
                );
            },
        );

        pcntl_signal(
            SIGTERM,
            function (): void {
                $this->requestShutdown(
                    'SIGTERM',
                );
            },
        );

        $this->info(
            sprintf(
                'NTRIP observability collector listening on udp://%s:%d',
                (string) config(
                    'ntrip.observability.collector.bind_host',
                ),
                (int) config(
                    'ntrip.observability.udp.port',
                ),
            ),
        );

        try {
            while (! $this->shutdownRequested) {
                $payload = $receiver->receive(
                    max(
                        0,
                        (int) config(
                            'ntrip.observability.collector.select_timeout_microseconds',
                        ),
                    ),
                );

                if ($payload === null) {
                    continue;
                }

                $snapshot = $assembler->push(
                    payload: $payload,
                    receivedAtUnixMs: $this->currentUnixMilliseconds(),
                );

                if ($snapshot === null) {
                    continue;
                }

                $this->assembledSnapshots++;

                $realtimeSnapshot =
                    $realtimeProjector->project(
                        $snapshot,
                    );

                if ($realtimeSnapshot !== null) {
                    try {
                        $latestSnapshotStore->put(
                            $realtimeSnapshot,
                        );
                    } catch (Throwable $exception) {
                        $this->reportRealtimeFailure(
                            'Failed to cache latest RTCM flow snapshot',
                            $exception,
                        );
                    }

                    try {
                        RtcmFlowSnapshotUpdated::dispatch(
                            $realtimeSnapshot,
                        );

                        $this->publishedRealtimeSnapshots++;
                    } catch (Throwable $exception) {
                        $this->reportRealtimeFailure(
                            'Failed to broadcast RTCM flow snapshot',
                            $exception,
                        );
                    }
                }

                $samples = $sampleAggregator->push(
                    $snapshot,
                );

                if ($samples !== []) {
                    try {
                        $this->persistedSamples +=
                            $persistence->store(
                                $samples,
                            );
                    } catch (Throwable $exception) {
                        report($exception);

                        $this->warn(
                            sprintf(
                                'Failed to persist RTCM flow samples: %s',
                                $exception->getMessage(),
                            ),
                        );
                    }
                }

                if ((bool) $this->option('debug')) {
                    $this->printSnapshot(
                        $snapshot,
                    );
                }
            }

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);

            $this->error(
                $exception->getMessage(),
            );

            return self::FAILURE;
        } finally {
            $receiver->close();

            $this->line(
                sprintf(
                    'Observability collector stopped after %d assembled snapshots, %d realtime snapshots and %d persisted samples.',
                    $this->assembledSnapshots,
                    $this->publishedRealtimeSnapshots,
                    $this->persistedSamples,
                ),
            );
        }
    }

    private function requestShutdown(
        string $signal,
    ): void {
        if ($this->shutdownRequested) {
            return;
        }

        $this->shutdownRequested = true;

        $this->newLine();

        $this->warn(
            "{$signal} received. Shutting down observability collector...",
        );
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    private function printSnapshot(
        array $snapshot,
    ): void {
        $mountpoints =
            $snapshot['mountpoints'] ?? [];

        $rovers =
            $snapshot['rovers'] ?? [];

        $mountpointCount = is_array($mountpoints)
            ? count($mountpoints)
            : 0;

        $roverCount = is_array($rovers)
            ? count($rovers)
            : 0;

        $sequence = is_int(
            $snapshot['sequence'] ?? null,
        )
            ? $snapshot['sequence']
            : 0;

        $intervalMs = is_int(
            $snapshot['interval_ms'] ?? null,
        )
            ? $snapshot['interval_ms']
            : 0;

        $this->line(
            sprintf(
                '[%s] snapshot=%d interval=%dms mountpoints=%d rovers=%d',
                now()->format(
                    'Y-m-d H:i:s',
                ),
                $sequence,
                $intervalMs,
                $mountpointCount,
                $roverCount,
            ),
        );
    }

    private function reportRealtimeFailure(
        string $context,
        Throwable $exception,
    ): void {
        $now = time();

        /*
        * Reverb hoặc cache lỗi không được làm
        * Collector ngừng nhận UDP.
        */
        if (
            $now
                - $this->lastRealtimeFailureReportedAt
            < 30
        ) {
            return;
        }

        $this->lastRealtimeFailureReportedAt =
            $now;

        report($exception);

        $this->warn(
            sprintf(
                '%s: %s',
                $context,
                $exception->getMessage(),
            ),
        );
    }

    private function currentUnixMilliseconds(): int
    {
        return (int) floor(
            microtime(true) * 1000,
        );
    }
}
