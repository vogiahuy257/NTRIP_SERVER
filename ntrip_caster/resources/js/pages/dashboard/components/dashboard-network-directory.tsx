import {
    ChevronDown,
    ChevronUp,
    RadioTower,
    Search,
    Satellite,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
    getDashboardRoverName,
    hasRoverGgaData,
    hasRoverMapPosition,
} from '@/realtime/dashboard-session-selectors';
import type {
    DashboardRoverSession,
    DashboardStation,
    StationHealth,
} from '@/types/ntrip-dashboard';

import { DashboardRoverRow } from './dashboard-rover-row';
import { DashboardStationHealthFilter } from './dashboard-station-health-filter';
import { DashboardStationRow } from './dashboard-station-row';
import { HEALTH_ORDER } from './dashboard-types';
import type { HealthFilter } from './dashboard-types';

export type DashboardDirectoryTab = 'stations' | 'rovers';

type DashboardNetworkDirectoryProps = {
    activeTab: DashboardDirectoryTab;

    stations: DashboardStation[];
    rovers: DashboardRoverSession[];

    selectedStationId: DashboardStation['id'] | null;
    selectedRoverId: DashboardRoverSession['id'] | null;

    onTabChange: (tab: DashboardDirectoryTab) => void;

    onSelectStation: (station: DashboardStation) => void;

    onHoverStation: (stationId: DashboardStation['id'] | null) => void;

    onSelectRover: (rover: DashboardRoverSession) => void;
};

