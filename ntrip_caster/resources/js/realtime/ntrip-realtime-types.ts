export const NTRIP_DASHBOARD_CHANNEL = 'ntrip.dashboard';

export const STATION_TELEMETRY_UPDATED_EVENT = '.station.telemetry.updated';

export const NTRIP_SESSION_STARTED_EVENT = '.ntrip.session.started';

export const NTRIP_SESSION_UPDATED_EVENT = '.ntrip.session.updated';

export const NTRIP_SESSION_ENDED_EVENT = '.ntrip.session.ended';

export const NTRIP_DASHBOARD_EVENTS: string[] = [
    STATION_TELEMETRY_UPDATED_EVENT,
    NTRIP_SESSION_STARTED_EVENT,
    NTRIP_SESSION_UPDATED_EVENT,
    NTRIP_SESSION_ENDED_EVENT,
];

export type NtripRealtimeConnectionState =
    'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export type StationTelemetryUpdatedEvent = {
    version: number;
    entity: 'station';
    action: 'telemetry.updated';

    occurred_at: string;
    received_at: string;

    station: {
        id: number | string;
        device_id: string;
        name: string;
        enabled: boolean;
        source_connected: boolean;
        last_seen_at: string | null;
        firmware_version: string | null;
    };

    telemetry: Record<string, unknown>;
};

export type NtripSessionRealtimeEvent = {
    version: number;
    entity: 'ntrip_session';

    action: 'started' | 'updated' | 'ended';

    occurred_at: string;

    session: Record<string, unknown>;
};

export type NtripDashboardRealtimeEvent =
    StationTelemetryUpdatedEvent | NtripSessionRealtimeEvent;

export function normaliseRealtimeConnectionState(
    value: unknown,
): NtripRealtimeConnectionState {
    const status = String(value ?? '')
        .trim()
        .toLowerCase();

    switch (status) {
        case 'connected':
            return 'connected';

        case 'unavailable':
        case 'reconnecting':
            return 'reconnecting';

        case 'disconnected':
        case 'disconnecting':
            return 'disconnected';

        case 'failed':
            return 'failed';

        case 'initialized':
        case 'connecting':
        default:
            return 'connecting';
    }
}
