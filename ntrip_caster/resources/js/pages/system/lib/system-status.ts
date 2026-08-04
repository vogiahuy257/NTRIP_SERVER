export type RedisHealthStatus =
    | 'healthy'
    | 'warning'
    | 'critical'
    | 'unavailable'
    | 'disabled';

export type RedisRuntimeStatus = {
    status: RedisHealthStatus;
    available: boolean;
    latencyMs: number | null;

    server: {
        version: string | null;
        uptimeSeconds: number;
    };

    memory: {
        usedBytes: number;
        usedHuman: string | null;
        maxBytes: number;
        maxHuman: string | null;
        usagePercent: number | null;
        policy: string | null;
        fragmentationRatio: number | null;
    };

    clients: {
        connected: number;
        blocked: number;
    };

    operations: {
        commandsTotal: number;
        operationsPerSecond: number;
        rejectedConnections: number;
        expiredKeys: number;
        evictedKeys: number;
    };

    databases: {
        default: number;
        cache: number;
        queue: number;
        session: number;
    };

    queues: {
        realtime: number;
        alerts: number;
        default: number;
    };

    checkedAt: Date | null;
    error: string | null;
};

export type SystemStatus = {
    service: {
        name: string;
        time: Date;
    };

    redis: RedisRuntimeStatus | null;

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

function readNullableString(
    source: JsonObject | null,
    key: string,
): string | null {
    const value = source?.[key];

    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readBoolean(
    source: JsonObject | null,
    key: string,
    fallback = false,
): boolean {
    const value = source?.[key];

    return typeof value === 'boolean' ? value : fallback;
}

function readFiniteNumber(
    source: JsonObject | null,
    key: string,
    fallback = 0,
): number {
    const value = source?.[key];

    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function readNullableNumber(
    source: JsonObject | null,
    key: string,
): number | null {
    const value = source?.[key];

    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNonNegativeInteger(
    source: JsonObject | null,
    key: string,
): number {
    return Math.max(0, Math.trunc(readFiniteNumber(source, key)));
}

function readDate(source: JsonObject | null, key: string): Date {
    return readNullableDate(source, key) ?? new Date();
}

function readNullableDate(
    source: JsonObject | null,
    key: string,
): Date | null {
    const value = readString(source, key);

    if (value === '') {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRedisHealthStatus(value: unknown): RedisHealthStatus {
    if (
        value === 'healthy' ||
        value === 'warning' ||
        value === 'critical' ||
        value === 'unavailable' ||
        value === 'disabled'
    ) {
        return value;
    }

    return 'unavailable';
}

function normalizeRedisStatus(value: unknown): RedisRuntimeStatus | null {
    const redis = asObject(value);

    if (redis === null) {
        return null;
    }

    const server = asObject(redis.server);
    const memory = asObject(redis.memory);
    const clients = asObject(redis.clients);
    const operations = asObject(redis.operations);
    const databases = asObject(redis.databases);
    const queues = asObject(redis.queues);

    return {
        status: normalizeRedisHealthStatus(redis.status),
        available: readBoolean(redis, 'available'),
        latencyMs: readNullableNumber(redis, 'latency_ms'),

        server: {
            version: readNullableString(server, 'version'),
            uptimeSeconds: readNonNegativeInteger(server, 'uptime_seconds'),
        },

        memory: {
            usedBytes: readNonNegativeInteger(memory, 'used_bytes'),
            usedHuman: readNullableString(memory, 'used_human'),
            maxBytes: readNonNegativeInteger(memory, 'max_bytes'),
            maxHuman: readNullableString(memory, 'max_human'),
            usagePercent: readNullableNumber(memory, 'usage_percent'),
            policy: readNullableString(memory, 'policy'),
            fragmentationRatio: readNullableNumber(
                memory,
                'fragmentation_ratio',
            ),
        },

        clients: {
            connected: readNonNegativeInteger(clients, 'connected'),
            blocked: readNonNegativeInteger(clients, 'blocked'),
        },

        operations: {
            commandsTotal: readNonNegativeInteger(
                operations,
                'commands_total',
            ),
            operationsPerSecond: readNonNegativeInteger(
                operations,
                'operations_per_second',
            ),
            rejectedConnections: readNonNegativeInteger(
                operations,
                'rejected_connections',
            ),
            expiredKeys: readNonNegativeInteger(operations, 'expired_keys'),
            evictedKeys: readNonNegativeInteger(operations, 'evicted_keys'),
        },

        databases: {
            default: readNonNegativeInteger(databases, 'default'),
            cache: readNonNegativeInteger(databases, 'cache'),
            queue: readNonNegativeInteger(databases, 'queue'),
            session: readNonNegativeInteger(databases, 'session'),
        },

        queues: {
            realtime: readNonNegativeInteger(queues, 'realtime'),
            alerts: readNonNegativeInteger(queues, 'alerts'),
            default: readNonNegativeInteger(queues, 'default'),
        },

        checkedAt: readNullableDate(redis, 'checked_at'),
        error: readNullableString(redis, 'error'),
    };
}

function normalizeSystemStatus(payload: unknown): SystemStatus {
    const root = asObject(payload);

    if (root === null || root.success !== true) {
        throw new Error('System Status API returned an invalid response.');
    }

    const service = asObject(root.service);
    const caster = asObject(root.caster);
    const stations = asObject(root.stations);
    const mountpoints = asObject(root.mountpoints);
    const connections = asObject(root.connections);
    const traffic = asObject(root.traffic);

    return {
        service: {
            name: readString(service, 'name', 'NTRIP Caster Backend'),
            time: readDate(service, 'time'),
        },

        redis: normalizeRedisStatus(root.redis),

        caster: {
            host: readString(caster, 'host', 'Unknown'),
            port: readNonNegativeInteger(caster, 'port'),
        },

        stations: {
            total: readNonNegativeInteger(stations, 'total'),
            enabled: readNonNegativeInteger(stations, 'enabled'),
            sourceConnected: readNonNegativeInteger(
                stations,
                'source_connected',
            ),
        },

        mountpoints: {
            total: readNonNegativeInteger(mountpoints, 'total'),
            enabled: readNonNegativeInteger(mountpoints, 'enabled'),
        },

        connections: {
            activeSources: readNonNegativeInteger(
                connections,
                'active_sources',
            ),
            activeRovers: readNonNegativeInteger(
                connections,
                'active_rovers',
            ),
        },

        traffic: {
            sourceBytes: readNonNegativeInteger(traffic, 'source_bytes'),
            roverBytes: readNonNegativeInteger(traffic, 'rover_bytes'),
        },
    };
}

function readApiError(payload: unknown): string | null {
    const root = asObject(payload);
    const message = root?.message;

    return typeof message === 'string' ? message : null;
}

export async function fetchSystemStatus(
    signal?: AbortSignal,
): Promise<SystemStatus> {
    const response = await fetch('/api/v1/system/status', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
        throw new Error(
            readApiError(payload) ??
                `Unable to load System Status. HTTP ${response.status}.`,
        );
    }

    return normalizeSystemStatus(payload);
}
