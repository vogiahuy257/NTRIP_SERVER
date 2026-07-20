import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { MapTopNavigation } from '@/components/map-dashboard/map-top-navigation';
import {
    NtripMap,
    type NtripMapHandle,
    type StationMapAnchor,
} from '@/components/map-dashboard/ntrip-map';
import {
    MapDashboardProvider,
    type MapDashboardContextValue,
} from '@/contexts/map-dashboard-context';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import type { DashboardStation } from '@/types/ntrip-dashboard';

type MapDashboardLayoutProps = {
    children: ReactNode;
};

export default function MapDashboardLayout({
    children,
}: MapDashboardLayoutProps) {
    const dashboardData = useDashboardData();
    const { stations } = dashboardData;

    const mapRef = useRef<NtripMapHandle | null>(null);

    const [selectedStationId, setSelectedStationId] = useState<
        DashboardStation['id'] | null
    >(null);

    const [hoveredStationId, setHoveredStationIdState] = useState<
        DashboardStation['id'] | null
    >(null);

    const hoverClearTimeoutRef = useRef<number | null>(null);

    const [stationMapAnchor, setStationMapAnchor] =
        useState<StationMapAnchor | null>(null);

    const setHoveredStationId = useCallback(
        (stationId: DashboardStation['id'] | null) => {
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

    useEffect(() => {
        setSelectedStationId((currentStationId) => {
            if (currentStationId === null) {
                return null;
            }

            const stationStillExists = stations.some(
                (station) => String(station.id) === String(currentStationId),
            );

            return stationStillExists ? currentStationId : null;
        });

        setHoveredStationIdState((currentStationId) => {
            if (currentStationId === null) {
                return null;
            }

            const stationStillExists = stations.some(
                (station) => String(station.id) === String(currentStationId),
            );

            return stationStillExists ? currentStationId : null;
        });
    }, [stations]);

    const selectedStation = useMemo(
        () =>
            stations.find(
                (station) => String(station.id) === String(selectedStationId),
            ) ?? null,
        [selectedStationId, stations],
    );

    const activeStationId = hoveredStationId ?? selectedStationId;

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

            selectedStationId,
            selectedStation,
            setSelectedStationId,

            hoveredStationId,
            setHoveredStationId,

            activeStationId,
            activeStation,
            stationMapAnchor,
        }),
        [
            activeStation,
            activeStationId,
            dashboardData,
            hoveredStationId,
            selectedStation,
            selectedStationId,
            stationMapAnchor,
            setHoveredStationId,
        ],
    );

    return (
        <MapDashboardProvider value={contextValue}>
            <main className="ntrip-dashboard fixed inset-0 isolate z-[60] h-dvh w-screen overflow-hidden font-sans">
                <NtripMap
                    ref={mapRef}
                    stations={stations}
                    selectedStationId={selectedStationId}
                    activeStationId={activeStationId}
                    onSelectStation={(stationId) => {
                        setHoveredStationId(null);
                        setSelectedStationId(stationId);
                    }}
                    onHoverStation={setHoveredStationId}
                    onStationAnchorChange={setStationMapAnchor}
                />

                <div className="ntrip-map-overlay pointer-events-none absolute inset-0 z-10" />

                <div className="pointer-events-none absolute inset-1.5 z-20 grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5 sm:inset-2 sm:gap-2 lg:inset-3 lg:gap-3">
                    <MapTopNavigation />

                    <div className="pointer-events-none relative min-h-0 min-w-0 overflow-hidden">
                        {children}
                    </div>
                </div>
            </main>
        </MapDashboardProvider>
    );
}
