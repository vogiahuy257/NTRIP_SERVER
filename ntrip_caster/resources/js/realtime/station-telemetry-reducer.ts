import type {
    DashboardSnapshot,
    DashboardStation,
    StationHealth,
} from '@/types/ntrip-dashboard';

import type { StationTelemetryUpdatedEvent } from './ntrip-realtime-types';

type UnknownRecord = Record<string, unknown>;

export type StationTelemetryApplyResult = {
    matched: boolean;
    snapshot: DashboardSnapshot;
};

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
    return isRecord(value) ? value : {};
}

function hasOwn(record: UnknownRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key);
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNonEmptyString(value: unknown, fallback: string): string {
    const result = asString(value).trim();

    return result === '' ? fallback : result;
}

function asNullableString(value: unknown): string | null {
    const result = asString(value).trim();

    return result === '' ? null : result;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalised = value.trim().toLowerCase();

        if (normalised === 'true' || normalised === '1') {
            return true;
        }

        if (normalised === 'false' || normalised === '0') {
            return false;
        }
    }

    return fallback;
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

function asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = asNumber(value, Number.NaN);

    return Number.isFinite(parsed) ? parsed : null;
}

function readNumberField(
    record: UnknownRecord,
    keys: string[],
    fallback: number,
): number {
    for (const key of keys) {
        if (!hasOwn(record, key)) {
            continue;
        }

        return asNumber(record[key], fallback);
    }

    return fallback;
}

function readNullableNumberField(
    record: UnknownRecord,
    key: string,
    fallback: number | null,
): number | null {
    if (!hasOwn(record, key)) {
        return fallback;
    }

    return asNullableNumber(record[key]);
}

function parseEventDate(value: string | null): Date {
    if (value === null) {
        return new Date();
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isRecentTimestamp(value: string | null): boolean | null {
    if (value === null) {
        return null;
    }

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    return Date.now() - timestamp < 60_000;
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

function readMessageCounts(
    rtcm: UnknownRecord,
    current: Record<string, number>,
): Record<string, number> {
    if (!hasOwn(rtcm, 'message_counts')) {
        return current;
    }

    const rawCounts = asRecord(rtcm.message_counts);

    return Object.fromEntries(
        Object.entries(rawCounts)
            .map(([messageType, count]) => [messageType, asNumber(count, 0)])
            .filter(([, count]) => Number(count) > 0),
    );
}

function stationMatchesEvent(
    station: DashboardStation,
    eventStation: UnknownRecord,
): boolean {
    const eventId = eventStation.id;

    if (
        eventId !== null &&
        eventId !== undefined &&
        String(station.id) === String(eventId)
    ) {
        return true;
    }

    const eventDeviceId = asString(eventStation.device_id);

    return eventDeviceId !== '' && station.deviceId === eventDeviceId;
}

function mergeStationTelemetry(
    current: DashboardStation,
    event: StationTelemetryUpdatedEvent,
): DashboardStation {
    const eventStation = asRecord(event.station);

    const telemetry = asRecord(event.telemetry);

    const network = asRecord(telemetry.network);

    const survey = asRecord(telemetry.survey_in);

    const rtcm = asRecord(telemetry.rtcm);

    const system = asRecord(telemetry.system);

    const enabled = asBoolean(eventStation.enabled, current.enabled);

    const sourceConnected = asBoolean(
        eventStation.source_connected,
        asBoolean(telemetry.source_connected, current.sourceConnected),
    );

    const occurredAt =
        asNullableString(event.occurred_at) ??
        asNullableString(event.received_at);

    const lastSeenAt =
        asNullableString(eventStation.last_seen_at) ??
        occurredAt ??
        current.lastSeenAt;

    const recentLastSeen = isRecentTimestamp(lastSeenAt);

    const deviceOnline =
        recentLastSeen ??
        asBoolean(network.connected, current.deviceOnline || sourceConnected);

    const surveyActive = hasOwn(survey, 'active')
        ? asBoolean(survey.active, current.surveyActive)
        : current.surveyActive;

    const surveyValid = hasOwn(survey, 'valid')
        ? asBoolean(survey.valid, current.surveyValid)
        : current.surveyValid;

    const uploadBps = readNumberField(rtcm, ['upload_bps'], current.uploadBps);

    const validFrames = readNumberField(
        rtcm,
        ['frames_valid', 'valid_frames'],
        current.validFrames,
    );

    const crcErrors = readNumberField(rtcm, ['crc_errors'], current.crcErrors);

    const rtcmAgeMs = readNullableNumberField(
        rtcm,
        'age_ms',
        current.rtcmAgeMs,
    );

    const surveyLatitude = asNumber(survey.latitude, Number.NaN);

    const surveyLongitude = asNumber(survey.longitude, Number.NaN);

    const latitude = Number.isFinite(surveyLatitude)
        ? surveyLatitude
        : current.latitude;

    const longitude = Number.isFinite(surveyLongitude)
        ? surveyLongitude
        : current.longitude;

    const eventIpAddress =
        asNullableString(network.ip) ?? asNullableString(network.ip_address);

    const temperatureC = readNullableNumberField(
        system,
        'temperature_c',
        current.temperatureC,
    );

    const freeHeapBytes = readNullableNumberField(
        system,
        'free_heap_bytes',
        current.freeHeapBytes,
    );

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
        ...current,

        name: asNonEmptyString(eventStation.name, current.name),

        enabled,
        health,

        sourceConnected,
        deviceOnline,

        latitude,
        longitude,

        firmwareVersion: asNonEmptyString(
            eventStation.firmware_version,
            asNonEmptyString(
                telemetry.firmware_version,
                current.firmwareVersion,
            ),
        ),

        lastSeenAt,

        networkType: asNonEmptyString(network.type, current.networkType),

        ipAddress: eventIpAddress ?? current.ipAddress,

        surveyValid,
        surveyActive,

        uploadBps,
        validFrames,
        crcErrors,
        rtcmAgeMs,

        temperatureC,
        freeHeapBytes,

        messageCounts: readMessageCounts(rtcm, current.messageCounts),
    };
}

export function applyStationTelemetryUpdated(
    currentSnapshot: DashboardSnapshot,
    event: StationTelemetryUpdatedEvent,
): StationTelemetryApplyResult {
    const eventStation = asRecord(event.station);

    const stationIndex = currentSnapshot.stations.findIndex((station) =>
        stationMatchesEvent(station, eventStation),
    );

    if (stationIndex < 0) {
        return {
            matched: false,
            snapshot: currentSnapshot,
        };
    }

    const stations = [...currentSnapshot.stations];

    stations[stationIndex] = mergeStationTelemetry(
        stations[stationIndex],
        event,
    );

    const activeSources = stations.filter(
        (station) => station.sourceConnected,
    ).length;

    const totalTrafficBps = stations.reduce(
        (total, station) => total + station.uploadBps,
        0,
    );

    const totalCrcErrors = stations.reduce(
        (total, station) => total + station.crcErrors,
        0,
    );

    const eventTimestamp =
        asNullableString(event.occurred_at) ??
        asNullableString(event.received_at);

    return {
        matched: true,

        snapshot: {
            ...currentSnapshot,

            stations,

            activeSources,
            totalTrafficBps,
            totalCrcErrors,

            lastUpdatedAt: parseEventDate(eventTimestamp),

            usingFallbackData: false,
        },
    };
}
