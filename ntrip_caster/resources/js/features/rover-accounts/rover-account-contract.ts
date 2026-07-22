import type {
    RoverAccount,
    RoverAccountMountpoint,
    RoverAccountMountpointAccess,
    RoverAccountStatus,
    RoverAccountStation,
} from './types';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as JsonObject;
}

function readString(source: JsonObject | null, key: string): string | null {
    const value = source?.[key];

    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readNumber(source: JsonObject | null, key: string): number | null {
    const value = source?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function readBoolean(source: JsonObject | null, key: string): boolean {
    const value = source?.[key];

    return value === true || value === 1 || value === '1';
}

function readStatus(source: JsonObject | null): RoverAccountStatus {
    const value = readString(source, 'status');

    if (value === 'disabled' || value === 'expired') {
        return value;
    }

    return 'active';
}

function normalizeStation(value: unknown): RoverAccountStation | null {
    const station = asObject(value);
    const id = readNumber(station, 'id');

    if (station === null || id === null) {
        return null;
    }

    return {
        id,
        deviceId: readString(station, 'device_id') ?? `Station ${id}`,
        name: readString(station, 'name') ?? `Station ${id}`,
        sourceConnected: readBoolean(station, 'source_connected'),
    };
}

function normalizeAccess(value: unknown): RoverAccountMountpointAccess | null {
    const access = asObject(value);

    if (access === null) {
        return null;
    }

    return {
        enabled: readBoolean(access, 'enabled'),
        maxConnections: readNumber(access, 'max_connections'),
        startsAt: readString(access, 'starts_at'),
        expiresAt: readString(access, 'expires_at'),
        createdBy: readNumber(access, 'created_by'),
    };
}

export function normalizeRoverAccountMountpoint(
    value: unknown,
): RoverAccountMountpoint | null {
    const mountpoint = asObject(value);
    const id = readNumber(mountpoint, 'id');
    const stationId = readNumber(mountpoint, 'station_id');

    if (mountpoint === null || id === null || stationId === null) {
        return null;
    }

    return {
        id,
        stationId,
        name: readString(mountpoint, 'name') ?? `Mountpoint ${id}`,
        identifier: readString(mountpoint, 'identifier'),
        format: readString(mountpoint, 'format'),
        navSystem: readString(mountpoint, 'nav_system'),
        enabled: readBoolean(mountpoint, 'enabled'),
        accessMode: readString(mountpoint, 'access_mode') ?? 'public',
        isPrimary: readBoolean(mountpoint, 'is_primary'),
        station: normalizeStation(mountpoint.station),
        access: normalizeAccess(mountpoint.access),
    };
}

export function normalizeRoverAccount(value: unknown): RoverAccount | null {
    const account = asObject(value);
    const id = readNumber(account, 'id');
    const username = readString(account, 'username');

    if (account === null || id === null || username === null) {
        return null;
    }

    const rawMountpoints = Array.isArray(account.mountpoints)
        ? account.mountpoints
        : [];

    return {
        id,
        username,
        displayName: readString(account, 'display_name'),
        enabled: readBoolean(account, 'enabled'),
        status: readStatus(account),
        maxConnections: Math.max(
            1,
            Math.trunc(readNumber(account, 'max_connections') ?? 1),
        ),
        expiresAt: readString(account, 'expires_at'),
        lastAuthenticatedAt: readString(account, 'last_authenticated_at'),
        notes: readString(account, 'notes'),
        mountpointCount: Math.max(
            0,
            Math.trunc(
                readNumber(account, 'mountpoint_count') ??
                    rawMountpoints.length,
            ),
        ),
        activeSessionCount: Math.max(
            0,
            Math.trunc(readNumber(account, 'active_session_count') ?? 0),
        ),
        mountpoints: rawMountpoints
            .map(normalizeRoverAccountMountpoint)
            .filter(
                (mountpoint): mountpoint is RoverAccountMountpoint =>
                    mountpoint !== null,
            ),
        createdAt: readString(account, 'created_at'),
        updatedAt: readString(account, 'updated_at'),
    };
}

function unwrapData(payload: unknown): unknown {
    const root = asObject(payload);

    return root?.data ?? payload;
}

export function normalizeRoverAccountResponse(payload: unknown): RoverAccount {
    const account = normalizeRoverAccount(unwrapData(payload));

    if (account === null) {
        throw new Error('Rover Account response is invalid.');
    }

    return account;
}

export function normalizeRoverAccountList(payload: unknown): RoverAccount[] {
    const data = unwrapData(payload);

    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map(normalizeRoverAccount)
        .filter((account): account is RoverAccount => account !== null);
}

export function normalizeRoverAccountMountpointList(
    payload: unknown,
): RoverAccountMountpoint[] {
    const data = unwrapData(payload);

    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map(normalizeRoverAccountMountpoint)
        .filter(
            (mountpoint): mountpoint is RoverAccountMountpoint =>
                mountpoint !== null,
        );
}
