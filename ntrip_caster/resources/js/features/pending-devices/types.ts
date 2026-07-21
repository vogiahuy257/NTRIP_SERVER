export type PendingDeviceStatus =
    'pending' | 'approved' | 'rejected' | 'provisioned' | 'unknown';

export type PendingDeviceProvisioningState =
    'bootstrap' | 'provisioned' | 'unknown';

export type PendingDeviceMountpoint = {
    id: number;
    stationId: number;
    name: string;
    enabled: boolean;
    isPrimary: boolean;
};

export type PendingDeviceStationConfig = {
    revision: number;
    casterHost: string | null;
    casterPort: number | null;
    uartBaud: number | null;
    telemetryIntervalMs: number | null;
    configPollIntervalMs: number | null;
    maxRtcmAgeMs: number | null;
};

export type PendingDeviceStation = {
    id: number;
    deviceId: string;
    name: string;
    enabled: boolean;
    sourceConnected: boolean;

    config: PendingDeviceStationConfig | null;
    mountpoint: PendingDeviceMountpoint | null;
};

export type PendingDeviceItem = {
    id: number;

    hardwareId: string;
    reportedDeviceId: string | null;
    reportedMountpoint: string | null;
    reportedProvisioningState: PendingDeviceProvisioningState;

    firmwareVersion: string | null;
    remoteIp: string | null;

    status: PendingDeviceStatus;
    connectionAttempts: number;

    firstSeenAt: string | null;
    lastSeenAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    provisionedAt: string | null;

    stationId: number | null;
    rejectionReason: string | null;

    station: PendingDeviceStation | null;
};

export type ApprovePendingDeviceInput = {
    deviceId?: string;
    name?: string;
    mountpoint?: string;

    casterHost?: string;
    casterPort?: number;

    uartBaud?: number;
    telemetryIntervalMs?: number;
    configPollIntervalMs?: number;
    maxRtcmAgeMs?: number;
};

export type PendingDeviceBroadcastAction = 'discovered' | 'updated';

export type PendingDeviceBroadcastPayload = {
    version: 1;
    entity: 'pending_device';
    action: PendingDeviceBroadcastAction;
    occurred_at: string;
    device: unknown;
};

export function isPendingDevice(device: PendingDeviceItem): boolean {
    return device.status === 'pending';
}
