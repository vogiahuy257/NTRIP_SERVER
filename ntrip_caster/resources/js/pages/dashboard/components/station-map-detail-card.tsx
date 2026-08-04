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
    persistent,
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

        const updatePosition = () => {
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

        updatePosition();
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('resize', updatePosition);
        };
    }, [anchor]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            // Nếu click vào bên trong thẻ thì không làm gì cả
            if (cardRef.current && cardRef.current.contains(event.target as Node)) {
                return;
            }
            // Nếu click ra ngoài, gọi hàm onClose được truyền từ cha xuống để đóng thẻ
            onClose();
        };

        // Lắng nghe sự kiện click/touch trên toàn bộ trang
        document.addEventListener('pointerdown', handleClickOutside);

        return () => {
            // Dọn dẹp event listener khi component unmount
            document.removeEventListener('pointerdown', handleClickOutside);
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
                'pointer-events-auto fixed z-[90] w-[min(17rem,calc(100vw-1.5rem))] overflow-visible rounded-2xl transition duration-300 ease-out sm:w-80',
                position.ready ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
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

            <header className="flex items-start justify-between gap-2.5 border-b border-ntrip-ink/8 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div className="min-w-0">
                    <StatusPill status={station.health} />

                    <h2 className="mt-1.5 truncate text-base font-semibold tracking-[-0.025em] text-ntrip-ink sm:mt-2 sm:text-lg">
                        {station.name}
                    </h2>

                    <p className="mt-0.5 truncate text-xs text-ntrip-ink/62">
                        {station.deviceId} · {station.mountpoint}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <span className="grid size-8 place-items-center rounded-xl bg-ntrip-teal/13 text-ntrip-teal sm:size-9 sm:rounded-2xl">
                        <RadioTower className="size-4" strokeWidth={1.8} />
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-1.5 p-2 sm:gap-2 sm:p-3">
                <div className="rounded-xl bg-ntrip-cloud/58 p-2 shadow-ntrip-inset sm:p-2.5">
                    <p className="text-xs text-ntrip-ink/62">RTCM traffic</p>
                    <p className="mt-0.5 text-base font-semibold tracking-[-0.02em] tabular-nums sm:mt-1 sm:text-lg">
                        {formatBps(station.uploadBps)}
                        <span className="ml-1 text-xs font-medium text-ntrip-ink/38">
                            bps
                        </span>
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/58 p-2 shadow-ntrip-inset sm:p-2.5">
                    <p className="text-xs text-ntrip-ink/62">RTCM age</p>
                    <p className="mt-0.5 text-base font-semibold tracking-[-0.02em] tabular-nums sm:mt-1 sm:text-lg">
                        {station.rtcmAgeMs ?? '—'}
                        <span className="ml-1 text-xs font-medium text-ntrip-ink/38">
                            ms
                        </span>
                    </p>
                </div>
            </div>

            <dl className="grid gap-1.5 border-t border-ntrip-ink/8 px-3 py-2.5 text-[11px] sm:gap-2 sm:px-4 sm:py-3 sm:text-xs">
                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ntrip-ink/62">
                        <Wifi className="size-3.5" />
                        Network
                    </dt>
                    <dd className="max-w-[65%] truncate font-semibold">
                        {station.networkType} · {station.ipAddress ?? 'Unknown'}
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ntrip-ink/62">
                        <Gauge className="size-3.5" />
                        Temperature
                    </dt>
                    <dd className="font-semibold tabular-nums">
                        {station.temperatureC ?? '—'} °C
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ntrip-ink/62">
                        <Database className="size-3.5" />
                        Free heap
                    </dt>
                    <dd className="font-semibold tabular-nums">
                        {formatHeap(station.freeHeapBytes)}
                    </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-ntrip-ink/62">
                        <Clock3 className="size-3.5" />
                        Last telemetry
                    </dt>
                    <dd className="font-semibold">
                        {formatLastSeen(station.lastSeenAt)}
                    </dd>
                </div>
            </dl>

            <div className="border-t border-ntrip-ink/8 p-2 sm:p-3">
                <Button
                    asChild
                    className="h-8 w-full rounded-xl bg-ntrip-ink text-[11px] text-ntrip-cloud hover:bg-ntrip-ink/90 sm:h-9 sm:text-xs"
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
