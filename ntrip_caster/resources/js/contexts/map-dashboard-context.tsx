import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
    type RefObject,
    type SetStateAction,
} from 'react';

import type {
    NtripMapHandle,
    StationMapAnchor,
} from '@/components/map-dashboard/ntrip-map';
import type { useDashboardData } from '@/hooks/use-dashboard-data';
import type { DashboardStation } from '@/types/ntrip-dashboard';

type DashboardData = ReturnType<typeof useDashboardData>;
type StationId = DashboardStation['id'];

export type MapDashboardContextValue = DashboardData & {
    mapRef: RefObject<NtripMapHandle | null>;

    selectedStationId: StationId | null;
    selectedStation: DashboardStation | null;
    setSelectedStationId: Dispatch<SetStateAction<StationId | null>>;

    hoveredStationId: StationId | null;
    setHoveredStationId: (stationId: StationId | null) => void;

    activeStationId: StationId | null;
    activeStation: DashboardStation | null;

    stationMapAnchor: StationMapAnchor | null;
};

const MapDashboardContext = createContext<MapDashboardContextValue | undefined>(
    undefined,
);

type MapDashboardProviderProps = {
    value: MapDashboardContextValue;
    children: ReactNode;
};

export function MapDashboardProvider({
    value,
    children,
}: MapDashboardProviderProps) {
    return (
        <MapDashboardContext.Provider value={value}>
            {children}
        </MapDashboardContext.Provider>
    );
}

export function useMapDashboard(): MapDashboardContextValue {
    const context = useContext(MapDashboardContext);

    if (context === undefined) {
        throw new Error(
            'useMapDashboard must be used inside MapDashboardProvider.',
        );
    }

    return context;
}
