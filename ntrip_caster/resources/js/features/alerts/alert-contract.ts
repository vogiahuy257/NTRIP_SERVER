import {
    acknowledge as acknowledgeRoute,
    index as alertsIndex,
} from '@/routes/alerts';

import type {
    AlertBroadcastAction,
    AlertBroadcastPayload,
    AlertItem,
    AlertMountpoint,
    AlertNtripSession,
    AlertSeverity,
    AlertStation,
    AlertStatus,
    AlertUser,
} from './types';

export const ALERT_ENDPOINTS = {
    active: alertsIndex.url({
        query: {
            status: 'active',
            per_page: 100,
        },
    }),

    history: alertsIndex.url({
        query: {
            status: 'resolved',
            per_page: 100,
        },
    }),

    acknowledge: (alertId: number): string => acknowledgeRoute.url(alertId),
} as const;

export const ALERT_REALTIME_CHANNEL = 'ntrip.dashboard';

export const ALERT_REALTIME_EVENTS: string[] = [
    '.alert.opened',
    '.alert.updated',
    '.alert.acknowledged',
    '.alert.resolved',
];

type JsonObject = Record<string, unknown>;

const ALERT_BROADCAST_ACTIONS = new Set<AlertBroadcastAction>([
    'opened',
    'updated',
    'acknowledged',
    'resolved',
]);

function asObject(value: unknown): JsonObject | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as JsonObject;
}

function readString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();

    return normalized === '' ? null : normalized;
}

function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function normalizeSeverity(value: unknown): AlertSeverity {
    return value === 'critical' ? 'critical' : 'warning';
}

function normalizeStatus(value: unknown): AlertStatus {
    if (value === 'acknowledged') {
        return 'acknowledged';
    }

    if (value === 'resolved') {
        return 'resolved';
    }

    return 'open';
}

function normalizeStation(value: unknown): AlertStation | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);

    if (id === null) {
        return null;
    }

    const deviceId = readString(raw.device_id) ?? String(id);

    return {
        id,
        deviceId,
        name: readString(raw.name) ?? deviceId,
    };
}

function normalizeMountpoint(value: unknown): AlertMountpoint | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);
    const stationId = readNumber(raw.station_id);

    if (id === null || stationId === null) {
        return null;
    }

    return {
        id,
        stationId,
        name: readString(raw.name) ?? `Mountpoint ${id}`,
    };
}

function normalizeNtripSession(value: unknown): AlertNtripSession | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);

    if (id === null) {
        return null;
    }

    return {
        id,
        mountpointId: readNumber(raw.mountpoint_id),
        connectionType: readString(raw.connection_type),
        remoteIp: readString(raw.remote_ip),
    };
}

function normalizeUser(value: unknown): AlertUser | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);

    if (id === null) {
        return null;
    }

    return {
        id,
        name: readString(raw.name) ?? `User ${id}`,
    };
}

export function normalizeAlert(value: unknown): AlertItem | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);

    if (id === null) {
        return null;
    }

    return {
        id,

        type: readString(raw.type) ?? 'unknown_alert',
        severity: normalizeSeverity(raw.severity),
        status: normalizeStatus(raw.status),

        title: readString(raw.title) ?? 'NTRIP alert',
        message: readString(raw.message) ?? 'An alert was detected.',

        metadata: asObject(raw.metadata) ?? {},
        occurrenceCount: readNumber(raw.occurrence_count) ?? 1,

        openedAt: readString(raw.opened_at),
        lastObservedAt: readString(raw.last_observed_at),
        acknowledgedAt: readString(raw.acknowledged_at),
        resolvedAt: readString(raw.resolved_at),

        resolutionNote: readString(raw.resolution_note),

        station: normalizeStation(raw.station),
        mountpoint: normalizeMountpoint(raw.mountpoint),
        ntripSession: normalizeNtripSession(raw.ntrip_session),

        acknowledgedBy: normalizeUser(raw.acknowledged_by),
        resolvedBy: normalizeUser(raw.resolved_by),
    };
}

export function extractAlertList(response: unknown): AlertItem[] {
    const root = asObject(response);

    if (root === null || !Array.isArray(root.data)) {
        return [];
    }

    return root.data
        .map(normalizeAlert)
        .filter((alert): alert is AlertItem => alert !== null);
}

export function extractAlert(response: unknown): AlertItem | null {
    const root = asObject(response);

    return root === null ? null : normalizeAlert(root.data);
}

export function extractBroadcastAlert(
    payload: AlertBroadcastPayload,
): AlertItem | null {
    if (
        payload.version !== 1 ||
        payload.entity !== 'alert' ||
        !ALERT_BROADCAST_ACTIONS.has(payload.action)
    ) {
        return null;
    }

    return normalizeAlert(payload.alert);
}
