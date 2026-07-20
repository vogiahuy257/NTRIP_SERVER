import { Link } from '@inertiajs/react';
import { MapPin, ArrowUpRight, RadioTower, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import { StatusPill } from '@/components/map-dashboard/status-pill';
import { Input } from '@/components/ui/input';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';
import type { DashboardStation, StationHealth } from '@/types/ntrip-dashboard';

type HealthFilter = 'all' | StationHealth;

type HealthOption = {
    value: HealthFilter;
    label: string;
};

const HEALTH_OPTIONS: HealthOption[] = [
    {
        value: 'all',
        label: 'All health states',
    },
    {
        value: 'healthy',
        label: 'Healthy',
    },
    {
        value: 'warning',
        label: 'Warning',
    },
    {
        value: 'critical',
        label: 'Critical',
    },
    {
        value: 'offline',
        label: 'Offline',
    },
];

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function formatLastSeen(value: string | null, nowMs: number | null): string {
    if (!value) {
        return 'No telemetry';
    }

    /*
     * Keep the server render and the first client render identical.
     * Relative time is calculated only after hydration completes.
     */
    if (nowMs === null) {
        return 'Updating';
    }

    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        return 'Unknown';
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - timestamp) / 1000));

    if (elapsedSeconds < 5) {
        return 'Just now';
    }

    if (elapsedSeconds < 60) {
        return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedHours < 24) {
        return `${elapsedHours}h ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);

    return `${elapsedDays}d ago`;
}

function stationMatchesSearch(
    station: DashboardStation,
    query: string,
): boolean {
    if (!query) {
        return true;
    }

    const searchableValues = [
        station.name,
        station.deviceId,
        station.mountpoint,
        station.ipAddress ?? '',
    ];

    return searchableValues.some((value) =>
        value.toLowerCase().includes(query),
    );
}

function StationDirectoryItem({
    station,
    selected,
    nowMs,
    onSelect,
}: {
    station: DashboardStation;
    selected: boolean;
    nowMs: number | null;
    onSelect: () => void;
}) {
    return (
        <Link
            href={`/stations/${station.id}`}
            onClick={onSelect}
            aria-label={`Open ${station.name}`}
            className={cn(
                [
                    'group',
                    'relative',
                    'block',
                    'w-full',
                    'overflow-hidden',
                    'rounded-2xl',
                    'px-4',
                    'py-4',
                    'text-left',
                    'outline-none',
                    'transition',
                    'duration-200',
                    'focus-visible:ring-2',
                    'focus-visible:ring-ntrip-teal/35',
                ],
                selected
                    ? ['bg-ntrip-cloud/96', 'shadow-ntrip-selected']
                    : [
                          'bg-ntrip-cloud/56',
                          'shadow-ntrip-inset-soft',
                          'hover:bg-ntrip-cloud/82',
                          'hover:shadow-ntrip-selected-hover',
                      ],
            )}
        >
            <div className="flex min-w-0 items-start gap-3 pr-9">
                <span
                    className={cn(
                        'grid',
                        'size-10',
                        'shrink-0',
                        'place-items-center',
                        'rounded-xl',
                        'bg-ntrip-teal/12',
                        'text-ntrip-teal',
                    )}
                >
                    <RadioTower className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3
                            className={cn(
                                'min-w-0',
                                'flex-1',
                                'truncate',
                                'text-sm',
                                'font-semibold',
                                'tracking-[-0.015em]',
                                'text-ntrip-ink',
                            )}
                        >
                            {station.name}
                        </h3>

                        <StatusPill status={station.health} />
                    </div>

                    <div
                        className={cn(
                            'mt-1.5',
                            'flex',
                            'min-w-0',
                            'items-center',
                            'gap-1.5',
                            'text-xs',
                            'text-ntrip-ink/46',
                        )}
                    >
                        <MapPin className="size-3 shrink-0" />

                        <span className="truncate">
                            {station.deviceId}
                            {' · '}
                            {station.mountpoint}
                        </span>
                    </div>

                    <p
                        className={cn(
                            'mt-2',
                            'text-xs',
                            'text-ntrip-ink/38',
                        )}
                    >
                        Updated {formatLastSeen(station.lastSeenAt, nowMs)}
                    </p>
                </div>
            </div>

            <ArrowUpRight
                className={cn(
                    'absolute',
                    'top-3.5',
                    'right-3.5',
                    'size-4',
                    'text-ntrip-ink/34',
                    'transition',
                    'duration-200',
                    'group-hover:translate-x-0.5',
                    'group-hover:-translate-y-0.5',
                    'group-hover:text-ntrip-teal',
                )}
            />
        </Link>
    );
}

export function StationDirectoryPanel() {
    const [nowMs, setNowMs] = useState<number | null>(null);

    useEffect(() => {
        function updateCurrentTime(): void {
            setNowMs(Date.now());
        }

        updateCurrentTime();

        const intervalId = window.setInterval(updateCurrentTime, 30_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const { stations, selectedStationId, setSelectedStationId } =
        useMapDashboard();

    const [searchQuery, setSearchQuery] = useState('');

    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

    const filteredStations = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return stations.filter((station) => {
            const matchesHealth =
                healthFilter === 'all' || station.health === healthFilter;

            const matchesSearch = stationMatchesSearch(
                station,
                normalizedQuery,
            );

            return matchesHealth && matchesSearch;
        });
    }, [healthFilter, searchQuery, stations]);

    return (
        <section
            onPointerDown={stopMapEvent}
            onDoubleClick={stopMapEvent}
            onWheel={stopMapEvent}
            className={cn('ntrip-glass-panel-dense', [
                'pointer-events-auto',
                'flex',
                'h-full',
                'min-h-0',
                'w-full',
                'flex-col',
                'overflow-hidden',
                'rounded-2xl',
                'sm:max-w-120',
                'lg:max-w-128',
            ])}
        >
            <header
                className={cn(
                    'border-b',
                    'border-ntrip-ink/8',
                    'px-4',
                    'py-4',
                    'sm:px-5',
                )}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p
                            className={cn(
                                'text-xs',
                                'font-semibold',
                                'text-ntrip-teal',
                            )}
                        >
                            Station directory
                        </p>

                        <h2
                            className={cn(
                                'mt-1',
                                'text-lg',
                                'font-semibold',
                                'tracking-[-0.025em]',
                                'text-ntrip-ink',
                            )}
                        >
                            Base stations
                        </h2>
                    </div>

                    <span
                        className={cn(
                            'grid',
                            'size-10',
                            'shrink-0',
                            'place-items-center',
                            'rounded-2xl',
                            'bg-ntrip-teal/13',
                            'text-ntrip-teal',
                        )}
                    >
                        <RadioTower className="size-4" />
                    </span>
                </div>

                <div
                    className={cn(
                        'mt-4',
                        'grid',
                        'gap-2',
                        'sm:grid-cols-[minmax(0,1fr)_10rem]',
                    )}
                >
                    <div className="relative min-w-0">
                        <Search
                            className={cn(
                                'pointer-events-none',
                                'absolute',
                                'top-1/2',
                                'left-3',
                                'size-4',
                                '-translate-y-1/2',
                                'text-ntrip-ink/40',
                            )}
                        />

                        <Input
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder="Search station"
                            className={cn(
                                'h-10',
                                'rounded-xl',
                                'border-ntrip-ink/9',
                                'bg-ntrip-cloud/72',
                                'pl-9',
                                'text-caption',
                                'shadow-none',
                                'placeholder:text-ntrip-ink/38',
                                'focus-visible:ring-ntrip-teal/30',
                            )}
                        />
                    </div>

                    <select
                        value={healthFilter}
                        onChange={(event) =>
                            setHealthFilter(event.target.value as HealthFilter)
                        }
                        className={cn(
                            'h-10',
                            'w-full',
                            'rounded-xl',
                            'border',
                            'border-ntrip-ink/9',
                            'bg-ntrip-cloud/72',
                            'px-3',
                            'text-xs',
                            'font-semibold',
                            'text-ntrip-ink',
                            'outline-none',
                            'focus:border-ntrip-teal/35',
                        )}
                    >
                        {HEALTH_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <div
                className={cn(
                    'min-h-0',
                    'flex-1',
                    'overflow-y-auto',
                    'overscroll-contain',
                    'p-3',
                )}
            >
                {filteredStations.length > 0 ? (
                    <div className="space-y-2">
                        {filteredStations.map((station) => (
                            <StationDirectoryItem
                                key={station.id}
                                station={station}
                                selected={
                                    selectedStationId !== null &&
                                    String(selectedStationId) ===
                                        String(station.id)
                                }
                                nowMs={nowMs}
                                onSelect={() => {
                                    setSelectedStationId(station.id);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className={cn(
                            'grid',
                            'h-full',
                            'min-h-40',
                            'place-items-center',
                            'px-6',
                            'text-center',
                        )}
                    >
                        <div>
                            <RadioTower
                                className={cn(
                                    'mx-auto',
                                    'size-6',
                                    'text-ntrip-ink/35',
                                )}
                            />

                            <p
                                className={cn(
                                    'mt-3',
                                    'text-sm',
                                    'font-semibold',
                                    'text-ntrip-ink',
                                )}
                            >
                                No matching stations
                            </p>

                            <p
                                className={cn(
                                    'mt-1',
                                    'text-xs',
                                    'text-ntrip-ink/48',
                                )}
                            >
                                Change the search text or health filter.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <footer
                className={cn(
                    'border-t',
                    'border-ntrip-ink/8',
                    'px-4',
                    'py-3',
                    'text-xs',
                    'text-ntrip-ink/50',
                )}
            >
                Showing{' '}
                <strong className="text-ntrip-ink">
                    {filteredStations.length}
                </strong>{' '}
                of <strong className="text-ntrip-ink">{stations.length}</strong>{' '}
                stations
            </footer>
        </section>
    );
}
