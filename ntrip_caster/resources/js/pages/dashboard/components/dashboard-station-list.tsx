import { ChevronDown, ChevronUp, RadioTower, Search } from 'lucide-react';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DashboardStation, StationHealth } from '@/types/ntrip-dashboard';

import { DashboardStationHealthFilter } from './dashboard-station-health-filter';
import { DashboardStationRow } from './dashboard-station-row';
import { HEALTH_ORDER, type HealthFilter } from './dashboard-types';

type DashboardStationListProps = {
    stations: DashboardStation[];
    selectedStationId: DashboardStation['id'] | null;
    onSelectStation: (station: DashboardStation) => void;
    onHoverStation: (stationId: DashboardStation['id'] | null) => void;
};

export function DashboardStationList({
    stations,
    selectedStationId,
    onSelectStation,
    onHoverStation,
}: DashboardStationListProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

    const counts = useMemo(
        () =>
            stations.reduce<Record<StationHealth, number>>(
                (result, station) => {
                    result[station.health] += 1;
                    return result;
                },
                {
                    healthy: 0,
                    warning: 0,
                    critical: 0,
                    offline: 0,
                },
            ),
        [stations],
    );

    const filteredStations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return [...stations]
            .filter((station) => {
                if (healthFilter !== 'all' && station.health !== healthFilter) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                return [
                    station.name,
                    station.deviceId,
                    station.mountpoint,
                    station.ipAddress ?? '',
                ].some((value) => value.toLowerCase().includes(query));
            })
            .sort(
                (left, right) =>
                    HEALTH_ORDER[left.health] - HEALTH_ORDER[right.health],
            );
    }, [healthFilter, searchQuery, stations]);

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={() => setCollapsed(false)}
                className={cn(
                    'ntrip-glass-panel',
                    'pointer-events-auto absolute bottom-10 sm:top-0 left-0 z-30 flex h-10 items-center gap-2 rounded-xl px-3',
                )}
            >
                {/* <span className="grid size-7 place-items-center rounded-xl bg-ntrip-teal/12 text-ntrip-teal">
                    <RadioTower className="size-3.5" />
                </span> */}

                <span className="text-xs font-semibold">
                    {stations.length} stations
                </span>

                <span className="flex items-center gap-1 text-xs text-ntrip-ink/62">
                    <span className="size-1.5 rounded-full bg-ntrip-teal" />
                    {counts.healthy}
                </span>

                <span className="flex items-center gap-1 text-xs text-ntrip-ink/62">
                    <span className="size-1.5 rounded-full bg-ntrip-coral" />
                    {counts.critical}
                </span>

                <ChevronUp className="ml-1 size-3.5 text-ntrip-ink/62" />
            </button>
        );
    }

    return (
        <section
            className={cn(
                'ntrip-glass-panel',
                'pointer-events-auto absolute right-0 bottom-10  left-0 z-[999] overflow-hidden rounded-2xl sm:right-auto sm:bottom-auto sm:top-0 sm:w-96',
            )}
        >
            <header className="flex items-center justify-between border-b border-ntrip-ink/8 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    {/* <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ntrip-teal/12 text-ntrip-teal">
                        <RadioTower className="size-3.5" strokeWidth={1.8} />
                    </span> */}

                    <div className="min-w-0">
                        <h1 className="truncate text-sm font-semibold">
                            Station health
                        </h1>

                        <p className="truncate text-xs text-ntrip-ink/62">
                            {stations.length} base stations
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Collapse station list"
                    onClick={() => setCollapsed(true)}
                    className="size-8 rounded-xl"
                >
                    <ChevronDown className="size-3.5" />
                </Button>
            </header>

            <div className="border-b border-ntrip-ink/8 px-3 py-2.5">
                <DashboardStationHealthFilter
                    activeFilter={healthFilter}
                    counts={counts}
                    total={stations.length}
                    onChange={setHealthFilter}
                />

                <div className="relative mt-2">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />

                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search station"
                        className="h-8 rounded-xl border-ntrip-ink/8 bg-ntrip-cloud/62 pl-8 text-xs shadow-none placeholder:text-ntrip-ink/32 focus-visible:ring-ntrip-teal/30"
                    />
                </div>
            </div>

            <div className="max-h-50 overflow-y-auto p-2 sm:max-h-[calc(60vh-10rem)]">
                {filteredStations.length > 0 ? (
                    <div className="grid gap-0.5">
                        {filteredStations.map((station) => (
                            <DashboardStationRow
                                key={station.id}
                                station={station}
                                selected={
                                    selectedStationId !== null &&
                                    String(selectedStationId) ===
                                        String(station.id)
                                }
                                onClick={() => onSelectStation(station)}
                                onHoverChange={(hovered) =>
                                    onHoverStation(hovered ? station.id : null)
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid min-h-24 place-items-center px-4 text-center">
                        <div>
                            <p className="text-xs font-semibold">
                                No matching stations
                            </p>
                            <p className="mt-1 text-xs text-ntrip-ink/62">
                                Change the search or health filter.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
