import type {
    ActiveSession,
    MountpointRecord,
    MountpointStatus,
    MountpointWithSessions,
    RoverAccountSummary,
} from '../types';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as JsonObject;
    }

    return null;
}

function readString(
    source: JsonObject | null,
    ...keys: string[]
): string | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }

        if (typeof value === 'number') {
            return String(value);
        }
    }

    return null;
}

function readNumber(
    source: JsonObject | null,
    ...keys: string[]
): number | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim() !== '') {
            const parsedValue = Number(value);

            if (Number.isFinite(parsedValue)) {
                return parsedValue;
            }
        }
    }

    return null;
}

function readBoolean(
    source: JsonObject | null,
    ...keys: string[]
): boolean | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'boolean') {
            return value;
        }

        if (value === 1 || value === '1') {
            return true;
        }

        if (value === 0 || value === '0') {
            return false;
        }
    }

    return null;
}

function unwrapArray(payload: unknown, keys: string[]): unknown[] {
    if (Array.isArray(payload)) {
        return payload;
    }

    const root = asObject(payload);

    if (!root) {
        return [];
    }

    if (Array.isArray(root.data)) {
        return root.data;
    }

    for (const key of keys) {
        if (Array.isArray(root[key])) {
            return root[key] as unknown[];
        }
    }

    const data = asObject(root.data);

    if (!data) {
        return [];
    }

    for (const key of keys) {
        if (Array.isArray(data[key])) {
            return data[key] as unknown[];
        }
    }

    return [];
}

function findRtcmPayload(mountpoint: JsonObject): JsonObject | null {
    const directRtcm = asObject(mountpoint.rtcm);

    if (directRtcm) {
        return directRtcm;
    }

    const station = asObject(mountpoint.station);
    const telemetry = asObject(station?.telemetry);
    const telemetryPayload = asObject(telemetry?.payload);

    return asObject(telemetryPayload?.rtcm);
}

export function normalizeMountpoints(payload: unknown): MountpointRecord[] {
    return unwrapArray(payload, ['mountpoints', 'items'])
        .map((item): MountpointRecord | null => {
            const mountpoint = asObject(item);

            if (!mountpoint) {
                return null;
            }

            const id = readString(mountpoint, 'id');

            if (!id) {
                return null;
            }

            const stationObject = asObject(mountpoint.station);
            const stationId = readString(stationObject, 'id');
            const rtcm = findRtcmPayload(mountpoint);

            return {
                id,
                name:
                    readString(mountpoint, 'name', 'mountpoint') ??
                    `Mountpoint ${id}`,
                identifier: readString(mountpoint, 'identifier'),
                format: readString(mountpoint, 'format'),
                formatDetails: readString(
                    mountpoint,
                    'format_details',
                    'formatDetails',
                ),
                navSystem: readString(mountpoint, 'nav_system', 'navSystem'),
                latitude: readNumber(mountpoint, 'latitude', 'lat'),
                longitude: readNumber(mountpoint, 'longitude', 'lon'),
                country: readString(mountpoint, 'country'),
                enabled: readBoolean(mountpoint, 'enabled') ?? true,
                roverUsername: readString(
                    mountpoint,
                    'rover_username',
                    'roverUsername',
                ),
                station:
                    stationId === null
                        ? null
                        : {
                              id: stationId,
                              deviceId:
                                  readString(
                                      stationObject,
                                      'device_id',
                                      'deviceId',
                                  ) ?? 'Unknown device',
                              name:
                                  readString(stationObject, 'name') ??
                                  'Unknown station',
                              sourceConnected:
                                  readBoolean(
                                      stationObject,
                                      'source_connected',
                                      'sourceConnected',
                                  ) ?? false,
                              lastSeenAt: readString(
                                  stationObject,
                                  'last_seen_at',
                                  'lastSeenAt',
                              ),
                          },
                uploadBps: readNumber(rtcm, 'upload_bps', 'uploadBps') ?? 0,
                crcErrors: readNumber(rtcm, 'crc_errors', 'crcErrors') ?? 0,
                dataAgeMs: readNumber(rtcm, 'age_ms', 'ageMs'),
            };
        })
        .filter(
            (mountpoint): mountpoint is MountpointRecord => mountpoint !== null,
        );
}

export function resolveMountpointStatus(
    mountpoint: MountpointRecord,
): MountpointStatus {
    if (!mountpoint.enabled) {
        return 'disabled';
    }

    if (!mountpoint.station?.sourceConnected) {
        return 'waiting-source';
    }

    if (mountpoint.crcErrors > 0) {
        return 'degraded';
    }

    return 'online';
}

export function attachSessions(
    mountpoints: MountpointRecord[],
    sessions: ActiveSession[],
): MountpointWithSessions[] {
    const sessionsByMountpoint = new Map<string, ActiveSession[]>();

    for (const session of sessions) {
        if (
            !session.mountpointId ||
            session.connectionType.toLowerCase() !== 'rover'
        ) {
            continue;
        }

        const currentSessions =
            sessionsByMountpoint.get(session.mountpointId) ?? [];

        currentSessions.push(session);
        sessionsByMountpoint.set(session.mountpointId, currentSessions);
    }

    return mountpoints.map((mountpoint) => {
        const roverSessions = sessionsByMountpoint.get(mountpoint.id) ?? [];

        return {
            ...mountpoint,
            sessions: roverSessions,
            roverCount: roverSessions.length,
            status: resolveMountpointStatus(mountpoint),
        };
    });
}

export function buildRoverAccounts(
    mountpoints: MountpointWithSessions[],
): RoverAccountSummary[] {
    const accounts = new Map<
        string,
        {
            mountpointIds: Set<string>;
            mountpointNames: Set<string>;
            activeConnections: number;
        }
    >();

    for (const mountpoint of mountpoints) {
        const fallbackUsername = mountpoint.roverUsername;

        if (fallbackUsername && !accounts.has(fallbackUsername)) {
            accounts.set(fallbackUsername, {
                mountpointIds: new Set([mountpoint.id]),
                mountpointNames: new Set([mountpoint.name]),
                activeConnections: 0,
            });
        }

        for (const session of mountpoint.sessions) {
            const username = session.username ?? fallbackUsername;

            if (!username) {
                continue;
            }

            const account = accounts.get(username) ?? {
                mountpointIds: new Set<string>(),
                mountpointNames: new Set<string>(),
                activeConnections: 0,
            };

            account.mountpointIds.add(mountpoint.id);
            account.mountpointNames.add(mountpoint.name);
            account.activeConnections += 1;
            accounts.set(username, account);
        }
    }

    return Array.from(accounts.entries())
        .map(([username, account]) => ({
            username,
            mountpointIds: Array.from(account.mountpointIds),
            mountpointNames: Array.from(account.mountpointNames),
            activeConnections: account.activeConnections,
        }))
        .sort((left, right) => left.username.localeCompare(right.username));
}

export function formatBitrate(bitsPerSecond: number): string {
    if (bitsPerSecond <= 0) {
        return '0 bps';
    }

    if (bitsPerSecond < 1000) {
        return `${Math.round(bitsPerSecond)} bps`;
    }

    return `${(bitsPerSecond / 1000).toFixed(1)} kbps`;
}

export function formatBytes(bytes: number): string {
    if (bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    const value = bytes / 1024 ** unitIndex;

    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