export function DashboardNetworkDirectory({
    activeTab,
    stations,
    rovers,
    selectedStationId,
    selectedRoverId,
    onTabChange,
    onSelectStation,
    onHoverStation,
    onSelectRover,
}: DashboardNetworkDirectoryProps) {
    const [collapsed, setCollapsed] = useState(false);

    const [stationSearchQuery, setStationSearchQuery] = useState('');

    const [roverSearchQuery, setRoverSearchQuery] = useState('');

    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

    const healthCounts = useMemo(
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
        const query = stationSearchQuery.trim().toLowerCase();

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
    }, [healthFilter, stationSearchQuery, stations]);

    const filteredRovers = useMemo(() => {
        const query = roverSearchQuery.trim().toLowerCase();

        return [...rovers]
            .filter((rover) => {
                if (!query) {
                    return true;
                }

                return [
                    getDashboardRoverName(rover),
                    String(rover.id),
                    rover.authenticatedUsername ?? '',
                    rover.remoteIp ?? '',
                    rover.mountpoint?.name ?? '',
                ].some((value) => value.toLowerCase().includes(query));
            })
            .sort((left, right) => {
                const leftOnMap = hasRoverMapPosition(left) ? 0 : 1;

                const rightOnMap = hasRoverMapPosition(right) ? 0 : 1;

                if (leftOnMap !== rightOnMap) {
                    return leftOnMap - rightOnMap;
                }

                return getDashboardRoverName(left).localeCompare(
                    getDashboardRoverName(right),
                );
            });
    }, [roverSearchQuery, rovers]);

    const roversOnMap = useMemo(
        () => rovers.filter(hasRoverMapPosition).length,
        [rovers],
    );

    const roversAwaitingGga = useMemo(
        () => rovers.filter((rover) => !hasRoverGgaData(rover)).length,
        [rovers],
    );

    const changeTab = (value: string): void => {
        if (value !== 'stations' && value !== 'rovers') {
            return;
        }

        onHoverStation(null);
        onTabChange(value);
    };

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={() => setCollapsed(false)}
                className={cn(
                    'ntrip-glass-panel',
                    'pointer-events-auto absolute bottom-10 left-0 z-30 flex h-10 items-center gap-2 rounded-xl px-3 sm:top-0',
                )}
            >
                <span className="text-xs font-semibold">
                    {stations.length} stations
                </span>

                <span className="text-xs text-ntrip-ink/42">·</span>

                <span className="text-xs font-semibold">
                    {rovers.length} rovers
                </span>

                <ChevronUp className="ml-1 size-3.5 text-ntrip-ink/62" />
            </button>
        );
    }

    return (
        <section
            className={cn(
                'ntrip-glass-panel',
                'pointer-events-auto absolute right-0 bottom-0 left-0 z-[999] overflow-hidden rounded-2xl sm:top-0 sm:right-auto sm:bottom-auto sm:w-96',
            )}
        >
            <header className="flex items-center justify-between border-b border-ntrip-ink/8 px-3 py-2.5">
                <div className="min-w-0">
                    <h1 className="truncate text-sm font-semibold">
                        Network directory
                    </h1>

                    <p className="truncate text-xs text-ntrip-ink/62">
                        {stations.length} stations · {rovers.length} rovers
                    </p>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Collapse network directory"
                    onClick={() => setCollapsed(true)}
                    className="size-8 rounded-xl"
                >
                    <ChevronDown className="size-3.5" />
                </Button>
            </header>

            <div className="border-b border-ntrip-ink/8 px-3 pt-2.5 pb-2">
                <ToggleGroup
                    type="single"
                    value={activeTab}
                    onValueChange={changeTab}
                    className="grid w-full grid-cols-2 rounded-xl bg-ntrip-cloud/44 p-0.5 shadow-ntrip-inset-soft"
                >
                    <ToggleGroupItem
                        value="stations"
                        aria-label="Show stations"
                        className="h-8 rounded-xl text-xs font-semibold text-ntrip-ink/62 data-[state=on]:bg-ntrip-cloud/92 data-[state=on]:text-ntrip-ink data-[state=on]:shadow-ntrip-tab"
                    >
                        <RadioTower className="size-3.5" />
                        Stations
                        <span className="text-ntrip-ink/42 tabular-nums">
                            {stations.length}
                        </span>
                    </ToggleGroupItem>

                    <ToggleGroupItem
                        value="rovers"
                        aria-label="Show rovers"
                        className="h-8 rounded-xl text-xs font-semibold text-ntrip-ink/62 data-[state=on]:bg-ntrip-cloud/92 data-[state=on]:text-ntrip-ink data-[state=on]:shadow-ntrip-tab"
                    >
                        <Satellite className="size-3.5" />
                        Rovers
                        <span className="text-ntrip-ink/42 tabular-nums">
                            {rovers.length}
                        </span>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {activeTab === 'stations' ? (
                <>
                    <div className="border-b border-ntrip-ink/8 px-3 py-2.5">
                        <DashboardStationHealthFilter
                            activeFilter={healthFilter}
                            counts={healthCounts}
                            total={stations.length}
                            onChange={setHealthFilter}
                        />

                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />

                            <Input
                                value={stationSearchQuery}
                                onChange={(event) =>
                                    setStationSearchQuery(event.target.value)
                                }
                                placeholder="Search station"
                                className="h-8 rounded-xl border-ntrip-ink/8 bg-ntrip-cloud/62 pl-8 text-xs shadow-none placeholder:text-ntrip-ink/32 focus-visible:ring-ntrip-teal/30"
                            />
                        </div>
                    </div>

                    <div className="min-h-64 max-h-[45dvh] overflow-y-auto p-2 sm:min-h-0 sm:max-h-[calc(70vh-10rem)]">
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
                                            onHoverStation(
                                                hovered ? station.id : null,
                                            )
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
                </>
            ) : (
                <>
                    <div className="border-b border-ntrip-ink/8 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 text-xs text-ntrip-ink/62">
                            <span>{roversOnMap} on map</span>

                            <span>{roversAwaitingGga} awaiting GGA</span>
                        </div>

                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />

                            <Input
                                value={roverSearchQuery}
                                onChange={(event) =>
                                    setRoverSearchQuery(event.target.value)
                                }
                                placeholder="Search rover"
                                className="h-8 rounded-xl border-ntrip-ink/8 bg-ntrip-cloud/62 pl-8 text-xs shadow-none placeholder:text-ntrip-ink/32 focus-visible:ring-ntrip-teal/30"
                            />
                        </div>
                    </div>

                    <div className="min-h-64 max-h-[45dvh] overflow-y-auto p-2 sm:min-h-0 sm:max-h-[calc(70vh-9rem)]">
                        {filteredRovers.length > 0 ? (
                            <div className="grid gap-0.5">
                                {filteredRovers.map((rover) => (
                                    <DashboardRoverRow
                                        key={rover.id}
                                        rover={rover}
                                        selected={
                                            selectedRoverId !== null &&
                                            String(selectedRoverId) ===
                                                String(rover.id)
                                        }
                                        onClick={() => onSelectRover(rover)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="grid min-h-24 place-items-center px-4 text-center">
                                <div>
                                    <p className="text-xs font-semibold">
                                        No matching rovers
                                    </p>

                                    <p className="mt-1 text-xs text-ntrip-ink/62">
                                        Connected rovers will appear here.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
