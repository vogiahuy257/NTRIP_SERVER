import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { MapTopNavigation } from '@/components/map-dashboard/map-top-navigation';
import { NtripMap } from '@/components/map-dashboard/ntrip-map';
import type {
    NtripMapHandle,
    StationMapAnchor,
} from '@/components/map-dashboard/ntrip-map';
import { MapDashboardProvider } from '@/contexts/map-dashboard-context';
import type { MapDashboardContextValue } from '@/contexts/map-dashboard-context';
import { PendingDeviceProvider } from '@/features/pending-devices/pending-device-context';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import type { DashboardStation } from '@/types/ntrip-dashboard';

type MapDashboardLayoutProps = {
    children: ReactNode;
};

export default function MapDashboardLayout({
    children,
}: MapDashboardLayoutProps) {
    const dashboardData = useDashboardData();
    const { roverSessions, stations } = dashboardData;

    const mapRef = useRef<NtripMapHandle | null>(null);

    const [selectedStationId, setSelectedStationId] = useState<
        DashboardStation['id'] | null
    >(null);

    const [hoveredStationId, setHoveredStationIdState] = useState<
        DashboardStation['id'] | null
    >(null);

    const [stationMapAnchor, setStationMapAnchor] =
        useState<StationMapAnchor | null>(null);

    const hoverClearTimeoutRef = useRef<number | null>(null);

    const setHoveredStationId = useCallback(
        (stationId: DashboardStation['id'] | null): void => {
            if (hoverClearTimeoutRef.current !== null) {
                window.clearTimeout(hoverClearTimeoutRef.current);
                hoverClearTimeoutRef.current = null;
            }

            if (stationId !== null) {
                setHoveredStationIdState(stationId);

                return;
            }

            hoverClearTimeoutRef.current = window.setTimeout(() => {
                setHoveredStationIdState(null);
                hoverClearTimeoutRef.current = null;
            }, 120);
        },
        [],
    );

    useEffect(() => {
        const rootElement = document.documentElement;
        const previousValue = rootElement.getAttribute('data-ntrip-dashboard');

        rootElement.setAttribute('data-ntrip-dashboard', 'true');

        return () => {
            if (hoverClearTimeoutRef.current !== null) {
                window.clearTimeout(hoverClearTimeoutRef.current);
                hoverClearTimeoutRef.current = null;
            }

            if (previousValue === null) {
                rootElement.removeAttribute('data-ntrip-dashboard');

                return;
            }

            rootElement.setAttribute('data-ntrip-dashboard', previousValue);
        };
    }, []);

    const stationIds = useMemo(
        () => new Set(stations.map((station) => String(station.id))),
        [stations],
    );

    const resolvedSelectedStationId =
        selectedStationId !== null && stationIds.has(String(selectedStationId))
            ? selectedStationId
            : null;

    const resolvedHoveredStationId =
        hoveredStationId !== null && stationIds.has(String(hoveredStationId))
            ? hoveredStationId
            : null;

    const selectedStation = useMemo(
        () =>
            stations.find(
                (station) =>
                    String(station.id) === String(resolvedSelectedStationId),
            ) ?? null,
        [resolvedSelectedStationId, stations],
    );

    const activeStationId =
        resolvedHoveredStationId ?? resolvedSelectedStationId;

    const activeStation = useMemo(
        () =>
            stations.find(
                (station) => String(station.id) === String(activeStationId),
            ) ?? null,
        [activeStationId, stations],
    );

    const contextValue = useMemo<MapDashboardContextValue>(
        () => ({
            ...dashboardData,
            mapRef,

            selectedStationId: resolvedSelectedStationId,
            selectedStation,
            setSelectedStationId,

            hoveredStationId: resolvedHoveredStationId,
            setHoveredStationId,

            activeStationId,
            activeStation,
            stationMapAnchor,
        }),
        [
            activeStation,
            activeStationId,
            dashboardData,
            resolvedHoveredStationId,
            resolvedSelectedStationId,
            selectedStation,
            stationMapAnchor,
            setHoveredStationId,
        ],
    );

    return (
        <MapDashboardProvider value={contextValue}>
            <PendingDeviceProvider>
                <main className="ntrip-dashboard fixed inset-0 isolate z-[60] h-dvh w-screen overflow-hidden font-sans">
                    <NtripMap
                        ref={mapRef}
                        stations={stations}
                        rovers={roverSessions}
                        selectedStationId={resolvedSelectedStationId}
                        activeStationId={activeStationId}
                        onSelectStation={(stationId) => {
                            setHoveredStationId(null);
                            setSelectedStationId(stationId);
                        }}
                        onHoverStation={setHoveredStationId}
                        onStationAnchorChange={setStationMapAnchor}
                    />

                    <div className="ntrip-map-overlay pointer-events-none absolute inset-0 z-10" />

                    <div className="ntrip-safe-frame pointer-events-none absolute z-20 grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5 sm:gap-2 lg:gap-3">
                        <MapTopNavigation />

                        <div className="pointer-events-none relative min-h-0 min-w-0 overflow-hidden">
                            {children}
                        </div>
                    </div>
                </main>
            </PendingDeviceProvider>
        </MapDashboardProvider>
    );
}
