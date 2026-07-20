import { cn } from '@/lib/utils';

import type { DashboardMetric, MetricTone } from './dashboard-types';

const TONE_STYLES: Record<
    MetricTone,
    {
        foreground: string;
        background: string;
    }
> = {
    ink: {
        foreground: 'text-ntrip-ink',
        background: 'bg-ntrip-ink/7',
    },
    teal: {
        foreground: 'text-ntrip-teal',
        background: 'bg-ntrip-teal/12',
    },
    amber: {
        foreground: 'text-ntrip-amber',
        background: 'bg-ntrip-amber/16',
    },
    coral: {
        foreground: 'text-ntrip-coral',
        background: 'bg-ntrip-coral/12',
    },
};

function MiniSparkline({
    points,
    tone,
}: {
    points: number[];
    tone: MetricTone;
}) {
    const width = 58;
    const height = 18;
    const minimum = Math.min(...points);
    const maximum = Math.max(...points);
    const range = Math.max(1, maximum - minimum);

    const path = points
        .map((point, index) => {
            const x = (index / Math.max(1, points.length - 1)) * width;
            const y = height - ((point - minimum) / range) * (height - 4) - 2;

            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className={cn('h-4 w-14', TONE_STYLES[tone].foreground)}
            aria-hidden="true"
        >
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function DashboardMetricCard({
    label,
    value,
    unit,
    hint,
    icon: Icon,
    tone,
    points,
}: DashboardMetric) {
    const toneStyle = TONE_STYLES[tone];

    return (
        <article
            title={hint}
            className="min-w-0 rounded-xl bg-ntrip-cloud/62 px-2.5 py-2 shadow-ntrip-inset"
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-xl',
                        toneStyle.background,
                        toneStyle.foreground,
                    )}
                >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                </span>

                <MiniSparkline points={points} tone={tone} />
            </div>

            <div className="mt-2 flex min-w-0 items-end gap-1">
                <strong className="truncate text-sm leading-none font-semibold tracking-[-0.03em] text-ntrip-ink tabular-nums">
                    {value}
                </strong>

                {unit ? (
                    <span className="shrink-0 text-xs leading-none font-medium text-ntrip-ink/62">
                        {unit}
                    </span>
                ) : null}
            </div>

            <p className="mt-1 truncate text-xs font-medium text-ntrip-ink/52">
                {label}
            </p>
        </article>
    );
}
