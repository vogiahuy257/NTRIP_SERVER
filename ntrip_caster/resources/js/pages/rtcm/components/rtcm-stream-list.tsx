import { Activity, RadioTower } from 'lucide-react';

import { cn } from '@/lib/utils';

import { formatBytesPerSecond, formatRate } from '../lib/rtcm-live-formatters';

import type {
    RtcmLiveStream,
    RtcmLiveStreamStatus,
} from '../lib/rtcm-live-types';

type RtcmStreamListProps = {
    streams: RtcmLiveStream[];
    selectedStreamId: string | null;

    onSelect: (stream: RtcmLiveStream) => void;
};

const STATUS_LABELS: Record<RtcmLiveStreamStatus, string> = {
    warming: 'Waiting',
    streaming: 'Streaming',
    warning: 'CRC warning',
    idle: 'No traffic',
};

function statusDotClass(status: RtcmLiveStreamStatus): string {
    switch (status) {
        case 'streaming':
            return 'bg-ntrip-teal';

        case 'warning':
            return 'bg-ntrip-coral';

        case 'idle':
            return 'bg-ntrip-ink/30';

        case 'warming':
        default:
            return 'bg-ntrip-amber';
    }
}

export function RtcmStreamList({
    streams,
    selectedStreamId,
    onSelect,
}: RtcmStreamListProps) {
    if (streams.length === 0) {
        return (
            <div className="grid min-h-72 place-items-center px-5 text-center">
                <div>
                    <span className="mx-auto grid size-10 place-items-center rounded-2xl bg-ntrip-ink/6 text-ntrip-ink/42">
                        <RadioTower className="size-4" />
                    </span>

                    <p className="mt-3 text-sm font-semibold">
                        No active RTCM source
                    </p>

                    <p className="mt-1 text-xs text-ntrip-ink/44">
                        A source stream will appear here when a station
                        connects.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-1 p-2">
            {streams.map((stream) => {
                const selected = selectedStreamId === stream.id;

                return (
                    <button
                        key={stream.id}
                        type="button"
                        onClick={() => onSelect(stream)}
                        className={cn(
                            'w-full rounded-2xl px-3 py-3 text-left transition',
                            selected
                                ? 'bg-ntrip-cloud/92 shadow-ntrip-inset-strong'
                                : 'hover:bg-ntrip-cloud/58',
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ntrip-teal/12 text-ntrip-teal">
                                <RadioTower className="size-4" />
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-xs font-semibold">
                                        {stream.stationName}
                                    </span>

                                    <span
                                        className={cn(
                                            'size-1.5 shrink-0 rounded-full',
                                            statusDotClass(stream.status),
                                        )}
                                    />
                                </span>

                                <span className="mt-0.5 block truncate text-xs text-ntrip-ink/42">
                                    {stream.mountpointName}
                                    {' · '}
                                    {STATUS_LABELS[stream.status]}
                                </span>
                            </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <span className="rounded-xl bg-ntrip-cloud/52 px-2.5 py-2">
                                <span className="block text-micro text-ntrip-ink/40">
                                    Traffic
                                </span>

                                <strong className="mt-1 block text-xs font-semibold tabular-nums">
                                    {formatBytesPerSecond(
                                        stream.bytesPerSecond,
                                    )}
                                </strong>
                            </span>

                            <span className="rounded-xl bg-ntrip-cloud/52 px-2.5 py-2">
                                <span className="block text-micro text-ntrip-ink/40">
                                    Frames
                                </span>

                                <strong className="mt-1 flex items-center gap-1 text-xs font-semibold tabular-nums">
                                    <Activity className="size-3 text-ntrip-ink/36" />

                                    {formatRate(stream.framesPerSecond, 'fps')}
                                </strong>
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
