import type { LucideIcon } from 'lucide-react';
import {
    CircleAlert,
    CircleCheckBig,
    Network,
    TriangleAlert,
} from 'lucide-react';
import { memo, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { RtcmFlowRoverSnapshot } from '../lib/rtcm-flow-types';
import {
    formatBytes,
    formatCount,
    formatDuration,
    formatThroughput,
} from '../lib/rtcm-flow-view';

import { ObservabilityHelpButton } from './observability-help-button';

type RoverHealth = 'healthy' | 'warning' | 'critical';

type RoverRealtimeDetailsProps = {
    rovers: RtcmFlowRoverSnapshot[];
    intervalMs: number;
};

type RoverHealthResult = {
    status: RoverHealth;
    summary: string;
};

const healthLabel: Record<RoverHealth, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
};

const healthTextClass: Record<RoverHealth, string> = {
    healthy: 'text-ntrip-teal',
    warning: 'text-ntrip-amber',
    critical: 'text-ntrip-coral',
};

const healthBackgroundClass: Record<RoverHealth, string> = {
    healthy: 'bg-ntrip-teal/8',
    warning: 'bg-ntrip-amber/10',
    critical: 'bg-ntrip-coral/10',
};

const healthIcon: Record<RoverHealth, LucideIcon> = {
    healthy: CircleCheckBig,
    warning: TriangleAlert,
    critical: CircleAlert,
};

const healthRank: Record<RoverHealth, number> = {
    healthy: 0,
    warning: 1,
    critical: 2,
};

export const RoverRealtimeDetails = memo(function RoverRealtimeDetails({
    rovers,
    intervalMs,
}: RoverRealtimeDetailsProps) {
    const roverItems = useMemo(
        () =>
            rovers
                .map((rover) => ({
                    rover,
                    health: diagnoseRover(rover, intervalMs),
                }))
                .sort((left, right) => {
                    const healthDifference =
                        healthRank[right.health.status] -
                        healthRank[left.health.status];

                    if (healthDifference !== 0) {
                        return healthDifference;
                    }

                    const ageDifference =
                        right.rover.currentBufferAgeMs -
                        left.rover.currentBufferAgeMs;

                    if (ageDifference !== 0) {
                        return ageDifference;
                    }

                    const bufferDifference =
                        right.rover.currentBufferBytes -
                        left.rover.currentBufferBytes;

                    if (bufferDifference !== 0) {
                        return bufferDifference;
                    }

                    return left.rover.sessionId - right.rover.sessionId;
                }),
        [intervalMs, rovers],
    );

    const issueCount = useMemo(
        () =>
            roverItems.filter((item) => item.health.status !== 'healthy')
                .length,
        [roverItems],
    );

    return (
        <section className="ntrip-section min-w-0 rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ntrip-cloud/60 text-ntrip-ink/68 shadow-ntrip-inset">
                        <Network className="size-4" strokeWidth={1.8} />
                    </span>

                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-sm font-semibold">
                                Rover realtime details
                            </h2>

                            <ObservabilityHelpButton helpId="rover_details" />
                        </div>

                        <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/62">
                            Live socket throughput, backlog and write health for
                            every Rover session on the selected Mountpoint.
                        </p>
                    </div>
                </div>

                <div className="flex min-h-9 shrink-0 items-center gap-2 self-start rounded-full border border-white/38 bg-ntrip-cloud/30 px-3">
                    <span className="text-micro font-semibold text-ntrip-ink/68">
                        {formatCount(rovers.length)} active
                    </span>

                    {issueCount > 0 && (
                        <>
                            <span className="size-1 rounded-full bg-ntrip-ink/24" />
                            <span className="text-micro font-semibold text-ntrip-amber">
                                {formatCount(issueCount)} need attention
                            </span>
                        </>
                    )}
                </div>
            </header>

            {roverItems.length === 0 ? (
                <div className="mt-4 grid min-h-40 place-items-center rounded-xl border border-dashed border-ntrip-ink/14 bg-ntrip-cloud/14 p-5 text-center">
                    <div>
                        <p className="text-sm font-semibold">
                            No active Rover sessions
                        </p>
                        <p className="mt-1 max-w-md text-micro leading-relaxed text-ntrip-ink/52">
                            Connect an NTRIP client to the selected Mountpoint
                            to begin monitoring its socket output.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {roverItems.map(({ rover, health }) => (
                        <RoverCard
                            key={rover.sessionId}
                            rover={rover}
                            health={health}
                        />
                    ))}
                </div>
            )}
        </section>
    );
});

