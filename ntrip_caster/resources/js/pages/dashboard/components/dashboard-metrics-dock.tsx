import { ChevronDown, ChevronUp } from 'lucide-react';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { DashboardMetricCard } from './dashboard-metric-card';
import type { DashboardMetric } from './dashboard-types';

type DashboardMetricsDockProps = {
    metrics: DashboardMetric[];
};

export function DashboardMetricsDock({ metrics }: DashboardMetricsDockProps) {
    const [collapsed, setCollapsed] = useState(false);

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={() => setCollapsed(false)}
                className={cn(
                    'ntrip-glass-panel',
                    'pointer-events-auto absolute right-0 bottom-0 z-30 hidden h-10 items-center gap-2 rounded-2xl px-3 text-xs font-semibold lg:flex',
                )}
            >
                <span>Network metrics</span>

                <span className="text-ntrip-ink/62">
                    {metrics[0]?.value ?? '—'} stations
                </span>

                <ChevronUp className="size-3.5 text-ntrip-ink/62" />
            </button>
        );
    }

    return (
        <section
            className={cn(
                'ntrip-glass-panel',
                'pointer-events-auto absolute right-0 bottom-0 z-30 hidden w-[42rem] max-w-[calc(100vw-27rem)] overflow-hidden rounded-2xl lg:block',
            )}
        >
            <header className="flex h-9 items-center justify-between border-b border-ntrip-ink/8 px-3">
                <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-ntrip-teal" />
                    <span className="text-xs font-semibold">
                        Network metrics
                    </span>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Collapse network metrics"
                    onClick={() => setCollapsed(true)}
                    className="size-7 rounded-xl"
                >
                    <ChevronDown className="size-3.5" />
                </Button>
            </header>

            <div className="grid grid-cols-5 gap-1.5 p-1.5">
                {metrics.map((metric) => (
                    <DashboardMetricCard key={metric.label} {...metric} />
                ))}
            </div>
        </section>
    );
}
