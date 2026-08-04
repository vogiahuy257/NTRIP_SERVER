import { formatBytes, formatCount } from './rtcm-flow-view';
import type {
    RedisHealthStatus,
    RedisRuntimeStatus,
} from './system-status';

export type RedisTone = 'neutral' | 'healthy' | 'warning' | 'critical';

const MEMORY_WARNING_PERCENT = 70;
const MEMORY_CRITICAL_PERCENT = 85;
const LATENCY_WARNING_MS = 25;
const LATENCY_CRITICAL_MS = 100;
const QUEUE_WARNING_SIZE = 100;
const QUEUE_CRITICAL_SIZE = 500;

const decimalFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
});

export function resolveRedisTone(
    redis: RedisRuntimeStatus | null,
): RedisTone {
    return healthStatusTone(redis?.status ?? 'unavailable');
}

export function healthStatusTone(status: RedisHealthStatus): RedisTone {
    switch (status) {
        case 'healthy':
            return 'healthy';
        case 'warning':
            return 'warning';
        case 'critical':
        case 'unavailable':
            return 'critical';
        case 'disabled':
            return 'neutral';
    }
}

export function healthStatusLabel(status: RedisHealthStatus): string {
    switch (status) {
        case 'healthy':
            return 'Healthy';
        case 'warning':
            return 'Warning';
        case 'critical':
            return 'Critical';
        case 'unavailable':
            return 'Unavailable';
        case 'disabled':
            return 'Disabled';
    }
}

export function formatHealthLabel(redis: RedisRuntimeStatus | null): string {
    return redis === null ? '—' : healthStatusLabel(redis.status);
}

export function formatHealthDescription(
    redis: RedisRuntimeStatus | null,
): string {
    if (redis === null) {
        return 'Waiting for Redis runtime metrics.';
    }

    if (!redis.available) {
        return 'PostgreSQL remains available as the queue fallback.';
    }

    const version =
        redis.server.version === null
            ? 'Redis'
            : `Redis ${redis.server.version}`;

    return `${version} · Uptime ${formatUptime(redis.server.uptimeSeconds)}`;
}

export function formatMemoryDescription(
    redis: RedisRuntimeStatus | null,
): string {
    if (redis === null) {
        return 'Used memory compared with the configured memory limit.';
    }

    const used = redis.memory.usedHuman ?? formatBytes(redis.memory.usedBytes);
    const maximum =
        redis.memory.maxHuman ?? formatBytes(redis.memory.maxBytes);
    const policy = redis.memory.policy ?? 'unknown policy';

    return `${used} / ${maximum} · ${policy}`;
}

export function formatLatencyDescription(
    redis: RedisRuntimeStatus | null,
): string {
    if (redis === null) {
        return 'Round-trip latency from Laravel to local Redis.';
    }

    return `${formatCount(redis.clients.connected)} clients · ${formatCount(redis.clients.blocked)} blocked`;
}

export function formatQueueDescription(
    redis: RedisRuntimeStatus | null,
): string {
    if (redis === null) {
        return 'Realtime, alerts and default Redis queues.';
    }

    return `Realtime ${formatCount(redis.queues.realtime)} · Alerts ${formatCount(redis.queues.alerts)} · Default ${formatCount(redis.queues.default)}`;
}

export function memoryTone(redis: RedisRuntimeStatus | null): RedisTone {
    const value = redis?.memory.usagePercent;

    if (value === null || value === undefined) {
        return 'neutral';
    }

    if (value >= MEMORY_CRITICAL_PERCENT) {
        return 'critical';
    }

    if (value >= MEMORY_WARNING_PERCENT) {
        return 'warning';
    }

    return 'healthy';
}

export function latencyTone(redis: RedisRuntimeStatus | null): RedisTone {
    const value = redis?.latencyMs;

    if (value === null || value === undefined) {
        return 'neutral';
    }

    if (value >= LATENCY_CRITICAL_MS) {
        return 'critical';
    }

    if (value >= LATENCY_WARNING_MS) {
        return 'warning';
    }

    return 'healthy';
}

export function queueTone(redis: RedisRuntimeStatus | null): RedisTone {
    if (redis === null) {
        return 'neutral';
    }

    return queueItemTone(
        Math.max(
            redis.queues.realtime,
            redis.queues.alerts,
            redis.queues.default,
        ),
    );
}

export function queueItemTone(size: number): RedisTone {
    if (size >= QUEUE_CRITICAL_SIZE) {
        return 'critical';
    }

    if (size >= QUEUE_WARNING_SIZE) {
        return 'warning';
    }

    return 'healthy';
}

export function sumQueueBacklog(redis: RedisRuntimeStatus): number {
    return redis.queues.realtime + redis.queues.alerts + redis.queues.default;
}

export function formatLatency(value: number | null): string {
    return value === null ? '—' : `${formatDecimal(value)} ms`;
}

export function formatDecimal(value: number): string {
    return decimalFormatter.format(value);
}

function formatUptime(seconds: number): string {
    if (seconds <= 0) {
        return '—';
    }

    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${Math.max(1, minutes)}m`;
}
