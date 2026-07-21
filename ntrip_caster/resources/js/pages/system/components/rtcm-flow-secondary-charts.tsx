import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    XAxis,
    YAxis,
} from 'recharts';

import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

import type { ObservabilityHelpId } from '../lib/observability-help';
import type { RtcmFlowHistoryPoint } from '../lib/rtcm-flow-types';
import { formatTimeLabel } from '../lib/rtcm-flow-view';

import { ObservabilityHelpButton } from './observability-help-button';

const coverageConfig = {
    coverage: {
        label: 'Fan-out coverage',
        color: 'var(--chart-1)',
    },
    drain: {
        label: 'Socket drain',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

const latencyConfig = {
    average: {
        label: 'Average',
        color: 'var(--chart-1)',
    },
    p95: {
        label: 'P95',
        color: 'var(--chart-2)',
    },
    maximum: {
        label: 'Maximum',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

const backlogConfig = {
    backlog: {
        label: 'Backlog bytes',
        color: 'var(--chart-2)',
    },
    bufferAge: {
        label: 'Buffer age',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

const writeEventsConfig = {
    partial: {
        label: 'Partial writes',
        color: 'var(--chart-2)',
    },
    zero: {
        label: 'Zero writes',
        color: 'var(--chart-3)',
    },
    failures: {
        label: 'Write failures',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

type SecondaryChartsProps = {
    points: RtcmFlowHistoryPoint[];
    windowMinutes: number;
    loading: boolean;
};

export const RtcmFlowSecondaryCharts = memo(function RtcmFlowSecondaryCharts({
    points,
    windowMinutes,
    loading,
}: SecondaryChartsProps) {
    return (
        <section className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            <CoverageDrainChart
                points={points}
                windowMinutes={windowMinutes}
                loading={loading}
            />

            <FanoutLatencyChart
                points={points}
                windowMinutes={windowMinutes}
                loading={loading}
            />

            <BacklogBufferChart
                points={points}
                windowMinutes={windowMinutes}
                loading={loading}
            />

            <SocketWriteEventsChart
                points={points}
                windowMinutes={windowMinutes}
                loading={loading}
            />
        </section>
    );
});

function CoverageDrainChart({
    points,
    windowMinutes,
    loading,
}: SecondaryChartsProps) {
    const data = useMemo(
        () =>
            points.map((point) => ({
                time: formatTimeLabel(point.timestamp, windowMinutes),
                coverage:
                    point.fanoutCoverage === null
                        ? null
                        : point.fanoutCoverage * 100,
                drain:
                    point.socketDrainRatio === null
                        ? null
                        : point.socketDrainRatio * 100,
            })),
        [points, windowMinutes],
    );

    const hasData = data.some(
        (point) => point.coverage !== null || point.drain !== null,
    );

    return (
        <ChartPanel
            title="Coverage and drain"
            description="Queued and written traffic compared with expected Rover fan-out."
            helpId="chart_coverage_drain"
            loading={loading}
            hasData={hasData}
        >
            <ChartContainer
                config={coverageConfig}
                className="aspect-auto h-[240px] w-full min-w-0 sm:h-[280px]"
            >
                <LineChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                    />
                    <YAxis
                        width={42}
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: number) => `${value}%`}
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
                    <Line
                        dataKey="coverage"
                        type="monotone"
                        stroke="var(--color-coverage)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                    <Line
                        dataKey="drain"
                        type="monotone"
                        stroke="var(--color-drain)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ChartContainer>
        </ChartPanel>
    );
}

function FanoutLatencyChart({
    points,
    windowMinutes,
    loading,
}: SecondaryChartsProps) {
    const data = useMemo(
        () =>
            points.map((point) => ({
                time: formatTimeLabel(point.timestamp, windowMinutes),
                average: point.fanoutDurationAvgMs,
                p95: point.fanoutDurationP95Ms,
                maximum: point.fanoutDurationMaxMs,
            })),
        [points, windowMinutes],
    );

    return (
        <ChartPanel
            title="Fan-out latency"
            description="Average, P95 and maximum Caster fan-out duration."
            helpId="chart_fanout_latency"
            loading={loading}
            hasData={data.length > 0}
        >
            <ChartContainer
                config={latencyConfig}
                className="aspect-auto h-[240px] w-full min-w-0 sm:h-[280px]"
            >
                <LineChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                    />
                    <YAxis
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        unit=" ms"
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
                    <Line
                        dataKey="average"
                        type="monotone"
                        stroke="var(--color-average)"
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        dataKey="p95"
                        type="monotone"
                        stroke="var(--color-p95)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        dataKey="maximum"
                        type="monotone"
                        stroke="var(--color-maximum)"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ChartContainer>
        </ChartPanel>
    );
}

function BacklogBufferChart({
    points,
    windowMinutes,
    loading,
}: SecondaryChartsProps) {
    const data = useMemo(
        () =>
            points.map((point) => ({
                time: formatTimeLabel(point.timestamp, windowMinutes),
                backlog: point.backlogBytes,
                bufferAge: point.maximumBufferAgeMs,
            })),
        [points, windowMinutes],
    );

    return (
        <ChartPanel
            title="Backlog and buffer age"
            description="Queued bytes and age of the slowest Rover output buffer."
            helpId="chart_backlog_buffer"
            loading={loading}
            hasData={data.length > 0}
        >
            <ChartContainer
                config={backlogConfig}
                className="aspect-auto h-[240px] w-full min-w-0 sm:h-[280px]"
            >
                <AreaChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                    />
                    <YAxis
                        yAxisId="bytes"
                        width={42}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        yAxisId="age"
                        orientation="right"
                        width={42}
                        tickLine={false}
                        axisLine={false}
                        unit=" ms"
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
                        yAxisId="bytes"
                        dataKey="backlog"
                        type="monotone"
                        stroke="var(--color-backlog)"
                        fill="var(--color-backlog)"
                        fillOpacity={0.12}
                        strokeWidth={1.8}
                        isAnimationActive={false}
                    />
                    <Area
                        yAxisId="age"
                        dataKey="bufferAge"
                        type="monotone"
                        stroke="var(--color-bufferAge)"
                        fill="var(--color-bufferAge)"
                        fillOpacity={0.05}
                        strokeWidth={1.8}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ChartContainer>
        </ChartPanel>
    );
}

function SocketWriteEventsChart({
    points,
    windowMinutes,
    loading,
}: SecondaryChartsProps) {
    const data = useMemo(
        () =>
            points.map((point) => ({
                time: formatTimeLabel(point.timestamp, windowMinutes),
                partial: point.partialWrites,
                zero: point.zeroWrites,
                failures: point.writeFailures,
            })),
        [points, windowMinutes],
    );

    return (
        <ChartPanel
            title="Socket write events"
            description="Partial writes, zero-byte writes and socket failures."
            helpId="chart_socket_writes"
            loading={loading}
            hasData={data.length > 0}
        >
            <ChartContainer
                config={writeEventsConfig}
                className="aspect-auto h-[240px] w-full min-w-0 sm:h-[280px]"
            >
                <BarChart
                    accessibilityLayer
                    data={data}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                    />
                    <YAxis
                        width={36}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent className="border-white/42 bg-ntrip-cloud/92 backdrop-blur-xl" />
                        }
                    />
                    <ChartLegend
                        content={
                            <ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />
                        }
                    />
                    <Bar
                        dataKey="partial"
                        stackId="writes"
                        fill="var(--color-partial)"
                        isAnimationActive={false}
                    />
                    <Bar
                        dataKey="zero"
                        stackId="writes"
                        fill="var(--color-zero)"
                        isAnimationActive={false}
                    />
                    <Bar
                        dataKey="failures"
                        stackId="writes"
                        fill="var(--color-failures)"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ChartContainer>
        </ChartPanel>
    );
}

function ChartPanel({
    title,
    description,
    helpId,
    loading,
    hasData,
    children,
}: {
    title: string;
    description: string;
    helpId: ObservabilityHelpId;
    loading: boolean;
    hasData: boolean;
    children: ReactNode;
}) {
    return (
        <article className="ntrip-section min-w-0 rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/62">
                        {description}
                    </p>
                </div>

                <ObservabilityHelpButton helpId={helpId} />
            </header>

            {loading && !hasData ? (
                <ChartSkeleton />
            ) : hasData ? (
                <div className="mt-3 min-w-0">{children}</div>
            ) : (
                <ChartEmptyState />
            )}
        </article>
    );
}

function ChartSkeleton() {
    return (
        <div
            aria-busy="true"
            className="mt-3 flex h-[240px] items-end gap-2 overflow-hidden rounded-xl border border-white/36 bg-ntrip-cloud/16 p-4 sm:h-[280px]"
        >
            {[44, 70, 52, 84, 62, 76, 48].map((height, index) => (
                <Skeleton
                    key={`${height}-${index}`}
                    className="min-w-0 flex-1 rounded-t-lg bg-ntrip-ink/7"
                    style={{ height: `${height}%` }}
                />
            ))}
        </div>
    );
}

function ChartEmptyState() {
    return (
        <div className="mt-3 grid h-[240px] place-items-center rounded-xl border border-dashed border-ntrip-ink/14 bg-ntrip-cloud/14 p-4 text-center sm:h-[280px]">
            <div>
                <p className="text-sm font-semibold">No samples</p>
                <p className="mt-1 text-micro text-ntrip-ink/52">
                    Historical RTCM metrics have not been recorded yet.
                </p>
            </div>
        </div>
    );
}
