import { useEffect, useRef, useState } from 'react';

import type { DashboardSession } from '@/types/ntrip-dashboard';

import type {
    RtcmLiveStream,
    RtcmLiveStreamStatus,
    RtcmMessageRate,
} from '../lib/rtcm-live-types';

type CounterSample = {
    sampledAt: number;

    bytesTransferred: number;
    validFrames: number;
    crcErrors: number;

    messageCounts: Record<string, number>;
};

function parseTimestamp(session: DashboardSession): number {
    const value = session.lastStatsAt ?? session.connectedAt;

    if (!value) {
        return Date.now();
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function positiveDelta(current: number, previous: number): number {
    /*
     * Counter có thể reset khi Source reconnect.
     * Không để giá trị âm tạo rate sai.
     */
    if (current < previous) {
        return 0;
    }

    return current - previous;
}

function ratePerSecond(delta: number, elapsedSeconds: number): number {
    if (elapsedSeconds <= 0 || !Number.isFinite(elapsedSeconds)) {
        return 0;
    }

    return delta / elapsedSeconds;
}

function buildMessageRates(
    current: Record<string, number>,
    previous: Record<string, number>,
    elapsedSeconds: number,
): RtcmMessageRate[] {
    const messageTypes = new Set([
        ...Object.keys(current),
        ...Object.keys(previous),
    ]);

    return [...messageTypes]
        .map((messageType) => {
            const currentCount = current[messageType] ?? 0;

            const previousCount = previous[messageType] ?? 0;

            const delta = positiveDelta(currentCount, previousCount);

            return {
                messageType,
                total: currentCount,
                ratePerSecond: ratePerSecond(delta, elapsedSeconds),
            };
        })
        .filter((message) => message.total > 0)
        .sort(
            (left, right) =>
                right.ratePerSecond - left.ratePerSecond ||
                left.messageType.localeCompare(right.messageType),
        );
}

function resolveStatus(
    hasPreviousSample: boolean,
    bytesPerSecond: number,
    framesPerSecond: number,
    crcDelta: number,
): RtcmLiveStreamStatus {
    if (!hasPreviousSample) {
        return 'warming';
    }

    if (crcDelta > 0) {
        return 'warning';
    }

    if (bytesPerSecond <= 0 && framesPerSecond <= 0) {
        return 'idle';
    }

    return 'streaming';
}

function stationName(session: DashboardSession): string {
    return session.mountpoint?.station?.name ?? 'Unknown station';
}

function stationDeviceId(session: DashboardSession): string {
    return session.mountpoint?.station?.deviceId ?? 'Unknown device';
}

function mountpointName(session: DashboardSession): string {
    return session.mountpoint?.name ?? 'Unknown mountpoint';
}

export function useRtcmLiveStreams(
    sessions: DashboardSession[],
): RtcmLiveStream[] {
    const [streams, setStreams] = useState<RtcmLiveStream[]>([]);

    const previousSamplesRef = useRef(new Map<string, CounterSample>());

    useEffect(() => {
        const sourceSessions = sessions.filter(
            (session) =>
                session.connectionType === 'source' &&
                session.disconnectedAt === null,
        );

        const previousSamples = previousSamplesRef.current;

        const nextSamples = new Map<string, CounterSample>();

        const nextStreams = sourceSessions.map((session): RtcmLiveStream => {
            const id = String(session.id);

            const sampledAt = parseTimestamp(session);

            const currentSample: CounterSample = {
                sampledAt,

                bytesTransferred: Math.max(0, session.bytesTransferred),

                validFrames: Math.max(0, session.validRtcmFrames),

                crcErrors: Math.max(0, session.rtcmCrcErrors),

                messageCounts: {
                    ...session.rtcmMessageCounts,
                },
            };

            const previousSample = previousSamples.get(id);

            nextSamples.set(id, currentSample);

            if (!previousSample) {
                return {
                    id,
                    session,

                    stationName: stationName(session),

                    stationDeviceId: stationDeviceId(session),

                    mountpointName: mountpointName(session),

                    status: 'warming',

                    bytesPerSecond: 0,
                    framesPerSecond: 0,
                    crcErrorsPerMinute: 0,

                    totalBytes: currentSample.bytesTransferred,

                    totalFrames: currentSample.validFrames,

                    totalCrcErrors: currentSample.crcErrors,

                    sampleWindowSeconds: 0,

                    sampledAt: session.lastStatsAt ?? session.connectedAt,

                    messageRates: buildMessageRates(
                        currentSample.messageCounts,
                        {},
                        0,
                    ),
                };
            }

            const elapsedSeconds = Math.max(
                0,
                (sampledAt - previousSample.sampledAt) / 1000,
            );

            const bytesDelta = positiveDelta(
                currentSample.bytesTransferred,
                previousSample.bytesTransferred,
            );

            const framesDelta = positiveDelta(
                currentSample.validFrames,
                previousSample.validFrames,
            );

            const crcDelta = positiveDelta(
                currentSample.crcErrors,
                previousSample.crcErrors,
            );

            const bytesPerSecond = ratePerSecond(bytesDelta, elapsedSeconds);

            const framesPerSecond = ratePerSecond(framesDelta, elapsedSeconds);

            const crcErrorsPerMinute =
                ratePerSecond(crcDelta, elapsedSeconds) * 60;

            return {
                id,
                session,

                stationName: stationName(session),

                stationDeviceId: stationDeviceId(session),

                mountpointName: mountpointName(session),

                status: resolveStatus(
                    true,
                    bytesPerSecond,
                    framesPerSecond,
                    crcDelta,
                ),

                bytesPerSecond,
                framesPerSecond,
                crcErrorsPerMinute,

                totalBytes: currentSample.bytesTransferred,

                totalFrames: currentSample.validFrames,

                totalCrcErrors: currentSample.crcErrors,

                sampleWindowSeconds: elapsedSeconds,

                sampledAt: session.lastStatsAt ?? session.connectedAt,

                messageRates: buildMessageRates(
                    currentSample.messageCounts,
                    previousSample.messageCounts,
                    elapsedSeconds,
                ),
            };
        });

        previousSamplesRef.current = nextSamples;

        nextStreams.sort(
            (left, right) =>
                right.bytesPerSecond - left.bytesPerSecond ||
                left.stationName.localeCompare(right.stationName),
        );

        setStreams(nextStreams);
    }, [sessions]);

    return streams;
}
