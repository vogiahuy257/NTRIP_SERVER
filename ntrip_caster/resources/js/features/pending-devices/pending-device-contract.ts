import type {
    PendingDeviceBroadcastAction,
    PendingDeviceBroadcastPayload,
    PendingDeviceItem,
    PendingDeviceMountpoint,
    PendingDeviceProvisioningState,
    PendingDeviceStation,
    PendingDeviceStationConfig,
    PendingDeviceStatus,
} from './types';

type JsonObject = Record<string, unknown>;

const BROADCAST_ACTIONS = new Set<PendingDeviceBroadcastAction>([
    'discovered',
    'updated',
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

function readBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    return value === 1 || value === '1';
}

function normalizeStatus(value: unknown): PendingDeviceStatus {
    switch (value) {
        case 'pending':
        case 'approved':
        case 'rejected':
        case 'provisioned':
            return value;

        default:
            return 'unknown';
    }
}

function normalizeProvisioningState(
    value: unknown,
): PendingDeviceProvisioningState {
    if (value === 'bootstrap' || value === 'provisioned') {
        return value;
    }

    return 'unknown';
}

function normalizeStationConfig(
    value: unknown,
): PendingDeviceStationConfig | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    return {
        revision: readNumber(raw.revision) ?? 0,
        casterHost: readString(raw.caster_host),
        casterPort: readNumber(raw.caster_port),
        uartBaud: readNumber(raw.uart_baud),
        telemetryIntervalMs: readNumber(raw.telemetry_interval_ms),
        configPollIntervalMs: readNumber(raw.config_poll_interval_ms),
        maxRtcmAgeMs: readNumber(raw.max_rtcm_age_ms),
    };
}

function normalizeMountpoint(value: unknown): PendingDeviceMountpoint | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);
    const stationId = readNumber(raw.station_id);
    const name = readString(raw.name);

    if (id === null || stationId === null || name === null) {
        return null;
    }

    return {
        id,
        stationId,
        name,
        enabled: readBoolean(raw.enabled),
        isPrimary: readBoolean(raw.is_primary),
    };
}

function normalizeStation(value: unknown): PendingDeviceStation | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);
    const deviceId = readString(raw.device_id);

    if (id === null || deviceId === null) {
        return null;
    }

    return {
        id,
        deviceId,
        name: readString(raw.name) ?? deviceId,
        enabled: readBoolean(raw.enabled),
        sourceConnected: readBoolean(raw.source_connected),

        config: normalizeStationConfig(raw.config),
        mountpoint: normalizeMountpoint(raw.mountpoint),
    };
}

export function normalizePendingDevice(
    value: unknown,
): PendingDeviceItem | null {
    const raw = asObject(value);

    if (raw === null) {
        return null;
    }

    const id = readNumber(raw.id);
    const hardwareId = readString(raw.hardware_id);

    if (id === null || hardwareId === null) {
        return null;
    }

    return {
        id,

        hardwareId,
        reportedDeviceId: readString(raw.reported_device_id),
        reportedMountpoint: readString(raw.reported_mountpoint),
        reportedProvisioningState: normalizeProvisioningState(
            raw.reported_provisioning_state,
        ),

        firmwareVersion: readString(raw.firmware_version),
        remoteIp: readString(raw.remote_ip),

        status: normalizeStatus(raw.status),
        connectionAttempts: readNumber(raw.connection_attempts) ?? 0,

        firstSeenAt: readString(raw.first_seen_at),
        lastSeenAt: readString(raw.last_seen_at),
        approvedAt: readString(raw.approved_at),
        rejectedAt: readString(raw.rejected_at),
        provisionedAt: readString(raw.provisioned_at),

        stationId: readNumber(raw.station_id),
        rejectionReason: readString(raw.rejection_reason),

        station: normalizeStation(raw.station),
    };
}

export function extractPendingDeviceList(
    response: unknown,
): PendingDeviceItem[] {
    const root = asObject(response);

    if (root === null || !Array.isArray(root.data)) {
        return [];
    }

    return root.data
        .map(normalizePendingDevice)
        .filter((device): device is PendingDeviceItem => device !== null);
}

export function extractPendingDevice(
    response: unknown,
): PendingDeviceItem | null {
    const root = asObject(response);

    return root === null ? null : normalizePendingDevice(root.data);
}

export function extractBroadcastPendingDevice(
    payload: PendingDeviceBroadcastPayload,
): PendingDeviceItem | null {
    if (
        payload.version !== 1 ||
        payload.entity !== 'pending_device' ||
        !BROADCAST_ACTIONS.has(payload.action)
    ) {
        return null;
    }

    return normalizePendingDevice(payload.device);
}
