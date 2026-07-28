export type MountpointStatus =
    'online' | 'waiting-source' | 'degraded' | 'disabled';

export type MountpointAccessMode = 'public' | 'authenticated';

export type StationSummary = {
    id: string;
    deviceId: string;
    name: string;
    sourceConnected: boolean;
    lastSeenAt: string | null;
};

export type MountpointRecord = {
    id: string;
    name: string;
    identifier: string | null;
    format: string | null;
    formatDetails: string | null;
    navSystem: string | null;
    latitude: number | null;
    longitude: number | null;
    country: string | null;
    enabled: boolean;
    accessMode: MountpointAccessMode;
    roverUsername: string | null;
    station: StationSummary | null;
    uploadBps: number;
    crcErrors: number;
    dataAgeMs: number | null;
};

export type ActiveSession = {
    id: string;
    mountpointId: string | null;
    connectionType: string;
    remoteIp: string | null;
    username: string | null;
    connectedAt: string | null;
    bytesTransferred: number;
};

export type MountpointWithSessions = MountpointRecord & {
    sessions: ActiveSession[];
    roverCount: number;
    status: MountpointStatus;
};

export type RoverAccountSummary = {
    username: string;
    mountpointIds: string[];
    mountpointNames: string[];
    activeConnections: number;
};