function RoverCard({
    rover,
    health,
}: {
    rover: RtcmFlowRoverSnapshot;
    health: RoverHealthResult;
}) {
    const StatusIcon = healthIcon[health.status];

    return (
        <article className="ntrip-card min-w-0 rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-micro font-semibold tracking-[0.07em] text-ntrip-ink/48 uppercase">
                        Rover session
                    </p>
                    <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.025em]">
                        Session #{rover.sessionId}
                    </h3>
                    <p className="mt-1 text-micro text-ntrip-ink/48">
                        Mountpoint #{rover.mountpointId}
                    </p>
                </div>

                <span
                    className={cn(
                        'flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5',
                        healthBackgroundClass[health.status],
                        healthTextClass[health.status],
                    )}
                >
                    <StatusIcon className="size-3.5" strokeWidth={1.9} />
                    <span className="text-micro font-semibold">
                        {healthLabel[health.status]}
                    </span>
                </span>
            </header>

            <p className="mt-3 min-h-8 text-micro leading-relaxed text-ntrip-ink/58">
                {health.summary}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <RoverMetric
                    label="Queued rate"
                    value={formatThroughput(rover.queuedBps)}
                />
                <RoverMetric
                    label="Written rate"
                    value={formatThroughput(rover.writtenBps)}
                    tone={
                        rover.writtenBps < rover.queuedBps
                            ? 'warning'
                            : 'neutral'
                    }
                />
                <RoverMetric
                    label="Current buffer"
                    value={formatBytes(rover.currentBufferBytes)}
                    tone={rover.currentBufferBytes > 0 ? 'warning' : 'neutral'}
                />
                <RoverMetric
                    label="Current age"
                    value={formatDuration(rover.currentBufferAgeMs)}
                    tone={rover.currentBufferAgeMs > 0 ? 'warning' : 'neutral'}
                />
                <RoverMetric
                    label="Maximum buffer"
                    value={formatBytes(rover.maximumBufferBytes)}
                />
                <RoverMetric
                    label="Maximum age"
                    value={formatDuration(rover.maximumBufferAgeMs)}
                />
                <RoverMetric
                    label="Last socket write"
                    value={
                        rover.lastSuccessfulWriteAgeMs === null
                            ? '—'
                            : `${formatDuration(
                                  rover.lastSuccessfulWriteAgeMs,
                              )} ago`
                    }
                    className="col-span-2"
                />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ntrip-ink/8 pt-3">
                <SocketEvent
                    label="Partial"
                    value={rover.partialWritesDelta}
                    warning={rover.partialWritesDelta > 0}
                />
                <SocketEvent
                    label="Zero"
                    value={rover.zeroWritesDelta}
                    warning={rover.zeroWritesDelta > 0}
                />
                <SocketEvent
                    label="Failed"
                    value={rover.writeFailuresDelta}
                    critical={rover.writeFailuresDelta > 0}
                />
            </div>
        </article>
    );
}

function RoverMetric({
    label,
    value,
    tone = 'neutral',
    className,
}: {
    label: string;
    value: string;
    tone?: 'neutral' | 'warning';
    className?: string;
}) {
    return (
        <div
            className={cn(
                'min-w-0 rounded-xl border border-white/34 bg-ntrip-cloud/18 px-3 py-2.5',
                className,
            )}
        >
            <p className="truncate text-[0.65rem] font-medium text-ntrip-ink/48">
                {label}
            </p>
            <p
                className={cn(
                    'mt-1 truncate text-sm font-semibold tabular-nums',
                    tone === 'warning'
                        ? 'text-ntrip-amber'
                        : 'text-ntrip-ink/78',
                )}
            >
                {value}
            </p>
        </div>
    );
}

function SocketEvent({
    label,
    value,
    warning = false,
    critical = false,
}: {
    label: string;
    value: number;
    warning?: boolean;
    critical?: boolean;
}) {
    return (
        <div className="min-w-0 text-center">
            <p className="truncate text-[0.65rem] text-ntrip-ink/44">{label}</p>
            <p
                className={cn(
                    'mt-1 text-sm font-semibold tabular-nums',
                    critical
                        ? 'text-ntrip-coral'
                        : warning
                          ? 'text-ntrip-amber'
                          : 'text-ntrip-ink/68',
                )}
            >
                {formatCount(value)}
            </p>
        </div>
    );
}

function diagnoseRover(
    rover: RtcmFlowRoverSnapshot,
    intervalMs: number,
): RoverHealthResult {
    const effectiveIntervalMs = Math.max(1, intervalMs);
    const warningAgeMs = Math.max(250, effectiveIntervalMs);
    const criticalAgeMs = Math.max(2000, effectiveIntervalMs * 3);
    const staleWriteWarningMs = Math.max(2000, effectiveIntervalMs * 2);
    const staleWriteCriticalMs = Math.max(5000, effectiveIntervalMs * 5);

    if (rover.writeFailuresDelta > 0) {
        return {
            status: 'critical',
            summary: 'The latest interval contains failed socket writes.',
        };
    }

    if (
        rover.lastSuccessfulWriteAgeMs !== null &&
        rover.lastSuccessfulWriteAgeMs >= staleWriteCriticalMs
    ) {
        return {
            status: 'critical',
            summary: 'No successful socket write has occurred recently.',
        };
    }

    if (rover.currentBufferAgeMs >= criticalAgeMs) {
        return {
            status: 'critical',
            summary:
                'RTCM data has remained in this Rover buffer for too long.',
        };
    }

    if (rover.zeroWritesDelta > 0 || rover.currentBufferAgeMs >= warningAgeMs) {
        return {
            status: 'warning',
            summary:
                'The Rover socket is temporarily unable to drain normally.',
        };
    }

    if (
        rover.lastSuccessfulWriteAgeMs !== null &&
        rover.lastSuccessfulWriteAgeMs >= staleWriteWarningMs
    ) {
        return {
            status: 'warning',
            summary: 'Successful socket writes are becoming less frequent.',
        };
    }

    if (
        rover.partialWritesDelta > 0 ||
        rover.currentBufferBytes > 0 ||
        rover.writtenBps < rover.queuedBps
    ) {
        return {
            status: 'warning',
            summary: 'The Rover socket is producing a small output backlog.',
        };
    }

    return {
        status: 'healthy',
        summary: 'RTCM data is being written without a measurable backlog.',
    };
}
