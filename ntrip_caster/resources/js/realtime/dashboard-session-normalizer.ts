import type {
    DashboardAutoMountpointState,
    DashboardRoverFixType,
    DashboardSession,
    DashboardSessionMountpoint,
    DashboardSessionRoverAccount,
    DashboardSessionStation,
    NtripSessionConnectionType,
} from '@/types/ntrip-dashboard';

type UnknownRecord = Record<string, unknown>;

const ROVER_FIX_TYPES = new Set<DashboardRoverFixType>([
    'no_fix',
    'gps_fix',
    'dgps',
    'rtk_fixed',
    'rtk_float',
    'estimated',
    'unknown',
]);

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

function asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = asNumber(value, Number.NaN);

    return Number.isFinite(parsed) ? parsed : null;
}

function asNullableInteger(value: unknown): number | null {
    const parsed = asNullableNumber(value);

    return parsed === null ? null : Math.max(0, Math.trunc(parsed));
}

function asBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalised = value.trim().toLowerCase();

        if (['1', 'true', 'yes', 'on'].includes(normalised)) {
            return true;
        }

        if (['0', 'false', 'no', 'off'].includes(normalised)) {
            return false;
        }
    }

    return fallback;
}

function normaliseAutoMountpointState(
    value: unknown,
): DashboardAutoMountpointState | null {
    const state = asNullableString(value)?.toLowerCase();

    if (
        state === 'waiting_for_gga' ||
        state === 'waiting_for_base' ||
        state === 'assigned'
    ) {
        return state;
    }

    return null;
}

function asCoordinate(
    value: unknown,
    minimum: number,
    maximum: number,
): number | null {
    const parsed = asNullableNumber(value);

    if (parsed === null || parsed < minimum || parsed > maximum) {
        return null;
    }

    return parsed;
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

function normaliseRoverFixType(value: unknown): DashboardRoverFixType | null {
    const type = asNullableString(value)?.toLowerCase();

    if (!type) {
        return null;
    }

    return ROVER_FIX_TYPES.has(type as DashboardRoverFixType)
        ? (type as DashboardRoverFixType)
        : 'unknown';
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

function normaliseRoverAccount(
    value: unknown,
): DashboardSessionRoverAccount | null {
    const account = asRecord(value);

    const id = asIdentifier(account.id);

    if (id === null) {
        return null;
    }

    return {
        id,

        username: asString(account.username, `rover-${String(id)}`),

        displayName: asNullableString(account.display_name),
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

        roverLatitude: asCoordinate(session.rover_latitude, -90, 90),

        roverLongitude: asCoordinate(session.rover_longitude, -180, 180),

        roverAltitudeM: asNullableNumber(session.rover_altitude_m),

        roverGeoidSeparationM: asNullableNumber(
            session.rover_geoid_separation_m,
        ),

        roverFixQuality: asNullableInteger(session.rover_fix_quality),

        roverFixType: normaliseRoverFixType(session.rover_fix_type),

        roverSatellites: asNullableInteger(session.rover_satellites),

        roverHdop: asNullableNumber(session.rover_hdop),

        roverGgaUtc: asNullableString(session.rover_gga_utc),

        roverGgaReceivedAt: asNullableString(session.rover_gga_received_at),

        roverPositionReceivedAt: asNullableString(
            session.rover_position_received_at,
        ),

        requestedMountpoint: asNullableString(session.requested_mountpoint),

        autoMountpoint: asBoolean(session.auto_mountpoint),

        autoState: normaliseAutoMountpointState(session.auto_state),

        mountpointSwitchCount: asNumber(session.mountpoint_switch_count, 0),

        lastMountpointSwitchAt: asNullableString(
            session.last_mountpoint_switch_at,
        ),

        roverAccount: normaliseRoverAccount(session.rover_account),

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
