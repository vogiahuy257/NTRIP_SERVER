import type {
    DashboardSession,
    DashboardSessionMountpoint,
    DashboardSessionStation,
    NtripSessionConnectionType,
} from '@/types/ntrip-dashboard';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
    return isRecord(value) ? value : {};
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
    const result = asString(value).trim();

    return result === '' ? null : result;
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

function asIdentifier(value: unknown): number | string | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }

    return null;
}

function normaliseConnectionType(
    value: unknown,
): NtripSessionConnectionType | null {
    const type = asString(value).trim().toLowerCase();

    if (type === 'source') {
        return 'source';
    }

    if (type === 'rover') {
        return 'rover';
    }

    return null;
}

function normaliseMessageCounts(value: unknown): Record<string, number> {
    const counts = asRecord(value);

    return Object.fromEntries(
        Object.entries(counts)
            .map(([messageType, count]) => [messageType, asNumber(count, 0)])
            .filter(([, count]) => Number(count) > 0),
    );
}

function normaliseStation(value: unknown): DashboardSessionStation | null {
    const station = asRecord(value);

    const id = asIdentifier(station.id);

    if (id === null) {
        return null;
    }

    return {
        id,

        deviceId: asString(station.device_id, `STATION-${String(id)}`),

        name: asString(
            station.name,
            asString(station.device_id, `Station ${String(id)}`),
        ),
    };
}

function normaliseMountpoint(
    value: unknown,
): DashboardSessionMountpoint | null {
    const mountpoint = asRecord(value);

    const id = asIdentifier(mountpoint.id);

    if (id === null) {
        return null;
    }

    return {
        id,

        stationId: asIdentifier(mountpoint.station_id),

        name: asString(mountpoint.name, `Mountpoint ${String(id)}`),

        station: normaliseStation(mountpoint.station),
    };
}

export function normaliseDashboardSession(
    value: unknown,
): DashboardSession | null {
    const session = asRecord(value);

    const id = asIdentifier(session.id);

    const connectionType = normaliseConnectionType(session.connection_type);

    if (id === null || connectionType === null) {
        return null;
    }

    return {
        id,

        mountpointId: asIdentifier(session.mountpoint_id),

        stationId: asIdentifier(session.station_id),

        roverAccountId: asIdentifier(session.rover_account_id),

        connectionType,

        authenticatedUsername: asNullableString(session.authenticated_username),

        clientAgent: asNullableString(session.client_agent),

        ntripVersion: asNullableString(session.ntrip_version),

        remoteIp: asNullableString(session.remote_ip),

        connectedAt: asNullableString(session.connected_at),

        disconnectedAt: asNullableString(session.disconnected_at),

        lastStatsAt:
            asNullableString(session.updated_at) ??
            asNullableString(session.connected_at),

        bytesTransferred: asNumber(session.bytes_transferred, 0),

        disconnectReason: asNullableString(session.disconnect_reason),

        validRtcmFrames: asNumber(session.valid_rtcm_frames, 0),

        rtcmCrcErrors: asNumber(session.rtcm_crc_errors, 0),

        rtcmMessageCounts: normaliseMessageCounts(session.rtcm_message_counts),

        mountpoint: normaliseMountpoint(session.mountpoint),
    };
}

export function normaliseDashboardSessions(
    values: unknown[],
): DashboardSession[] {
    return values
        .map(normaliseDashboardSession)
        .filter(
            (session): session is DashboardSession =>
                session !== null && session.disconnectedAt === null,
        );
}
