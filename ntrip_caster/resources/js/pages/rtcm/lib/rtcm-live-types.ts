import type { DashboardSession } from '@/types/ntrip-dashboard';

export type RtcmLiveStreamStatus = 'warming' | 'streaming' | 'warning' | 'idle';

export type RtcmMessageRate = {
    messageType: string;

    /*
     * Tổng số message kể từ khi session bắt đầu.
     */
    total: number;

    /*
     * Số message mỗi giây trong cửa sổ mẫu gần nhất.
     */
    ratePerSecond: number;
};

export type RtcmLiveStream = {
    id: string;

    session: DashboardSession;

    stationName: string;
    stationDeviceId: string;
    mountpointName: string;

    status: RtcmLiveStreamStatus;

    bytesPerSecond: number;
    framesPerSecond: number;
    crcErrorsPerMinute: number;

    totalBytes: number;
    totalFrames: number;
    totalCrcErrors: number;

    sampleWindowSeconds: number;
    sampledAt: string | null;

    messageRates: RtcmMessageRate[];
};
