import { Head } from '@inertiajs/react';
import {
    Activity,
    RadioTower,
    Route,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { hasRoverMapPosition } from '@/realtime/dashboard-session-selectors';
import type {
    DashboardRoverSession,
    DashboardStation,
} from '@/types/ntrip-dashboard';

import { DashboardMapControls } from './components/dashboard-map-controls';
import { DashboardMetricsDock } from './components/dashboard-metrics-dock';
import { DashboardNetworkDirectory } from './components/dashboard-network-directory';
import type { DashboardDirectoryTab } from './components/dashboard-network-directory';
import type { DashboardMetric } from './components/dashboard-types';
import { StationMapDetailCard } from './components/station-map-detail-card';
import { formatBps, formatInteger } from './lib/dashboard-formatters';

export default function Dashboard() {
    const {
        stations,
        roverSessions,

        activeSources,
        activeRovers,
        activeSessions,

        totalTrafficBps,
        totalCrcErrors,

        mapRef,

        selectedStationId,
        selectedStation,

        hoveredStationId,
        activeStation,
        stationMapAnchor,

        setSelectedStationId,
        setHoveredStationId,
    } = useMapDashboard();

    const [directoryTab, setDirectoryTab] =
        useState<DashboardDirectoryTab>('stations');

    const [selectedRoverId, setSelectedRoverId] = useState<
        DashboardRoverSession['id'] | null
    >(null);

    const selectedRover = useMemo(
        () =>
            roverSessions.find(
                (rover) => String(rover.id) === String(selectedRoverId),
            ) ?? null,
        [roverSessions, selectedRoverId],
    );

    /*
     * Khi Rover disconnect, session biến mất khỏi roverSessions.
     * Giá trị selection hiển thị tự động trở về null.
     */
    const resolvedSelectedRoverId = selectedRover?.id ?? null;

    const metrics = useMemo<DashboardMetric[]>(
        () => [
            {
                label: 'Stations',
                value: String(stations.length),
                hint: `${activeSources} source online`,
                icon: RadioTower,
                tone: 'ink',
                points: [2, 2, 3, 3, 3, 3, stations.length],
            },
            {
                label: 'Active sources',
                value: String(activeSources),
                hint: `${stations.length - activeSources} unavailable`,
                icon: Activity,
                tone: 'teal',
                points: [1, 2, 2, 3, 2, 2, activeSources],
            },
            {
                label: 'Connected rovers',
                value: String(activeRovers),
                hint: `${activeSessions} sessions`,
                icon: Users,
                tone: 'teal',
                points: [1, 1, 2, 2, 4, 3, activeRovers],
            },
            {
                label: 'RTCM traffic',
                value: formatBps(totalTrafficBps),
                unit: 'bps',
                hint: 'Aggregate upload',
                icon: Route,
                tone: 'amber',
                points: [7, 9, 8, 10, 11, 9, totalTrafficBps / 1000],
            },
            {
                label: 'CRC errors',
                value: formatInteger(totalCrcErrors),
                hint: totalCrcErrors === 0 ? 'No errors' : 'Needs attention',
                icon: TriangleAlert,
                tone: totalCrcErrors === 0 ? 'teal' : 'coral',
                points: [0, 0, 0, 1, 1, 2, totalCrcErrors],
            },
        ],
        [
            activeRovers,
            activeSessions,
            activeSources,
            stations.length,
            totalCrcErrors,
            totalTrafficBps,
        ],
    );

    const selectStation = (station: DashboardStation): void => {
        setDirectoryTab('stations');
        setSelectedRoverId(null);

        setHoveredStationId(null);
        setSelectedStationId(station.id);

        window.setTimeout(() => {
            mapRef.current?.focusSelected();
        }, 0);
    };

    const selectRover = (rover: DashboardRoverSession): void => {
        setDirectoryTab('rovers');

        setHoveredStationId(null);
        setSelectedStationId(null);

        setSelectedRoverId(rover.id);

        /*
         * Rover chưa có GGA hoặc chưa có tọa độ:
         * chỉ chọn trong danh sách, không di chuyển map.
         */
        if (!hasRoverMapPosition(rover)) {
            return;
        }

        window.setTimeout(() => {
            mapRef.current?.focusCoordinates(
                rover.roverLongitude,
                rover.roverLatitude,
            );
        }, 0);
    };

    const focusSelectedItem = (): void => {
        if (selectedStationId !== null) {
            mapRef.current?.focusSelected();

            return;
        }

        if (selectedRover && hasRoverMapPosition(selectedRover)) {
            mapRef.current?.focusCoordinates(
                selectedRover.roverLongitude,
                selectedRover.roverLatitude,
            );
        }
    };

    return (
        <>
            <Head title="NTRIP Network Overview" />

            <div className="pointer-events-none absolute inset-0 min-h-0">
                <DashboardMapControls
                    onZoomIn={() => mapRef.current?.zoomIn()}
                    onZoomOut={() => mapRef.current?.zoomOut()}
                    onFitNetwork={() => mapRef.current?.fitNetwork()}
                    onFocusSelected={focusSelectedItem}
                />

                <DashboardNetworkDirectory
                    activeTab={directoryTab}
                    stations={stations}
                    rovers={roverSessions}
                    selectedStationId={selectedStationId}
                    selectedRoverId={resolvedSelectedRoverId}
                    onTabChange={setDirectoryTab}
                    onSelectStation={selectStation}
                    onHoverStation={setHoveredStationId}
                    onSelectRover={selectRover}
                />

                <DashboardMetricsDock metrics={metrics} />

                {activeStation &&
                stationMapAnchor &&
                String(stationMapAnchor.stationId) ===
                    String(activeStation.id) ? (
                    <StationMapDetailCard
                        station={activeStation}
                        anchor={stationMapAnchor}
                        persistent={
                            selectedStation !== null &&
                            hoveredStationId === null
                        }
                        onClose={() => {
                            setHoveredStationId(null);

                            setSelectedStationId(null);
                        }}
                        onHoverChange={(hovered) =>
                            setHoveredStationId(
                                hovered ? activeStation.id : null,
                            )
                        }
                    />
                ) : null}
            </div>
        </>
    );
}
