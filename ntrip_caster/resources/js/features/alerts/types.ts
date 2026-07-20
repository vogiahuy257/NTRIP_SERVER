export type AlertSeverity = 'critical' | 'warning';

export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export type AlertStation = {
    id: number;
    deviceId: string;
    name: string;
};

export type AlertMountpoint = {
    id: number;
    stationId: number;
    name: string;
};

export type AlertNtripSession = {
    id: number;
    mountpointId: number | null;
    connectionType: string | null;
    remoteIp: string | null;
};

export type AlertUser = {
    id: number;
    name: string;
};

export type AlertItem = {
    id: number;

    type: string;
    severity: AlertSeverity;
    status: AlertStatus;

    title: string;
    message: string;

    metadata: Record<string, unknown>;
    occurrenceCount: number;

    openedAt: string | null;
    lastObservedAt: string | null;
    acknowledgedAt: string | null;
    resolvedAt: string | null;

    resolutionNote: string | null;

    station: AlertStation | null;
    mountpoint: AlertMountpoint | null;
    ntripSession: AlertNtripSession | null;

    acknowledgedBy: AlertUser | null;
    resolvedBy: AlertUser | null;
};

export type AlertBroadcastAction =
    | 'opened'
    | 'updated'
    | 'acknowledged'
    | 'resolved';

export type AlertBroadcastPayload = {
    version: 1;
    entity: 'alert';
    action: AlertBroadcastAction;
    occurred_at: string;
    alert: unknown;
};

export function isActiveAlert(alert: AlertItem): boolean {
    return alert.status === 'open' || alert.status === 'acknowledged';
}
