import { Head } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    AlertTriangle,
    Gauge,
    RadioTower,
    RefreshCw,
    Route,
    UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { BottleneckDiagnosisCard } from './components/bottleneck-diagnosis-card';
import { ObservabilityHelpButton } from './components/observability-help-button';
import { RoverRealtimeDetails } from './components/rover-realtime-details';
import { RtcmFlowSecondaryCharts } from './components/rtcm-flow-secondary-charts';
import { SystemStatusOverview } from './components/system-status-overview';
import { useRtcmFlowObservability } from './hooks/use-rtcm-flow-observability';
import { useSystemStatus } from './hooks/use-system-status';
import type { ObservabilityHelpId } from './lib/observability-help';
import { diagnoseRtcmFlow } from './lib/rtcm-flow-diagnosis';
import {
    formatCount,
    formatDuration,
    formatRatio,
    formatThroughput,
    formatTimeLabel,
} from './lib/rtcm-flow-view';

const throughputChartConfig = {
    source: {
        label: 'Source',
        color: 'var(--chart-1)',
    },
    expected: {
        label: 'Expected',
        color: 'var(--chart-2)',
    },
    queued: {
        label: 'Queued',
        color: 'var(--chart-3)',
    },
    written: {
        label: 'Written',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

type Tone = 'neutral' | 'healthy' | 'warning' | 'critical';

type MetricCardProps = {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    helpId: ObservabilityHelpId;
    tone?: Tone;
    loading?: boolean;
};

const toneTextClasses: Record<Tone, string> = {
    neutral: 'text-ntrip-ink/68',
    healthy: 'text-ntrip-teal',
    warning: 'text-ntrip-amber',
    critical: 'text-ntrip-coral',
};

export default function SystemIndex() {
    const {
        snapshot,
        mountpoints,
        selectedMountpointId,
        setSelectedMountpointId,
        selectedMountpoint,
        rovers,
        historyPoints,
        historyMeta,
        historyWindowMinutes,
        setHistoryWindowMinutes,
        historyResolution,
        setHistoryResolution,
        isInitialLoading,
        isRefreshing,
        isHistoryLoading,
        isRealtimeResyncing,
        snapshotError,
        historyError,
        refresh,
        reloadHistory,
    } = useRtcmFlowObservability();

    const {
        status: systemStatus,
        error: systemStatusError,
        isInitialLoading: isSystemStatusInitialLoading,
        isRefreshing: isSystemStatusRefreshing,
        refresh: refreshSystemStatus,
    } = useSystemStatus();

    const throughputData = useMemo(
        () =>
            historyPoints.map((point) => ({
                time: formatTimeLabel(point.timestamp, historyWindowMinutes),
                source: point.sourceBps,
                expected: point.expectedEgressBps,
                queued: point.queuedEgressBps,
                written: point.writtenEgressBps,
            })),
        [historyPoints, historyWindowMinutes],
    );

    const diagnosis = useMemo(
        () => diagnoseRtcmFlow(snapshot, selectedMountpoint),
        [selectedMountpoint, snapshot],
    );

    const isMetricLoading = isInitialLoading && selectedMountpoint === null;

    const historyDescription =
        historyMeta === null
            ? 'Waiting for historical samples'
            : `${historyMeta.resolution} resolution · ${historyMeta.returnedPointCount} points`;

    const handleRefresh = (): void => {
        void refresh();
        reloadHistory();
        void refreshSystemStatus();
    };

    return (
        <>
            <Head title="System Status & RTCM Observability" />

            <div className="pointer-events-none absolute inset-0 min-h-0 min-w-0 overflow-hidden">
                <section className="ntrip-glass-panel-strong pointer-events-auto flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel">
                    <header className="shrink-0 border-b border-ntrip-ink/8 px-3 py-3 sm:px-4 lg:px-5">
                        <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <p className="text-micro font-semibold text-ntrip-teal">
                                    NTRIP network
                                </p>

                                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                                    <h1 className="min-w-0 truncate text-xl font-semibold tracking-[-0.04em]">
                                        RTCM Flow Observability
                                    </h1>

                                    <ObservabilityHelpButton helpId="page_overview" />
                                </div>

                                <p className="mt-1 max-w-2xl text-micro leading-relaxed text-ntrip-ink/62">
                                    Observe the complete BASE → Caster → Rover
                                    path and locate throughput, fan-out or
                                    socket bottlenecks.
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-5">
                        <div className="grid w-full min-w-0 gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-4">
                            <SystemStatusOverview
                                status={systemStatus}
                                error={systemStatusError}
                                loading={isSystemStatusInitialLoading}
                                refreshing={isSystemStatusRefreshing}
                                onRefresh={refreshSystemStatus}
                            />

                            <section className="ntrip-section grid min-w-0 grid-cols-1 gap-3 rounded-2xl p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.65fr)_minmax(10rem,0.65fr)_auto]">
                                <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2 xl:col-span-4">
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold">
                                            Data controls
                                        </h2>
                                        <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/56">
                                            Select a Mountpoint and the history
                                            window used by all charts.
                                        </p>
                                    </div>

                                    <ObservabilityHelpButton helpId="filters" />
                                </div>

                                <ControlField label="Mountpoint">
                                    <Select
                                        value={
                                            selectedMountpointId === null
                                                ? undefined
                                                : String(selectedMountpointId)
                                        }
                                        onValueChange={(value) => {
                                            const mountpointId = Number(value);

                                            if (
                                                Number.isInteger(
                                                    mountpointId,
                                                ) &&
                                                mountpointId > 0
                                            ) {
                                                setSelectedMountpointId(
                                                    mountpointId,
                                                );
                                            }
                                        }}
                                        disabled={mountpoints.length === 0}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-xl border-white/42 bg-ntrip-cloud/36 shadow-ntrip-inset">
                                            <SelectValue placeholder="No Mountpoint data" />
                                        </SelectTrigger>

                                        <SelectContent className="border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl">
                                            {mountpoints.map((mountpoint) => (
                                                <SelectItem
                                                    key={
                                                        mountpoint.mountpointId
                                                    }
                                                    value={String(
                                                        mountpoint.mountpointId,
                                                    )}
                                                >
                                                    Mountpoint #
                                                    {mountpoint.mountpointId}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </ControlField>

                                <ControlField label="Time range">
                                    <Select
                                        value={String(historyWindowMinutes)}
                                        onValueChange={(value) => {
                                            const minutes = Number(value);

                                            if (
                                                Number.isInteger(minutes) &&
                                                minutes > 0
                                            ) {
                                                setHistoryWindowMinutes(
                                                    minutes,
                                                );
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-xl border-white/42 bg-ntrip-cloud/36 shadow-ntrip-inset">
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent className="border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl">
                                            <SelectItem value="15">
                                                Last 15 minutes
                                            </SelectItem>
                                            <SelectItem value="60">
                                                Last hour
                                            </SelectItem>
                                            <SelectItem value="360">
                                                Last 6 hours
                                            </SelectItem>
                                            <SelectItem value="1440">
                                                Last 24 hours
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </ControlField>

                                <ControlField label="Resolution">
                                    <Select
                                        value={historyResolution}
                                        onValueChange={(value) => {
                                            if (
                                                value === 'auto' ||
                                                value === 'detail' ||
                                                value === 'minute'
                                            ) {
                                                setHistoryResolution(value);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-xl border-white/42 bg-ntrip-cloud/36 shadow-ntrip-inset">
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent className="border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl">
                                            <SelectItem value="auto">
                                                Automatic
                                            </SelectItem>
                                            <SelectItem value="detail">
                                                Detail · 5 seconds
                                            </SelectItem>
                                            <SelectItem value="minute">
                                                Rollup · 1 minute
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </ControlField>

                                <div className="flex items-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 w-full rounded-xl border-white/42 bg-ntrip-cloud/36 px-4 text-ntrip-ink shadow-ntrip-inset hover:bg-ntrip-cloud/62 xl:w-auto"
                                        disabled={
                                            isRefreshing ||
                                            isRealtimeResyncing ||
                                            isSystemStatusRefreshing
                                        }
                                        onClick={handleRefresh}
                                    >
                                        <RefreshCw
                                            className={cn(
                                                'size-4',
                                                (isRefreshing ||
                                                    isRealtimeResyncing ||
                                                    isSystemStatusRefreshing) &&
                                                    'animate-spin',
                                            )}
                                        />
                                        Refresh
                                    </Button>
                                </div>
                            </section>

                            {snapshotError !== null && (
                                <ErrorNotice
                                    title="Snapshot unavailable"
                                    message={snapshotError}
                                />
                            )}

                            {historyError !== null && (
                                <ErrorNotice
                                    title="History unavailable"
                                    message={historyError}
                                />
                            )}

                            <section
                                aria-label="RTCM flow summary"
                                className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                            >
                                <MetricCard
                                    label="Source rate"
                                    value={formatThroughput(
                                        selectedMountpoint?.sourceBps,
                                    )}
                                    description="RTCM input currently received from the BASE station."
                                    icon={RadioTower}
                                    helpId="metric_source_rate"
                                    tone={
                                        selectedMountpoint?.sourceConnected
                                            ? 'healthy'
                                            : 'warning'
                                    }
                                    loading={isMetricLoading}
                                />

                                <MetricCard
                                    label="Active Rovers"
                                    value={formatCount(
                                        selectedMountpoint?.activeRovers,
                                    )}
                                    description="Rover sessions currently consuming this correction stream."
                                    icon={UsersRound}
                                    helpId="metric_active_rovers"
                                    loading={isMetricLoading}
                                />

                                <MetricCard
                                    label="Socket drain"
                                    value={formatRatio(
                                        selectedMountpoint?.socketDrainRatio,
                                    )}
                                    description="Written socket bytes compared with expected fan-out traffic."
                                    icon={Route}
                                    helpId="metric_socket_drain"
                                    tone={
                                        selectedMountpoint?.socketDrainRatio !==
                                            null &&
                                        selectedMountpoint?.socketDrainRatio !==
                                            undefined &&
                                        selectedMountpoint.socketDrainRatio >=
                                            0.98
                                            ? 'healthy'
                                            : 'warning'
                                    }
                                    loading={isMetricLoading}
                                />

                                <MetricCard
                                    label="Oldest buffer"
                                    value={formatDuration(
                                        selectedMountpoint?.maximumBufferAgeMs,
                                    )}
                                    description="Age of the oldest RTCM data waiting in a Rover buffer."
                                    icon={Gauge}
                                    helpId="metric_oldest_buffer"
                                    tone={
                                        selectedMountpoint !== null &&
                                        selectedMountpoint.maximumBufferAgeMs <=
                                            100
                                            ? 'healthy'
                                            : 'warning'
                                    }
                                    loading={isMetricLoading}
                                />
                            </section>

                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.65fr)]">
                                <section className="ntrip-section min-w-0 rounded-2xl p-3 sm:p-4">
                                    <header className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <h2 className="truncate text-sm font-semibold">
                                                    RTCM throughput
                                                </h2>

                                                <ObservabilityHelpButton helpId="chart_throughput" />
                                            </div>

                                            <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/62">
                                                Source input, expected fan-out,
                                                queued output and bytes written
                                                to Rover sockets.
                                            </p>
                                        </div>

                                        <span className="shrink-0 text-micro font-medium text-ntrip-ink/48">
                                            {historyDescription}
                                        </span>
                                    </header>

                                    {isHistoryLoading &&
                                    throughputData.length === 0 ? (
                                        <ChartLoadingState />
                                    ) : throughputData.length === 0 ? (
                                        <EmptyChartState />
                                    ) : (
                                        <ChartContainer
                                            config={throughputChartConfig}
                                            className="mt-3 aspect-auto h-[260px] w-full min-w-0 sm:h-[320px]"
                                        >
                                            <AreaChart
                                                accessibilityLayer
                                                data={throughputData}
                                                margin={{
                                                    top: 8,
                                                    right: 8,
                                                    bottom: 0,
                                                    left: 8,
                                                }}
                                            >
                                                <CartesianGrid
                                                    vertical={false}
                                                    strokeDasharray="3 3"
                                                />

                                                <XAxis
                                                    dataKey="time"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    minTickGap={28}
                                                />

                                                <ChartTooltip
                                                    cursor={false}
                                                    content={
                                                        <ChartTooltipContent
                                                            indicator="line"
                                                            className="border-white/42 bg-ntrip-cloud/92 backdrop-blur-xl"
                                                        />
                                                    }
                                                />

                                                <ChartLegend
                                                    content={
                                                        <ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />
                                                    }
                                                />

                                                <Area
                                                    dataKey="expected"
                                                    type="monotone"
                                                    stroke="var(--color-expected)"
                                                    fill="var(--color-expected)"
                                                    fillOpacity={0.08}
                                                    strokeWidth={1.5}
                                                    isAnimationActive={false}
                                                />

                                                <Area
                                                    dataKey="queued"
                                                    type="monotone"
                                                    stroke="var(--color-queued)"
                                                    fill="var(--color-queued)"
                                                    fillOpacity={0.06}
                                                    strokeWidth={1.5}
                                                    isAnimationActive={false}
                                                />

                                                <Area
                                                    dataKey="written"
                                                    type="monotone"
                                                    stroke="var(--color-written)"
                                                    fill="var(--color-written)"
                                                    fillOpacity={0.08}
                                                    strokeWidth={1.8}
                                                    isAnimationActive={false}
                                                />

                                                <Area
                                                    dataKey="source"
                                                    type="monotone"
                                                    stroke="var(--color-source)"
                                                    fill="var(--color-source)"
                                                    fillOpacity={0.14}
                                                    strokeWidth={2}
                                                    isAnimationActive={false}
                                                />
                                            </AreaChart>
                                        </ChartContainer>
                                    )}
                                </section>

                                <BottleneckDiagnosisCard
                                    diagnosis={diagnosis}
                                />
                            </div>

                            <RtcmFlowSecondaryCharts
                                points={historyPoints}
                                windowMinutes={historyWindowMinutes}
                                loading={isHistoryLoading}
                            />

                            <RoverRealtimeDetails
                                rovers={rovers}
                                intervalMs={snapshot?.intervalMs ?? 1000}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

function ControlField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="grid min-w-0 gap-1.5">
            <span className="text-micro font-semibold tracking-[0.06em] text-ntrip-ink/52 uppercase">
                {label}
            </span>

            {children}
        </label>
    );
}

function MetricCard({
    label,
    value,
    description,
    icon: Icon,
    helpId,
    tone = 'neutral',
    loading = false,
}: MetricCardProps) {
    return (
        <article className="ntrip-card min-w-0 rounded-2xl p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-micro font-semibold tracking-[0.08em] text-ntrip-ink/52 uppercase">
                            {label}
                        </p>

                        <ObservabilityHelpButton helpId={helpId} />
                    </div>

                    {loading ? (
                        <Skeleton className="mt-2 h-6 w-24 rounded-lg bg-ntrip-ink/8" />
                    ) : (
                        <p className="mt-1 truncate text-xl font-semibold tracking-[-0.04em] tabular-nums">
                            {value}
                        </p>
                    )}
                </div>

                <span
                    className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl bg-ntrip-cloud/60 shadow-ntrip-inset',
                        toneTextClasses[tone],
                    )}
                >
                    <Icon className="size-4" strokeWidth={1.8} />
                </span>
            </div>

            <p className="mt-2 line-clamp-2 text-micro leading-relaxed text-ntrip-ink/62">
                {description}
            </p>
        </article>
    );
}

function ErrorNotice({ title, message }: { title: string; message: string }) {
    return (
        <div
            role="alert"
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-ntrip-coral/24 bg-ntrip-coral/8 p-3"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ntrip-coral" />

            <div className="min-w-0">
                <p className="text-micro font-semibold text-ntrip-coral">
                    {title}
                </p>
                <p className="mt-0.5 text-micro break-words text-ntrip-ink/62">
                    {message}
                </p>
            </div>
        </div>
    );
}

function ChartLoadingState() {
    return (
        <div
            aria-busy="true"
            aria-label="Loading RTCM flow history"
            className="mt-3 flex h-[260px] items-end gap-2 overflow-hidden rounded-xl border border-white/36 bg-ntrip-cloud/16 p-4 sm:h-[320px]"
        >
            {[42, 68, 54, 82, 62, 74, 48, 70].map((height, index) => (
                <Skeleton
                    key={`${height}-${index}`}
                    className="min-w-0 flex-1 rounded-t-lg bg-ntrip-ink/7"
                    style={{ height: `${height}%` }}
                />
            ))}
        </div>
    );
}

function EmptyChartState() {
    return (
        <div className="mt-3 grid h-[260px] place-items-center rounded-xl border border-dashed border-ntrip-ink/14 bg-ntrip-cloud/14 p-5 text-center sm:h-[320px]">
            <div>
                <p className="text-sm font-semibold">No historical samples</p>
                <p className="mt-1 max-w-sm text-micro leading-relaxed text-ntrip-ink/52">
                    Start the NTRIP observer and allow several samples to be
                    persisted, then refresh this view.
                </p>
            </div>
        </div>
    );
}
