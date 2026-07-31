import type { NtripMapModelEntity } from '@/components/map-dashboard/ntrip-three-model-layer';
import { hasRoverMapPosition } from '@/realtime/dashboard-session-selectors';
import type {
    DashboardRoverSession,
    DashboardStation,
} from '@/types/ntrip-dashboard';

const STATION_MODEL_SCALE_METERS = 35;
const ROVER_MODEL_SCALE_METERS = 12;

export type NtripMapCoordinate = {
    longitude: number;
    latitude: number;
};

export function hasStationMapPosition(station: DashboardStation): boolean {
    return (
        Number.isFinite(station.longitude) &&
        Number.isFinite(station.latitude) &&
        station.longitude >= -180 &&
        station.longitude <= 180 &&
        station.latitude >= -90 &&
        station.latitude <= 90
    );
}

export function buildStationEntityId(
    stationId: DashboardStation['id'],
): string {
    return `station:${String(stationId)}`;
}

export function buildRoverEntityId(
    sessionId: DashboardRoverSession['id'],
): string {
    return `rover:${String(sessionId)}`;
}

export function buildNtripMapEntities(
    stations: DashboardStation[],
    rovers: DashboardRoverSession[],
    selectedStationId: DashboardStation['id'] | null,
): NtripMapModelEntity[] {
    const stationEntities = stations
        .filter(hasStationMapPosition)
        .map<NtripMapModelEntity>((station) => ({
            id: buildStationEntityId(station.id),
            kind: 'station',

            longitude: station.longitude,
            latitude: station.latitude,

            altitude: 0,
            scaleMeters: STATION_MODEL_SCALE_METERS,

            selected:
                selectedStationId !== null &&
                String(station.id) === String(selectedStationId),
        }));

    /*
     * hasRoverMapPosition() loại bỏ hoàn toàn Rover chưa có GGA
     * hoặc chưa có tọa độ hợp lệ khỏi bản đồ.
     */
    const roverEntities = rovers
        .filter(hasRoverMapPosition)
        .map<NtripMapModelEntity>((rover) => ({
            id: buildRoverEntityId(rover.id),
            kind: 'rover',

            longitude: rover.roverLongitude,
            latitude: rover.roverLatitude,

            /*
             * Không dùng altitude AMSL để đặt độ cao Three.js.
             * Raster map hiện tại không có địa hình để quy đổi chính xác.
             */
            altitude: 0,

            scaleMeters: ROVER_MODEL_SCALE_METERS,
            selected: false,
        }));

    return [...stationEntities, ...roverEntities];
}

export function collectNetworkCoordinates(
    stations: DashboardStation[],
    rovers: DashboardRoverSession[],
): NtripMapCoordinate[] {
    const stationCoordinates = stations
        .filter(hasStationMapPosition)
        .map<NtripMapCoordinate>((station) => ({
            longitude: station.longitude,
            latitude: station.latitude,
        }));

    const roverCoordinates = rovers
        .filter(hasRoverMapPosition)
        .map<NtripMapCoordinate>((rover) => ({
            longitude: rover.roverLongitude,
            latitude: rover.roverLatitude,
        }));

    return [...stationCoordinates, ...roverCoordinates];
}
