import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    AlertTriangle,
    Clock3,
    Cpu,
    Database,
    Layers3,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
    formatDecimal,
    formatHealthDescription,
    formatHealthLabel,
    formatLatency,
    formatLatencyDescription,
    formatMemoryDescription,
    formatQueueDescription,
    healthStatusLabel,
    healthStatusTone,
    latencyTone,
    memoryTone,
    queueItemTone,
    queueTone,
    resolveRedisTone,
    sumQueueBacklog,
} from '../lib/redis-runtime-view';
import type { RedisTone } from '../lib/redis-runtime-view';
import { formatCount } from '../lib/rtcm-flow-view';
import type {
    RedisHealthStatus,
    RedisRuntimeStatus,
} from '../lib/system-status';

type RedisRuntimeOverviewProps = {
    redis: RedisRuntimeStatus | null;
    loading: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

const toneClasses: Record<RedisTone, string> = {
    neutral: 'text-ntrip-ink/58',
    healthy: 'text-ntrip-teal',
    warning: 'text-ntrip-amber',
    critical: 'text-ntrip-coral',
};

export function RedisRuntimeOverview({
    redis,
    loading,
}: RedisRuntimeOverviewProps) {
    const tone = resolveRedisTone(redis);
    const queueTotal = redis === null ? 0 : sumQueueBacklog(redis);
    const memoryPercent = redis?.memory.usagePercent ?? null;

    return (
        <section className="ntrip-section min-w-0 rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">Redis Runtime</h2>

                        <RedisHealthBadge
                            status={redis?.status ?? 'unavailable'}
                            loading={loading}
                        />
                    </div>

                    <p className="mt-1 max-w-3xl text-micro leading-relaxed text-ntrip-ink/56">
                        Cache, queue and session runtime health for the Laravel
                        backend. RTCM socket traffic remains independent from
                        Redis.
                    </p>
                </div>

                {redis?.checkedAt !== null && redis?.checkedAt !== undefined ? (
                    <p className="shrink-0 text-micro text-ntrip-ink/46">
                        Checked{' '}
                        <strong className="font-semibold text-ntrip-ink/66">
                            {dateTimeFormatter.format(redis.checkedAt)}
                        </strong>
                    </p>
                ) : null}
            </header>

            {redis !== null && !redis.available ? (
                <div
                    role="alert"
                    className="mt-3 flex items-start gap-3 rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2.5"
                >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ntrip-coral" />

                    <div className="min-w-0">
                        <p className="text-micro font-semibold text-ntrip-coral">
                            Redis is unavailable
                        </p>

                        <p className="mt-0.5 text-micro leading-relaxed break-words text-ntrip-ink/62">
                            {redis.error === 'redis_unavailable'
                                ? 'Laravel cannot reach Redis. Queue writes will use the PostgreSQL fallback connection.'
                                : 'Redis monitoring did not return a healthy runtime snapshot.'}
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <RedisMetricCard
                    label="Redis health"
                    icon={Database}
                    loading={loading}
                    tone={tone}
                    value={formatHealthLabel(redis)}
                    description={formatHealthDescription(redis)}
                />

                <RedisMetricCard
                    label="Memory"
                    icon={Cpu}
                    loading={loading}
                    tone={memoryTone(redis)}
                    value={
                        memoryPercent === null
                            ? '—'
                            : `${formatDecimal(memoryPercent)}%`
                    }
                    description={formatMemoryDescription(redis)}
                    progress={memoryPercent}
                    progressLabel="Redis memory utilization"
                />

                <RedisMetricCard
                    label="Latency"
                    icon={Clock3}
                    loading={loading}
                    tone={latencyTone(redis)}
                    value={formatLatency(redis?.latencyMs ?? null)}
                    description={formatLatencyDescription(redis)}
                />

                <RedisMetricCard
                    label="Queue backlog"
                    icon={Layers3}
                    loading={loading}
                    tone={queueTone(redis)}
                    value={redis === null ? '—' : formatCount(queueTotal)}
                    description={formatQueueDescription(redis)}
                />
            </div>

            {redis !== null ? (
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-2.5 border-t border-ntrip-ink/7 pt-3 xl:grid-cols-2">
                    <RuntimeDetailGroup
                        title="Queue lanes"
                        icon={Activity}
                        items={[
                            {
                                label: 'Realtime',
                                value: formatCount(redis.queues.realtime),
                                tone: queueItemTone(redis.queues.realtime),
                            },
                            {
                                label: 'Alerts',
                                value: formatCount(redis.queues.alerts),
                                tone: queueItemTone(redis.queues.alerts),
                            },
                            {
                                label: 'Default',
                                value: formatCount(redis.queues.default),
                                tone: queueItemTone(redis.queues.default),
                            },
                        ]}
                    />

                    <RuntimeDetailGroup
                        title="Logical databases"
                        icon={Database}
                        items={[
                            {
                                label: 'DB 0 · Default',
                                value: formatCount(redis.databases.default),
                                tone: 'neutral',
                            },
                            {
                                label: 'DB 1 · Cache',
                                value: formatCount(redis.databases.cache),
                                tone: 'neutral',
                            },
                            {
                                label: 'DB 2 · Queue',
                                value: formatCount(redis.databases.queue),
                                tone: 'neutral',
                            },
                            {
                                label: 'DB 3 · Session',
                                value: formatCount(redis.databases.session),
                                tone: 'neutral',
                            },
                        ]}
                    />
                </div>
            ) : null}
        </section>
    );
}

type RedisMetricCardProps = {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    tone: RedisTone;
    loading: boolean;
    progress?: number | null;
    progressLabel?: string;
};

function RedisMetricCard({
    label,
    value,
    description,
    icon: Icon,
    tone,
    loading,
    progress = null,
    progressLabel,
}: RedisMetricCardProps) {
    const normalizedProgress =
        progress === null ? null : Math.min(100, Math.max(0, progress));

    return (
        <article className="ntrip-card min-w-0 rounded-xl p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-micro font-semibold tracking-[0.07em] text-ntrip-ink/48 uppercase">
                        {label}
                    </p>

                    {loading ? (
                        <Skeleton className="mt-2 h-6 w-24 rounded-lg bg-ntrip-ink/8" />
                    ) : (
                        <p
                            className={cn(
                                'mt-1 truncate text-lg font-semibold tracking-[-0.035em] tabular-nums',
                                toneClasses[tone],
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
                        toneClasses[tone],
                    )}
                >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                </span>
            </div>

            {normalizedProgress !== null ? (
                <div className="mt-3">
                    <div
                        role="progressbar"
                        aria-label={progressLabel ?? label}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(normalizedProgress)}
                        className="h-1.5 overflow-hidden rounded-full bg-ntrip-ink/8"
                    >
                        <div
                            className={cn(
                                'h-full rounded-full transition-[width] duration-300',
                                tone === 'healthy' && 'bg-ntrip-teal',
                                tone === 'warning' && 'bg-ntrip-amber',
                                tone === 'critical' && 'bg-ntrip-coral',
                                tone === 'neutral' && 'bg-ntrip-ink/42',
                            )}
                            style={{ width: `${normalizedProgress}%` }}
                        />
                    </div>
                </div>
            ) : null}

            <p className="mt-2 line-clamp-2 text-micro leading-4 text-ntrip-ink/56">
                {description}
            </p>
        </article>
    );
}

type RuntimeDetailItem = {
    label: string;
    value: string;
    tone: RedisTone;
};

type RuntimeDetailGroupProps = {
    title: string;
    icon: LucideIcon;
    items: RuntimeDetailItem[];
};

function RuntimeDetailGroup({
    title,
    icon: Icon,
    items,
}: RuntimeDetailGroupProps) {
    return (
        <div className="ntrip-card min-w-0 rounded-xl p-3">
            <div className="flex items-center gap-2 text-micro font-semibold text-ntrip-ink/66">
                <Icon className="size-3.5 text-ntrip-ink/46" strokeWidth={1.8} />
                {title}
            </div>

            <div className="mt-2.5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className="min-w-0 rounded-lg bg-ntrip-cloud/34 px-2.5 py-2 shadow-ntrip-inset"
                    >
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span
                                className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    item.tone === 'healthy' && 'bg-ntrip-teal',
                                    item.tone === 'warning' && 'bg-ntrip-amber',
                                    item.tone === 'critical' && 'bg-ntrip-coral',
                                    item.tone === 'neutral' && 'bg-ntrip-ink/28',
                                )}
                            />

                            <span className="truncate text-2xs font-medium text-ntrip-ink/48">
                                {item.label}
                            </span>
                        </div>

                        <p className="mt-1 text-sm font-semibold tracking-[-0.02em] tabular-nums">
                            {item.value}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RedisHealthBadge({
    status,
    loading,
}: {
    status: RedisHealthStatus;
    loading: boolean;
}) {
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ntrip-ink/7 px-2.5 py-1 text-2xs font-semibold text-ntrip-ink/52">
                <span className="size-1.5 animate-pulse rounded-full bg-ntrip-ink/36" />
                Checking
            </span>
        );
    }

    const tone = healthStatusTone(status);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold',
                tone === 'healthy' && 'bg-ntrip-teal/12 text-ntrip-teal',
                tone === 'warning' && 'bg-ntrip-amber/12 text-ntrip-amber',
                tone === 'critical' && 'bg-ntrip-coral/10 text-ntrip-coral',
                tone === 'neutral' && 'bg-ntrip-ink/7 text-ntrip-ink/58',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    tone === 'healthy' && 'bg-ntrip-teal',
                    tone === 'warning' && 'bg-ntrip-amber',
                    tone === 'critical' && 'bg-ntrip-coral',
                    tone === 'neutral' && 'bg-ntrip-ink/32',
                )}
            />
            {healthStatusLabel(status)}
        </span>
    );
}
