export type SystemStatus = {
    service: {
        name: string;
        time: Date;
    };

    caster: {
        host: string;
        port: number;
    };

    stations: {
        total: number;
        enabled: number;
        sourceConnected: number;
    };

    mountpoints: {
        total: number;
        enabled: number;
    };

    connections: {
        activeSources: number;
        activeRovers: number;
    };

    traffic: {
        sourceBytes: number;
        roverBytes: number;
    };
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        return null;
    }

    return value as JsonObject;
}

function readString(
    source: JsonObject | null,
    key: string,
    fallback = '',
): string {
    const value = source?.[key];

    return typeof value === 'string' ? value : fallback;
}

function readNonNegativeInteger(
    source: JsonObject | null,
    key: string,
): number {
    const value = source?.[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.trunc(value));
}

function readDate(
    source: JsonObject | null,
    key: string,
): Date {
    const value = readString(source, key);

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? new Date()
        : date;
}

function normalizeSystemStatus(
    payload: unknown,
): SystemStatus {
    const root = asObject(payload);

    if (root === null || root.success !== true) {
        throw new Error(
            'System Status API returned an invalid response.',
        );
    }

    const service = asObject(root.service);
    const caster = asObject(root.caster);
    const stations = asObject(root.stations);
    const mountpoints = asObject(root.mountpoints);
    const connections = asObject(root.connections);
    const traffic = asObject(root.traffic);

    return {
        service: {
            name: readString(
                service,
                'name',
                'NTRIP Caster Backend',
            ),

            time: readDate(service, 'time'),
        },

        caster: {
            host: readString(
                caster,
                'host',
                'Unknown',
            ),

            port: readNonNegativeInteger(
                caster,
                'port',
            ),
        },

        stations: {
            total: readNonNegativeInteger(
                stations,
                'total',
            ),

            enabled: readNonNegativeInteger(
                stations,
                'enabled',
            ),

            sourceConnected:
                readNonNegativeInteger(
                    stations,
                    'source_connected',
                ),
        },

        mountpoints: {
            total: readNonNegativeInteger(
                mountpoints,
                'total',
            ),

            enabled: readNonNegativeInteger(
                mountpoints,
                'enabled',
            ),
        },

        connections: {
            activeSources:
                readNonNegativeInteger(
                    connections,
                    'active_sources',
                ),

            activeRovers:
                readNonNegativeInteger(
                    connections,
                    'active_rovers',
                ),
        },

        traffic: {
            sourceBytes:
                readNonNegativeInteger(
                    traffic,
                    'source_bytes',
                ),

            roverBytes:
                readNonNegativeInteger(
                    traffic,
                    'rover_bytes',
                ),
        },
    };
}

function readApiError(payload: unknown): string | null {
    const root = asObject(payload);

    const message = root?.message;

    return typeof message === 'string'
        ? message
        : null;
}

export async function fetchSystemStatus(
    signal?: AbortSignal,
): Promise<SystemStatus> {
    const response = await fetch(
        '/api/v1/system/status',
        {
            method: 'GET',

            credentials: 'same-origin',

            headers: {
                Accept: 'application/json',

                'X-Requested-With':
                    'XMLHttpRequest',
            },

            signal,
        },
    );

    const payload = (await response
        .json()
        .catch(() => null)) as unknown;

    if (!response.ok) {
        throw new Error(
            readApiError(payload) ??
                `Unable to load System Status. HTTP ${response.status}.`,
        );
    }

    return normalizeSystemStatus(payload);
}
