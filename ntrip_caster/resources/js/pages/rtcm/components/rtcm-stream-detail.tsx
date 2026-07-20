import {
    Activity,
    Clock3,
    Database,
    RadioTower,
    TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import {
    formatBytes,
    formatBytesPerSecond,
    formatRate,
    formatSampleWindow,
    formatTimestamp,
} from '../lib/rtcm-live-formatters';

import type {
    RtcmLiveStream,
    RtcmLiveStreamStatus,
} from '../lib/rtcm-live-types';

type RtcmStreamDetailProps = {
    stream: RtcmLiveStream | null;
};

const STATUS_LABELS: Record<RtcmLiveStreamStatus, string> = {
    warming: 'Waiting for the next sample',
    streaming: 'RTCM stream active',
    warning: 'CRC errors detected',
    idle: 'Source connected without traffic',
};

function statusClass(status: RtcmLiveStreamStatus): string {
    switch (status) {
        case 'streaming':
            return 'bg-ntrip-teal/12 text-ntrip-teal';

        case 'warning':
            return 'bg-ntrip-coral/12 text-ntrip-coral';

        case 'idle':
            return 'bg-ntrip-ink/7 text-ntrip-ink/54';

        case 'warming':
        default:
            return 'bg-ntrip-amber/14 text-ntrip-amber';
    }
}

function MetricCard({
    label,
    value,
    icon: Icon,
    warning = false,
}: {
    label: string;
    value: string;
    icon: typeof Activity;
    warning?: boolean;
}) {
    return (
        <div className="rounded-2xl bg-ntrip-cloud/58 p-3 shadow-ntrip-inset">
            <Icon
                className={cn(
                    'size-3.5',
                    warning ? 'text-ntrip-coral' : 'text-ntrip-ink/40',
                )}
            />

            <p className="mt-2 text-xs text-ntrip-ink/72">{label}</p>

            <p
                className={cn(
                    'mt-1 text-sm font-semibold tabular-nums',
                    warning && 'text-ntrip-coral',
                )}
            >
                {value}
            </p>
        </div>
    );
}

export function RtcmStreamDetail({ stream }: RtcmStreamDetailProps) {
    if (!stream) {
        return (
            <div className="grid min-h-80 place-items-center p-6 text-center">
                <div>
                    <RadioTower className="mx-auto size-6 text-ntrip-ink/28" />

                    <p className="mt-3 text-sm font-semibold">
                        Select an RTCM stream
                    </p>

                    <p className="mt-1 text-xs text-ntrip-ink/72">
                        Select a station source to inspect its live message
                        rates.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-0 overflow-y-auto p-4">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <span
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold',
                            statusClass(stream.status),
                        )}
                    >
                        <span className="size-1.5 rounded-full bg-current" />

                        {STATUS_LABELS[stream.status]}
                    </span>

                    <h2 className="mt-3 truncate text-lg font-semibold tracking-[-0.03em]">
                        {stream.stationName}
                    </h2>

                    <p className="mt-1 text-xs text-ntrip-ink/44">
                        {stream.stationDeviceId}
                        {' · '}
                        {stream.mountpointName}
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-xs text-ntrip-ink/40">Last statistics</p>

                    <p className="mt-1 text-xs font-semibold tabular-nums">
                        {formatTimestamp(stream.sampledAt)}
                    </p>

                    <p className="mt-1 text-micro text-ntrip-ink/36">
                        {formatSampleWindow(stream.sampleWindowSeconds)}
                    </p>
                </div>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MetricCard
                    label="Current traffic"
                    value={formatBytesPerSecond(stream.bytesPerSecond)}
                    icon={Database}
                />

                <MetricCard
                    label="Frame rate"
                    value={formatRate(stream.framesPerSecond, 'fps')}
                    icon={Activity}
                />

                <MetricCard
                    label="CRC error rate"
                    value={formatRate(stream.crcErrorsPerMinute, 'err/min')}
                    icon={TriangleAlert}
                    warning={stream.crcErrorsPerMinute > 0}
                />

                <MetricCard
                    label="Total transferred"
                    value={formatBytes(stream.totalBytes)}
                    icon={Clock3}
                />
            </div>

            <section className="mt-4 overflow-hidden rounded-2xl border border-ntrip-ink/8 bg-ntrip-cloud/38">
                <div className="flex items-center justify-between border-b border-ntrip-ink/8 px-3 py-2.5">
                    <div>
                        <h3 className="text-sm font-semibold">
                            RTCM message rates
                        </h3>

                        <p className="mt-0.5 text-xs text-ntrip-ink/72">
                            Calculated from cumulative Source counters.
                        </p>
                    </div>

                    <span className="rounded-xl bg-ntrip-ink/6 px-2.5 py-1 text-xs font-semibold tabular-nums">
                        {stream.messageRates.length} types
                    </span>
                </div>

                {stream.messageRates.length === 0 ? (
                    <div className="grid min-h-40 place-items-center px-5 text-center">
                        <p className="text-xs text-ntrip-ink/44">
                            No RTCM message counters have been received.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-ntrip-ink/7">
                        {stream.messageRates.map((message) => (
                            <div
                                key={message.messageType}
                                className="grid grid-cols-[minmax(0,1fr)_100px_100px] items-center gap-3 px-3 py-2.5"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="grid size-7 place-items-center rounded-xl bg-ntrip-teal/10 font-mono text-xs font-semibold text-ntrip-teal">
                                        {message.messageType}
                                    </span>

                                    <span className="text-xs text-ntrip-ink/52">
                                        RTCM message
                                    </span>
                                </div>

                                <span className="text-right text-xs font-semibold tabular-nums">
                                    {formatRate(message.ratePerSecond, 'msg/s')}
                                </span>

                                <span className="text-right text-xs text-ntrip-ink/44 tabular-nums">
                                    {message.total} total
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-ntrip-cloud/44 p-3">
                    <p className="text-xs text-ntrip-ink/72">Total frames</p>

                    <p className="mt-1 text-sm font-semibold tabular-nums">
                        {stream.totalFrames}
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/44 p-3">
                    <p className="text-xs text-ntrip-ink/72">
                        Total CRC errors
                    </p>

                    <p
                        className={cn(
                            'mt-1 text-sm font-semibold tabular-nums',
                            stream.totalCrcErrors > 0 && 'text-ntrip-coral',
                        )}
                    >
                        {stream.totalCrcErrors}
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/44 p-3">
                    <p className="text-xs text-ntrip-ink/72">Session ID</p>

                    <p className="mt-1 truncate text-sm font-semibold">
                        {stream.id}
                    </p>
                </div>
            </section>
        </div>
    );
}
