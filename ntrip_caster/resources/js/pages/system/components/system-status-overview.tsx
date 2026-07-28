import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    AlertTriangle,
    Database,
    RadioTower,
    RefreshCw,
    Server,
    UsersRound,
    Waypoints,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { SystemStatus } from '../lib/system-status';
import {
    formatBytes,
    formatCount,
} from '../lib/rtcm-flow-view';

type SystemStatusOverviewProps = {
    status: SystemStatus | null;
    error: string | null;

    loading: boolean;
    refreshing: boolean;

    onRefresh: () => void | Promise<void>;
};

const dateTimeFormatter =
    new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

export function SystemStatusOverview({
    status,
    error,
    loading,
    refreshing,
    onRefresh,
}: SystemStatusOverviewProps) {
    return (
        <section className="ntrip-section min-w-0 rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">
                            System Status
                        </h2>

                        <SystemHealthBadge
                            available={status !== null}
                            loading={loading}
                        />
                    </div>

                    <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/56">
                        Backend service, Caster listener,
                        Station availability, sessions and
                        cumulative traffic.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    {status !== null ? (
                        <span className="hidden text-right text-micro text-ntrip-ink/46 sm:block">
                            Server time
                            <strong className="ml-1 font-semibold text-ntrip-ink/66">
                                {dateTimeFormatter.format(
                                    status.service.time,
                                )}
                            </strong>
                        </span>
                    ) : null}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={refreshing}
                        onClick={() => {
                            void onRefresh();
                        }}
                        className="h-9 rounded-xl border-white/42 bg-ntrip-cloud/36 shadow-ntrip-inset"
                    >
                        <RefreshCw
                            className={cn(
                                'size-3.5',
                                refreshing &&
                                    'animate-spin',
                            )}
                        />

                        Status
                    </Button>
                </div>
            </header>

            {error !== null ? (
                <div
                    role="alert"
                    className="mt-3 flex items-start gap-3 rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2.5"
                >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ntrip-coral" />

                    <div className="min-w-0">
                        <p className="text-micro font-semibold text-ntrip-coral">
                            System Status unavailable
                        </p>

                        <p className="mt-0.5 text-micro break-words text-ntrip-ink/62">
                            {error}
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <StatusCard
                    label="Backend"
                    icon={Server}
                    loading={loading}
                    tone="healthy"
                    value={
                        status === null
                            ? '—'
                            : 'Online'
                    }
                    description={
                        status?.service.name ??
                        'Waiting for service response'
                    }
                />

                <StatusCard
                    label="Caster listener"
                    icon={RadioTower}
                    loading={loading}
                    value={
                        status === null
                            ? '—'
                            : `${status.caster.host}:${status.caster.port}`
                    }
                    description="NTRIP Source and Rover listener configured by the backend."
                    mono
                />

                <StatusCard
                    label="Stations"
                    icon={Waypoints}
                    loading={loading}
                    value={
                        status === null
                            ? '—'
                            : `${formatCount(status.stations.enabled)} / ${formatCount(status.stations.total)}`
                    }
                    description={
                        status === null
                            ? 'Enabled Stations'
                            : `${formatCount(status.stations.sourceConnected)} Source connected`
                    }
                    tone={
                        status !== null &&
                        status.stations.total > 0 &&
                        status.stations.sourceConnected ===
                            status.stations.enabled
                            ? 'healthy'
                            : 'warning'
                    }
                />

                <StatusCard
                    label="Mountpoints"
                    icon={Database}
                    loading={loading}
                    value={
                        status === null
                            ? '—'
                            : `${formatCount(status.mountpoints.enabled)} / ${formatCount(status.mountpoints.total)}`
                    }
                    description="Enabled Mountpoints compared with the total configured count."
                    tone={
                        status !== null &&
                        status.mountpoints.total > 0 &&
                        status.mountpoints.enabled ===
                            status.mountpoints.total
                            ? 'healthy'
                            : 'warning'
                    }
                />

                <StatusCard
                    label="Live sessions"
                    icon={UsersRound}
                    loading={loading}
                    value={
                        status === null
                            ? '—'
                            : `${formatCount(status.connections.activeSources)} · ${formatCount(status.connections.activeRovers)}`
                    }
                    description="Active Sources · Active Rovers"
                    tone={
                        status !== null &&
                        status.connections.activeSources >
                            0
                            ? 'healthy'
                            : 'neutral'
                    }
                />

                <StatusCard
                    label="Total traffic"
                    icon={Activity}
                    loading={loading}
                    value={
                        status === null
                            ? '—'
                            : formatBytes(
                                  status.traffic
                                      .sourceBytes,
                              )
                    }
                    description={
                        status === null
                            ? 'Source · Rover'
                            : `Source · ${formatBytes(status.traffic.roverBytes)} Rover`
                    }
                />
            </div>

            {status !== null ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ntrip-ink/7 pt-2.5 text-micro text-ntrip-ink/46">
                    <span>
                        Stations total:{' '}
                        <strong className="font-semibold text-ntrip-ink/66">
                            {formatCount(
                                status.stations.total,
                            )}
                        </strong>
                    </span>

                    <span>
                        Mountpoints total:{' '}
                        <strong className="font-semibold text-ntrip-ink/66">
                            {formatCount(
                                status.mountpoints
                                    .total,
                            )}
                        </strong>
                    </span>

                    <span>
                        Source traffic:{' '}
                        <strong className="font-semibold text-ntrip-ink/66">
                            {formatBytes(
                                status.traffic
                                    .sourceBytes,
                            )}
                        </strong>
                    </span>

                    <span>
                        Rover traffic:{' '}
                        <strong className="font-semibold text-ntrip-ink/66">
                            {formatBytes(
                                status.traffic
                                    .roverBytes,
                            )}
                        </strong>
                    </span>
                </div>
            ) : null}
        </section>
    );
}

type StatusCardProps = {
    label: string;
    value: string;
    description: string;

    icon: LucideIcon;

    tone?:
        | 'neutral'
        | 'healthy'
        | 'warning';

    loading?: boolean;
    mono?: boolean;
};

function StatusCard({
    label,
    value,
    description,
    icon: Icon,
    tone = 'neutral',
    loading = false,
    mono = false,
}: StatusCardProps) {
    return (
        <article className="ntrip-card min-w-0 rounded-xl p-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-micro font-semibold tracking-[0.07em] text-ntrip-ink/48 uppercase">
                        {label}
                    </p>

                    {loading ? (
                        <Skeleton className="mt-2 h-6 w-24 rounded-lg bg-ntrip-ink/8" />
                    ) : (
                        <p
                            className={cn(
                                'mt-1 truncate text-base font-semibold tracking-[-0.025em] tabular-nums',
                                mono &&
                                    'font-mono text-caption',
                            )}
                            title={value}
                        >
                            {value}
                        </p>
                    )}
                </div>

                <span
                    className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl bg-ntrip-cloud/58 shadow-ntrip-inset',
                        tone === 'healthy' &&
                            'text-ntrip-teal',
                        tone === 'warning' &&
                            'text-ntrip-amber',
                        tone === 'neutral' &&
                            'text-ntrip-ink/58',
                    )}
                >
                    <Icon
                        className="size-3.5"
                        strokeWidth={1.8}
                    />
                </span>
            </div>

            <p className="mt-2 line-clamp-2 text-micro leading-4 text-ntrip-ink/56">
                {description}
            </p>
        </article>
    );
}

function SystemHealthBadge({
    available,
    loading,
}: {
    available: boolean;
    loading: boolean;
}) {
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ntrip-ink/7 px-2.5 py-1 text-2xs font-semibold text-ntrip-ink/52">
                <RefreshCw className="size-3 animate-spin" />
                Checking
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold',
                available
                    ? 'bg-ntrip-teal/12 text-ntrip-teal'
                    : 'bg-ntrip-coral/10 text-ntrip-coral',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    available
                        ? 'bg-ntrip-teal'
                        : 'bg-ntrip-coral',
                )}
            />

            {available
                ? 'Backend online'
                : 'Unavailable'}
        </span>
    );
}
