import type {
    DashboardSession,
    DashboardStation,
} from '@/types/ntrip-dashboard';

import type { ActiveSession, MountpointRecord } from '../types';

function identifierKey(
    value: number | string | null | undefined,
): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const result = String(value).trim();

    return result === '' ? null : result;
}

/**
 * Chuyển session chuẩn của Dashboard realtime
 * sang kiểu dữ liệu mà Mountpoint UI đang sử dụng.
 */
export function mapDashboardSessionsToActiveSessions(
    sessions: DashboardSession[],
): ActiveSession[] {
    return sessions.map((session) => ({
        id: String(session.id),

        mountpointId:
            identifierKey(session.mountpointId) ??
            identifierKey(session.mountpoint?.id),

        connectionType: session.connectionType,

        remoteIp: session.remoteIp,

        username: session.authenticatedUsername,

        connectedAt: session.connectedAt,

        bytesTransferred: session.bytesTransferred,
    }));
}

/**
 * Ghép runtime station realtime vào metadata Mountpoint.
 *
 * Mountpoint API tiếp tục là nguồn dữ liệu cho:
 * - format
 * - identifier
 * - access configuration
 * - latitude/longitude
 *
 * Dashboard realtime là nguồn dữ liệu cho:
 * - source connected
 * - traffic
 * - CRC
 * - RTCM age
 * - last seen
 */
export function mergeRealtimeStationsIntoMountpoints(
    mountpoints: MountpointRecord[],
    stations: DashboardStation[],
): MountpointRecord[] {
    const stationById = new Map<string, DashboardStation>();
    const stationByDeviceId = new Map<string, DashboardStation>();
    const stationByMountpointName = new Map<string, DashboardStation>();

    for (const station of stations) {
        stationById.set(String(station.id), station);

        stationByDeviceId.set(station.deviceId, station);

        if (station.mountpoint !== '') {
            stationByMountpointName.set(station.mountpoint, station);
        }
    }

    return mountpoints.map((mountpoint) => {
        const currentStation = mountpoint.station;

        const realtimeStation =
            (currentStation ? stationById.get(currentStation.id) : undefined) ??
            (currentStation
                ? stationByDeviceId.get(currentStation.deviceId)
                : undefined) ??
            stationByMountpointName.get(mountpoint.name);

        if (!realtimeStation) {
            return mountpoint;
        }

        return {
            ...mountpoint,

            station: {
                id: String(realtimeStation.id),
                deviceId: realtimeStation.deviceId,
                name: realtimeStation.name,
                sourceConnected: realtimeStation.sourceConnected,
                lastSeenAt: realtimeStation.lastSeenAt,
            },

            uploadBps: realtimeStation.uploadBps,
            crcErrors: realtimeStation.crcErrors,
            dataAgeMs: realtimeStation.rtcmAgeMs,
        };
    });
}
