import { normaliseDashboardSession } from '@/realtime/dashboard-session-normalizer';

import type { NtripSessionRealtimeEvent } from '@/realtime/ntrip-realtime-types';

import type {
    DashboardSession,
    DashboardSnapshot,
    DashboardStation,
    StationHealth,
} from '@/types/ntrip-dashboard';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
    return isRecord(value) ? value : {};
}

function hasOwn(record: UnknownRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key);
}

function asNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function asNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const result = value.trim();

    return result === '' ? null : result;
}

function identifierKey(value: number | string | null): string | null {
    if (value === null) {
        return null;
    }

    return String(value);
}

function sessionKey(session: DashboardSession): string {
    return String(session.id);
}

function parseEventDate(value: string): Date {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normaliseMessageCounts(
    value: unknown,
    fallback: Record<string, number>,
): Record<string, number> {
    if (!isRecord(value)) {
        return fallback;
    }

    return Object.fromEntries(
        Object.entries(value)
            .map(([type, count]) => [type, asNumber(count, 0)])
            .filter(([, count]) => Number(count) > 0),
    );
}

function mergeSessionUpdate(
    current: DashboardSession,
    rawValue: unknown,
): DashboardSession {
    const raw = asRecord(rawValue);

    return {
        ...current,

        lastStatsAt: hasOwn(raw, 'updated_at')
            ? (asNullableString(raw.updated_at) ?? current.lastStatsAt)
            : current.lastStatsAt,

        bytesTransferred: hasOwn(raw, 'bytes_transferred')
            ? asNumber(raw.bytes_transferred, current.bytesTransferred)
            : current.bytesTransferred,

        validRtcmFrames: hasOwn(raw, 'valid_rtcm_frames')
            ? asNumber(raw.valid_rtcm_frames, current.validRtcmFrames)
            : current.validRtcmFrames,

        rtcmCrcErrors: hasOwn(raw, 'rtcm_crc_errors')
            ? asNumber(raw.rtcm_crc_errors, current.rtcmCrcErrors)
            : current.rtcmCrcErrors,

        rtcmMessageCounts: hasOwn(raw, 'rtcm_message_counts')
            ? normaliseMessageCounts(
                  raw.rtcm_message_counts,
                  current.rtcmMessageCounts,
              )
            : current.rtcmMessageCounts,

        disconnectedAt: hasOwn(raw, 'disconnected_at')
            ? asNullableString(raw.disconnected_at)
            : current.disconnectedAt,

        disconnectReason: hasOwn(raw, 'disconnect_reason')
            ? asNullableString(raw.disconnect_reason)
            : current.disconnectReason,
    };
}

function stationKeyForSession(session: DashboardSession): string | null {
    return (
        identifierKey(session.stationId) ??
        identifierKey(session.mountpoint?.station?.id ?? null) ??
        identifierKey(session.mountpoint?.stationId ?? null)
    );
}

function buildHealth(
    station: DashboardStation,
    sourceConnected: boolean,
    uploadBps: number,
): StationHealth {
    if (!station.enabled || !station.deviceOnline) {
        return 'offline';
    }

    if (!sourceConnected || uploadBps <= 0) {
        return 'critical';
    }

    if (
        station.surveyActive ||
        station.crcErrors > 0 ||
        (station.rtcmAgeMs !== null && station.rtcmAgeMs > 1500)
    ) {
        return 'warning';
    }

    return 'healthy';
}

function rebuildStations(
    stations: DashboardStation[],
    sessions: DashboardSession[],
    affectedSession: DashboardSession | null,
    action: 'started' | 'updated' | 'ended',
): DashboardStation[] {
    const roverCountByStation = new Map<string, number>();

    const roverCountByMountpoint = new Map<string, number>();

    const activeSourceStationKeys = new Set<string>();

    for (const session of sessions) {
        const stationKey = stationKeyForSession(session);

        if (session.connectionType === 'source' && stationKey !== null) {
            activeSourceStationKeys.add(stationKey);
        }

        if (session.connectionType !== 'rover') {
            continue;
        }

        if (stationKey !== null) {
            roverCountByStation.set(
                stationKey,
                (roverCountByStation.get(stationKey) ?? 0) + 1,
            );
        }

        const mountpointName = session.mountpoint?.name;

        if (mountpointName) {
            roverCountByMountpoint.set(
                mountpointName,
                (roverCountByMountpoint.get(mountpointName) ?? 0) + 1,
            );
        }
    }

    const affectedSourceStationKey =
        affectedSession?.connectionType === 'source'
            ? stationKeyForSession(affectedSession)
            : null;

    return stations.map((station) => {
        const key = String(station.id);

        const activeRovers =
            roverCountByStation.get(key) ??
            roverCountByMountpoint.get(station.mountpoint) ??
            0;

        let sourceConnected = station.sourceConnected;

        let uploadBps = station.uploadBps;

        if (
            affectedSourceStationKey !== null &&
            affectedSourceStationKey === key
        ) {
            sourceConnected = activeSourceStationKeys.has(key);

            if (action === 'ended' && !sourceConnected) {
                uploadBps = 0;
            }
        }

        return {
            ...station,

            sourceConnected,
            activeRovers,
            uploadBps,

            health: buildHealth(station, sourceConnected, uploadBps),
        };
    });
}

function rebuildSnapshot(
    snapshot: DashboardSnapshot,
    sessions: DashboardSession[],
    affectedSession: DashboardSession | null,
    event: NtripSessionRealtimeEvent,
): DashboardSnapshot {
    const stations = rebuildStations(
        snapshot.stations,
        sessions,
        affectedSession,
        event.action,
    );

    return {
        ...snapshot,

        stations,
        activeSessionItems: sessions,

        activeSources: stations.filter((station) => station.sourceConnected)
            .length,

        activeRovers: sessions.filter(
            (session) => session.connectionType === 'rover',
        ).length,

        activeSessions: sessions.length,

        totalTrafficBps: stations.reduce(
            (total, station) => total + station.uploadBps,
            0,
        ),

        totalCrcErrors: stations.reduce(
            (total, station) => total + station.crcErrors,
            0,
        ),

        lastUpdatedAt: parseEventDate(event.occurred_at),

        usingFallbackData: false,
    };
}

export function applyNtripSessionEvent(
    snapshot: DashboardSnapshot,
    event: NtripSessionRealtimeEvent,
): DashboardSnapshot {
    const rawSession = asRecord(event.session);

    const rawId = rawSession.id;

    if (rawId === null || rawId === undefined || String(rawId).trim() === '') {
        return snapshot;
    }

    const id = String(rawId);

    const currentIndex = snapshot.activeSessionItems.findIndex(
        (session) => sessionKey(session) === id,
    );

    if (event.action === 'started') {
        const newSession = normaliseDashboardSession(rawSession);

        if (newSession === null) {
            return snapshot;
        }

        const sessions = [...snapshot.activeSessionItems];

        if (currentIndex >= 0) {
            sessions[currentIndex] = newSession;
        } else {
            sessions.push(newSession);
        }

        return rebuildSnapshot(snapshot, sessions, newSession, event);
    }

    if (event.action === 'updated') {
        if (currentIndex < 0) {
            return snapshot;
        }

        const sessions = [...snapshot.activeSessionItems];

        sessions[currentIndex] = mergeSessionUpdate(
            sessions[currentIndex],
            rawSession,
        );

        return rebuildSnapshot(
            snapshot,
            sessions,
            sessions[currentIndex],
            event,
        );
    }

    if (event.action === 'ended') {
        const normalisedEndedSession = normaliseDashboardSession(rawSession);

        const affectedSession =
            currentIndex >= 0
                ? mergeSessionUpdate(
                      snapshot.activeSessionItems[currentIndex],
                      rawSession,
                  )
                : normalisedEndedSession;

        if (affectedSession === null) {
            return snapshot;
        }

        const sessions = snapshot.activeSessionItems.filter(
            (session) => sessionKey(session) !== id,
        );

        return rebuildSnapshot(snapshot, sessions, affectedSession, event);
    }

    return snapshot;
}
