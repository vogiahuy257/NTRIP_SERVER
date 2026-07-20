import { Head } from '@inertiajs/react';
import {
    Activity,
    RadioTower,
    Route,
    TriangleAlert,
    Users,
} from 'lucide-react';

import { useMemo } from 'react';

import { useMapDashboard } from '@/contexts/map-dashboard-context';

import { DashboardMapControls } from './components/dashboard-map-controls';
import { DashboardMetricsDock } from './components/dashboard-metrics-dock';
import { DashboardStationList } from './components/dashboard-station-list';
import type { DashboardMetric } from './components/dashboard-types';
import { StationMapDetailCard } from './components/station-map-detail-card';
import { formatBps, formatInteger } from './lib/dashboard-formatters';

export default function Dashboard() {
    const {
        stations,
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

    const selectStation = (stationId: (typeof stations)[number]['id']) => {
        setHoveredStationId(null);
        setSelectedStationId(stationId);

        window.setTimeout(() => {
            mapRef.current?.focusSelected();
        }, 0);
    };

    return (
        <>
            <Head title="NTRIP Network Overview" />

            <div className="pointer-events-none absolute inset-0 min-h-0">
                <DashboardMapControls
                    onZoomIn={() => mapRef.current?.zoomIn()}
                    onZoomOut={() => mapRef.current?.zoomOut()}
                    onFitStations={() => mapRef.current?.fitStations()}
                    onFocusSelected={() => mapRef.current?.focusSelected()}
                />

                <DashboardStationList
                    stations={stations}
                    selectedStationId={selectedStationId}
                    onSelectStation={(station) => selectStation(station.id)}
                    onHoverStation={setHoveredStationId}
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
