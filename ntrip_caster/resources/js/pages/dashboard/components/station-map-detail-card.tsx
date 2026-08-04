import { Link } from '@inertiajs/react';
import {
    Clock3,
    Database,
    ExternalLink,
    Gauge,
    RadioTower,
    Wifi,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { StationMapAnchor } from '@/components/map-dashboard/ntrip-map';
import { StatusPill } from '@/components/map-dashboard/status-pill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DashboardStation } from '@/types/ntrip-dashboard';

import {
    formatBps,
    formatHeap,
    formatLastSeen,
} from '../lib/dashboard-formatters';

type StationMapDetailCardProps = {
    station: DashboardStation;
    anchor: StationMapAnchor;
    persistent: boolean;
    onClose: () => void;
    onHoverChange: (hovered: boolean) => void;
};

type CardPosition = {
    left: number;
    top: number;
    ready: boolean;
};

const VIEWPORT_MARGIN = 12;
const NAVIGATION_SAFE_TOP = 72;
const MARKER_GAP = 18;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

export function StationMapDetailCard({
    station,
    anchor,
    onClose,
    onHoverChange,
}: StationMapDetailCardProps) {
    const cardRef = useRef<HTMLElement | null>(null);
    const [position, setPosition] = useState<CardPosition>({
        left: anchor.x,
        top: anchor.y,
        ready: false,
    });

    useLayoutEffect(() => {
        const card = cardRef.current;

        if (!card) {
            return;
        }

        const updatePosition = (): void => {
            const bounds = card.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const preferredLeft =
                anchor.side === 'right'
                    ? anchor.x + MARKER_GAP
                    : anchor.x - bounds.width - MARKER_GAP;

            const preferredTop = anchor.y - bounds.height / 2;

            setPosition({
                left: clamp(
                    preferredLeft,
                    VIEWPORT_MARGIN,
                    Math.max(
                        VIEWPORT_MARGIN,
                        viewportWidth - bounds.width - VIEWPORT_MARGIN,
                    ),
                ),
                top: clamp(
                    preferredTop,
                    NAVIGATION_SAFE_TOP,
                    Math.max(
                        NAVIGATION_SAFE_TOP,
                        viewportHeight - bounds.height - VIEWPORT_MARGIN,
                    ),
                ),
                ready: true,
            });
        };

        const resizeObserver = new ResizeObserver(updatePosition);

        updatePosition();
        resizeObserver.observe(card);
        window.addEventListener('resize', updatePosition);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updatePosition);
        };
    }, [anchor]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent): void => {
            if (cardRef.current?.contains(event.target as Node)) {
                return;
            }

            onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [onClose]);

    return (
        <aside
            ref={cardRef}
            style={{
                left: position.left,
                top: position.top,
            }}
            className={cn(
                'ntrip-glass-panel',
                'pointer-events-auto fixed z-[90]',
                'w-[clamp(13rem,40vw,20rem)]',
                'max-w-[calc(100vw-1rem)]',
                'overflow-visible rounded-[clamp(0.75rem,2vw,1rem)]',
                'transition duration-300 ease-out',
                position.ready
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-1 opacity-0',
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
        >
            <span
                className={cn(
                    'absolute top-1/2 size-3 -translate-y-1/2 rotate-45 border-ntrip-cloud/62 bg-ntrip-cloud/92',
                    anchor.side === 'right'
                        ? '-left-1.5 border-b border-l'
                        : '-right-1.5 border-t border-r',
                )}
            />

            <header className="flex items-start justify-between gap-[clamp(0.5rem,1.5vw,0.75rem)] border-b border-ntrip-ink/8 px-[clamp(0.625rem,2vw,1rem)] py-[clamp(0.5rem,1.6vw,0.75rem)]">
                <div className="min-w-0">
                    <StatusPill
                        status={station.health}
                        className="h-[clamp(1.25rem,4vw,1.75rem)] gap-[clamp(0.25rem,1vw,0.5rem)] rounded-[clamp(0.5rem,1.4vw,0.75rem)] px-[clamp(0.45rem,1.4vw,0.625rem)] text-[clamp(0.6875rem,1.8vw,0.75rem)]"
                    />

                    <h2 className="mt-[clamp(0.3rem,1vw,0.5rem)] truncate text-[clamp(0.8125rem,2.4vw,1.125rem)] leading-tight font-semibold tracking-[-0.02em] text-ntrip-ink">
                        {station.name}
                    </h2>

                    <p className="mt-0.5 truncate text-[clamp(0.6875rem,1.7vw,0.75rem)] leading-4 text-ntrip-ink/62">
                        {station.deviceId} · {station.mountpoint}
                    </p>
                </div>

                <span className="grid size-[clamp(1.75rem,5vw,2.25rem)] shrink-0 place-items-center rounded-[clamp(0.5rem,1.5vw,1rem)] bg-ntrip-teal/13 text-ntrip-teal">
                    <RadioTower
                        className="size-[clamp(0.75rem,2.5vw,1rem)]"
                        strokeWidth={1.8}
                    />
                </span>
            </header>

            <div className="grid grid-cols-2 gap-[clamp(0.25rem,1vw,0.5rem)] p-[clamp(0.375rem,1.6vw,0.75rem)]">
                <div className="min-w-0 rounded-[clamp(0.5rem,1.5vw,0.75rem)] bg-ntrip-cloud/58 p-[clamp(0.375rem,1.4vw,0.625rem)] shadow-ntrip-inset">
                    <p className="truncate text-[clamp(0.6875rem,1.7vw,0.75rem)] leading-4 text-ntrip-ink/62">
                        RTCM traffic
                    </p>

                    <p className="mt-0.5 truncate text-[clamp(0.8125rem,2.2vw,1.125rem)] leading-tight font-semibold tracking-[-0.02em] tabular-nums">
                        {formatBps(station.uploadBps)}
                        <span className="ml-1 text-[clamp(0.6875rem,1.7vw,0.75rem)] font-medium text-ntrip-ink/38">
                            bps
                        </span>
                    </p>
                </div>

                <div className="min-w-0 rounded-[clamp(0.5rem,1.5vw,0.75rem)] bg-ntrip-cloud/58 p-[clamp(0.375rem,1.4vw,0.625rem)] shadow-ntrip-inset">
                    <p className="truncate text-[clamp(0.6875rem,1.7vw,0.75rem)] leading-4 text-ntrip-ink/62">
                        RTCM age
                    </p>

                    <p className="mt-0.5 truncate text-[clamp(0.8125rem,2.2vw,1.125rem)] leading-tight font-semibold tracking-[-0.02em] tabular-nums">
                        {station.rtcmAgeMs ?? '—'}
                        <span className="ml-1 text-[clamp(0.6875rem,1.7vw,0.75rem)] font-medium text-ntrip-ink/38">
                            ms
                        </span>
                    </p>
                </div>
            </div>

            <dl className="grid gap-[clamp(0.25rem,1.1vw,0.5rem)] border-t border-ntrip-ink/8 px-[clamp(0.625rem,2vw,1rem)] py-[clamp(0.5rem,1.6vw,0.75rem)] text-[clamp(0.6875rem,1.7vw,0.75rem)] leading-4">
                <div className="flex items-center justify-between gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-ntrip-ink/62">
                        <Wifi className="size-[clamp(0.75rem,2.2vw,0.875rem)] shrink-0" />
                        <span className="truncate">Network</span>
                    </dt>

                    <dd className="max-w-[65%] truncate text-right font-semibold">
                        {station.networkType} · {station.ipAddress ?? 'Unknown'}
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-ntrip-ink/62">
                        <Gauge className="size-[clamp(0.75rem,2.2vw,0.875rem)] shrink-0" />
                        <span className="truncate">Temperature</span>
                    </dt>

                    <dd className="shrink-0 font-semibold tabular-nums">
                        {station.temperatureC ?? '—'} °C
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-ntrip-ink/62">
                        <Database className="size-[clamp(0.75rem,2.2vw,0.875rem)] shrink-0" />
                        <span className="truncate">Free heap</span>
                    </dt>

                    <dd className="shrink-0 font-semibold tabular-nums">
                        {formatHeap(station.freeHeapBytes)}
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-ntrip-ink/62">
                        <Clock3 className="size-[clamp(0.75rem,2.2vw,0.875rem)] shrink-0" />
                        <span className="truncate">Last telemetry</span>
                    </dt>

                    <dd className="shrink-0 font-semibold">
                        {formatLastSeen(station.lastSeenAt)}
                    </dd>
                </div>
            </dl>

            <div className="border-t border-ntrip-ink/8 p-[clamp(0.375rem,1.5vw,0.75rem)]">
                <Button
                    asChild
                    className="min-h-9 w-full rounded-[clamp(0.5rem,1.5vw,0.75rem)] bg-ntrip-ink px-3 text-xs font-medium text-ntrip-cloud hover:bg-ntrip-ink/90"
                >
                    <Link href={`/stations/${station.id}`}>
                        Open station
                        <ExternalLink className="size-3.5" />
                    </Link>
                </Button>
            </div>
        </aside>
    );
}
