import { normaliseDashboardSessions } from '@/realtime/dashboard-session-normalizer';

import type {
    DashboardSnapshot,
    DashboardStation,
    StationHealth,
} from '@/types/ntrip-dashboard';

type UnknownRecord = Record<string, unknown>;

type RoverCountIndex = {
    total: number;
    byStationId: Map<string, number>;
    byMountpointId: Map<string, number>;
    byMountpointName: Map<string, number>;
};

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
    return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
    const result = asString(value).trim();

    return result === '' ? null : result;
}

function asBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        if (value === '1' || value.toLowerCase() === 'true') {
            return true;
        }

        if (value === '0' || value.toLowerCase() === 'false') {
            return false;
        }
    }

    return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
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

function asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = asNumber(value, Number.NaN);

    return Number.isFinite(parsed) ? parsed : null;
}

function firstFiniteNumber(values: unknown[], fallback = Number.NaN): number {
    for (const value of values) {
        const parsed = asNumber(value, Number.NaN);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function asIdentifier(
    value: unknown,
    fallback: number | string,
): number | string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }

    return fallback;
}

function asMapKey(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }

    return null;
}

function parseDate(value: unknown, fallback = new Date()): Date {
    if (typeof value !== 'string') {
        return fallback;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function incrementCount(counts: Map<string, number>, key: string | null): void {
    if (key === null) {
        return;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
}

function buildHealth(input: {
    enabled: boolean;
    deviceOnline: boolean;
    sourceConnected: boolean;
    surveyActive: boolean;
    crcErrors: number;
    rtcmAgeMs: number | null;
    uploadBps: number;
}): StationHealth {
    if (!input.enabled || !input.deviceOnline) {
        return 'offline';
    }

    if (!input.sourceConnected || input.uploadBps <= 0) {
        return 'critical';
    }

    if (
        input.surveyActive ||
        input.crcErrors > 0 ||
        (input.rtcmAgeMs !== null && input.rtcmAgeMs > 1500)
    ) {
        return 'warning';
    }

    return 'healthy';
}

function buildRoverCountIndex(rawSessions: unknown[]): RoverCountIndex {
    const result: RoverCountIndex = {
        total: 0,
        byStationId: new Map<string, number>(),
        byMountpointId: new Map<string, number>(),
        byMountpointName: new Map<string, number>(),
    };

    for (const rawSession of rawSessions) {
        const session = asRecord(rawSession);

        const connectionType = asString(session.connection_type).toLowerCase();

        if (connectionType !== 'rover') {
            continue;
        }

        result.total += 1;

        const mountpoint = asRecord(session.mountpoint);

        const mountpointStation = asRecord(mountpoint.station);

        const stationId =
            asMapKey(session.station_id) ??
            asMapKey(mountpointStation.id) ??
            asMapKey(mountpoint.station_id);

        const mountpointId =
            asMapKey(session.mountpoint_id) ?? asMapKey(mountpoint.id);

        const mountpointName = asNullableString(mountpoint.name);

        incrementCount(result.byStationId, stationId);

        incrementCount(result.byMountpointId, mountpointId);

        incrementCount(result.byMountpointName, mountpointName);
    }

    return result;
}

function normaliseMessageCounts(rawValue: unknown): Record<string, number> {
    const rawCounts = asRecord(rawValue);

    return Object.fromEntries(
        Object.entries(rawCounts)
            .map(([messageType, count]) => [messageType, asNumber(count, 0)])
            .filter(([, count]) => Number(count) > 0),
    );
}

function resolveActiveRoverCount(
    stationId: number | string,
    mountpoint: UnknownRecord,
    roverCounts: RoverCountIndex,
): number {
    const stationKey = asMapKey(stationId);

    if (stationKey !== null) {
        const stationCount = roverCounts.byStationId.get(stationKey);

        if (stationCount !== undefined) {
            return stationCount;
        }
    }

    const mountpointId = asMapKey(mountpoint.id);

    if (mountpointId !== null) {
        const mountpointCount = roverCounts.byMountpointId.get(mountpointId);

        if (mountpointCount !== undefined) {
            return mountpointCount;
        }
    }

    const mountpointName = asNullableString(mountpoint.name);

    if (mountpointName !== null) {
        return roverCounts.byMountpointName.get(mountpointName) ?? 0;
    }

    return 0;
}

function normaliseStation(
    rawValue: unknown,
    index: number,
    roverCounts: RoverCountIndex,
): DashboardStation {
    const station = asRecord(rawValue);
    const mountpoint = asRecord(station.mountpoint);

    const telemetryContainer = asRecord(station.telemetry);

    const telemetry = asRecord(
        telemetryContainer.payload ?? telemetryContainer,
    );

    const network = asRecord(telemetry.network);

    const survey = asRecord(telemetry.survey_in);

    const rtcm = asRecord(telemetry.rtcm);

    const system = asRecord(telemetry.system);

    const id = asIdentifier(station.id, `station-${index + 1}`);

    const deviceId = asString(station.device_id, `STATION-${index + 1}`);

    const name = asString(station.name, deviceId);

    const enabled = asBoolean(station.enabled, true);

    const sourceConnected = asBoolean(
        station.source_connected,
        asBoolean(telemetry.source_connected, false),
    );

    const lastSeenAt = asNullableString(station.last_seen_at);

    const lastSeenTimestamp = lastSeenAt
        ? new Date(lastSeenAt).getTime()
        : Number.NaN;

    const deviceOnline = Number.isFinite(lastSeenTimestamp)
        ? Date.now() - lastSeenTimestamp < 60_000
        : asBoolean(network.connected, sourceConnected);

    const surveyActive = asBoolean(survey.active, false);

    const surveyValid = asBoolean(survey.valid, !surveyActive);

    const uploadBps = asNumber(rtcm.upload_bps, 0);

    const validFrames = asNumber(
        rtcm.frames_valid,
        asNumber(rtcm.valid_frames, 0),
    );

    const crcErrors = asNumber(rtcm.crc_errors, 0);

    const rtcmAgeMs = asNullableNumber(rtcm.age_ms);

    const latitude = firstFiniteNumber([mountpoint.latitude, survey.latitude]);

    const longitude = firstFiniteNumber([
        mountpoint.longitude,
        survey.longitude,
    ]);

    const health = buildHealth({
        enabled,
        deviceOnline,
        sourceConnected,
        surveyActive,
        crcErrors,
        rtcmAgeMs,
        uploadBps,
    });

    return {
        id,
        deviceId,
        name,

        enabled,
        health,

        sourceConnected,
        deviceOnline,

        mountpoint: asString(mountpoint.name, 'Unassigned'),

        latitude,
        longitude,

        firmwareVersion: asString(
            station.firmware_version,
            asString(telemetry.firmware_version, 'Unknown'),
        ),

        lastSeenAt,

        networkType: asString(network.type, 'unknown'),

        ipAddress:
            asNullableString(network.ip) ??
            asNullableString(network.ip_address) ??
            asNullableString(station.last_ip),

        surveyValid,
        surveyActive,

        uploadBps,
        validFrames,
        crcErrors,
        rtcmAgeMs,

        temperatureC: asNullableNumber(system.temperature_c),

        freeHeapBytes: asNullableNumber(system.free_heap_bytes),

        activeRovers: resolveActiveRoverCount(id, mountpoint, roverCounts),

        messageCounts: normaliseMessageCounts(rtcm.message_counts),
    };
}

function readSummaryNumber(
    summary: UnknownRecord,
    key: string,
    fallback: number,
): number {
    const value = asNumber(summary[key], fallback);

    return Math.max(0, value);
}

export function normaliseDashboardSnapshot(
    rawResponse: unknown,
): DashboardSnapshot {
    const response = asRecord(rawResponse);

    if (response.success === false) {
        throw new Error(
            asString(
                response.message,
                'The dashboard snapshot request failed.',
            ),
        );
    }

    const data = asRecord(response.data ?? response);

    const rawStations = asArray(data.stations);

    const rawSessions = asArray(data.active_sessions);

    const activeSessionItems = normaliseDashboardSessions(rawSessions);

    const summary = asRecord(data.summary);

    const roverCounts = buildRoverCountIndex(rawSessions);

    const stations = rawStations.map((station, index) =>
        normaliseStation(station, index, roverCounts),
    );

    const computedActiveSources = stations.filter(
        (station) => station.sourceConnected,
    ).length;

    const computedTrafficBps = stations.reduce(
        (total, station) => total + station.uploadBps,
        0,
    );

    const computedCrcErrors = stations.reduce(
        (total, station) => total + station.crcErrors,
        0,
    );

    return {
        stations,
        activeSessionItems,
        activeSources: readSummaryNumber(
            summary,
            'active_sources',
            computedActiveSources,
        ),

        activeRovers: readSummaryNumber(
            summary,
            'active_rovers',
            roverCounts.total,
        ),

        activeSessions: readSummaryNumber(
            summary,
            'active_sessions',
            activeSessionItems.length,
        ),

        totalTrafficBps: readSummaryNumber(
            summary,
            'total_traffic_bps',
            computedTrafficBps,
        ),

        totalCrcErrors: readSummaryNumber(
            summary,
            'total_crc_errors',
            computedCrcErrors,
        ),

        lastUpdatedAt: parseDate(data.generated_at),

        usingFallbackData: false,
    };
}
