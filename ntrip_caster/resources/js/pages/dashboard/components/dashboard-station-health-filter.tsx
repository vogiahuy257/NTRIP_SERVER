import { useEffect, useRef } from 'react';
import { Layers3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StationHealth } from '@/types/ntrip-dashboard';

import {
    HEALTH_FILTERS,
    HEALTH_LABELS,
    type HealthFilter,
} from './dashboard-types';

type DashboardStationHealthFilterProps = {
    activeFilter: HealthFilter;
    counts: Record<StationHealth, number>;
    total: number;
    onChange: (filter: HealthFilter) => void;
};

export function DashboardStationHealthFilter({
    activeFilter,
    counts,
    total,
    onChange,
}: DashboardStationHealthFilterProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = scrollRef.current;

        if (!element) {
            return;
        }

        const handleWheel = (event: WheelEvent) => {
            const maxScrollLeft =
                element.scrollWidth - element.clientWidth;

            if (maxScrollLeft <= 0) {
                return;
            }

            /*
             * Không can thiệp khi người dùng đang vuốt ngang bằng touchpad.
             */
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                return;
            }

            const canScrollLeft =
                event.deltaY < 0 && element.scrollLeft > 0;

            const canScrollRight =
                event.deltaY > 0 &&
                element.scrollLeft < maxScrollLeft;

            /*
             * Khi đã đến đầu hoặc cuối danh sách,
             * trả wheel lại cho trang để trang tiếp tục cuộn dọc.
             */
            if (!canScrollLeft && !canScrollRight) {
                return;
            }

            event.preventDefault();

            element.scrollLeft += event.deltaY;
        };

        element.addEventListener('wheel', handleWheel, {
            passive: false,
        });

        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, []);

    return (
        <div
            ref={scrollRef}
            className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain scrollbar-none"
        >
            <div className="flex w-max gap-1 pb-0.5">
                {HEALTH_FILTERS.map((filter) => {
                    const active = activeFilter === filter;
                    const count =
                        filter === 'all' ? total : counts[filter];

                    return (
                        <button
                            key={filter}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(filter)}
                            className={cn(
                                'flex h-7 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition',
                                active
                                    ? 'bg-ntrip-ink text-ntrip-cloud'
                                    : 'bg-ntrip-cloud/58 text-ntrip-ink/62 hover:bg-ntrip-cloud/86 hover:text-ntrip-ink',
                            )}
                        >
                            {filter === 'all' ? (
                                <Layers3 className="size-3" />
                            ) : (
                                <span
                                    data-status={filter}
                                    className="ntrip-status-dot size-1.5 rounded-full"
                                />
                            )}

                            <span>
                                {filter === 'all'
                                    ? 'All'
                                    : HEALTH_LABELS[filter]}
                            </span>

                            <span
                                className={cn(
                                    'tabular-nums',
                                    active
                                        ? 'text-ntrip-cloud/68'
                                        : 'text-ntrip-ink/52',
                                )}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}