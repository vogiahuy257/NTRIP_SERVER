export type StationHealth = 'healthy' | 'warning' | 'critical' | 'offline';

export type DashboardStation = {
    id: number | string;
    deviceId: string;
    name: string;

    enabled: boolean;
    health: StationHealth;

    sourceConnected: boolean;
    deviceOnline: boolean;

    mountpoint: string;

    latitude: number;
    longitude: number;

    firmwareVersion: string;
    lastSeenAt: string | null;

    networkType: string;
    ipAddress: string | null;

    surveyValid: boolean;
    surveyActive: boolean;

    uploadBps: number;
    validFrames: number;
    crcErrors: number;
    rtcmAgeMs: number | null;

    temperatureC: number | null;
    freeHeapBytes: number | null;

    activeRovers: number;

    messageCounts: Record<string, number>;
};

export type NtripSessionConnectionType = 'source' | 'rover';

export type DashboardSessionStation = {
    id: number | string;
    deviceId: string;
    name: string;
};

export type DashboardSessionMountpoint = {
    id: number | string;
    stationId: number | string | null;
    name: string;

    station: DashboardSessionStation | null;
};

export type DashboardSession = {
    id: number | string;

    mountpointId: number | string | null;
    stationId: number | string | null;
    roverAccountId: number | string | null;

    connectionType: NtripSessionConnectionType;

    authenticatedUsername: string | null;
    clientAgent: string | null;
    ntripVersion: string | null;
    remoteIp: string | null;

    connectedAt: string | null;
    disconnectedAt: string | null;

    /*
     * Thời điểm backend cập nhật bộ đếm session gần nhất.
     * RTCM Live dùng field này để tính tốc độ giữa hai mẫu.
     */
    lastStatsAt: string | null;

    bytesTransferred: number;
    disconnectReason: string | null;

    validRtcmFrames: number;
    rtcmCrcErrors: number;

    rtcmMessageCounts: Record<string, number>;

    mountpoint: DashboardSessionMountpoint | null;
};

export type DashboardSnapshot = {
    stations: DashboardStation[];

    activeSessionItems: DashboardSession[];

    activeSources: number;
    activeRovers: number;
    activeSessions: number;

    totalTrafficBps: number;
    totalCrcErrors: number;

    lastUpdatedAt: Date;
    usingFallbackData: boolean;
};
