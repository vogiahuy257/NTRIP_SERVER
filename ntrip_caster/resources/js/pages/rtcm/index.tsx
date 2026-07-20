import { Head } from '@inertiajs/react';

import {
    Activity,
    Database,
    RadioTower,
    RefreshCw,
    Search,
    TriangleAlert,
    type LucideIcon,
} from 'lucide-react';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';

import { RtcmStreamDetail } from './components/rtcm-stream-detail';
import { RtcmStreamList } from './components/rtcm-stream-list';

import { useRtcmLiveStreams } from './hooks/use-rtcm-live-streams';

import { formatBytesPerSecond, formatRate } from './lib/rtcm-live-formatters';

type SummaryMetricProps = {
    label: string;
    value: string;
    icon: LucideIcon;
    warning?: boolean;
};

function SummaryMetric({
    label,
    value,
    icon: Icon,
    warning = false,
}: SummaryMetricProps) {
    return (
        <div className="min-w-20 rounded-xl bg-ntrip-cloud/68 px-3 py-2 shadow-ntrip-inset">
            <div
                className={cn(
                    'flex items-center gap-1.5',
                    warning ? 'text-ntrip-coral' : 'text-ntrip-ink/72',
                )}
            >
                <Icon className="size-3" />

                <span className="text-micro font-semibold uppercase">
                    {label}
                </span>
            </div>

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

export default function RtcmIndex() {
    const {
        activeSessionItems,
        refresh,
        isRefreshing,
        realtimeConnectionState,
    } = useMapDashboard();

    const streams = useRtcmLiveStreams(activeSessionItems);

    const [searchQuery, setSearchQuery] = useState('');

    const [selectedStreamId, setSelectedStreamId] = useState<string | null>(
        null,
    );

    const filteredStreams = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (query === '') {
            return streams;
        }

        return streams.filter((stream) =>
            [
                stream.stationName,
                stream.stationDeviceId,
                stream.mountpointName,
                stream.session.remoteIp ?? '',
            ].some((value) => value.toLowerCase().includes(query)),
        );
    }, [searchQuery, streams]);

    const selectedStream =
        filteredStreams.find((stream) => stream.id === selectedStreamId) ??
        null;

    useEffect(() => {
        if (filteredStreams.length === 0) {
            setSelectedStreamId(null);
            return;
        }

        const selectedStillExists = filteredStreams.some(
            (stream) => stream.id === selectedStreamId,
        );

        if (!selectedStillExists) {
            setSelectedStreamId(filteredStreams[0].id);
        }
    }, [filteredStreams, selectedStreamId]);

    const aggregate = useMemo(
        () => ({
            bytesPerSecond: streams.reduce(
                (total, stream) => total + stream.bytesPerSecond,
                0,
            ),

            framesPerSecond: streams.reduce(
                (total, stream) => total + stream.framesPerSecond,
                0,
            ),

            crcErrorsPerMinute: streams.reduce(
                (total, stream) => total + stream.crcErrorsPerMinute,
                0,
            ),
        }),
        [streams],
    );

    const realtimeConnected = realtimeConnectionState === 'connected';

    return (
        <>
            <Head title="RTCM Live" />

            <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                <header className="ntrip-glass-panel-strong pointer-events-auto rounded-3xl px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-micro font-semibold text-ntrip-teal">
                                NTRIP network
                            </p>

                            <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.04em]">
                                RTCM Live
                            </h1>

                            <p className="mt-1 flex items-center gap-1.5 text-micro text-ntrip-ink/46">
                                <span
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        realtimeConnected
                                            ? 'bg-ntrip-teal'
                                            : 'bg-ntrip-amber',
                                    )}
                                />

                                {realtimeConnected
                                    ? 'Source statistics update in realtime'
                                    : 'Displaying the latest available statistics'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <SummaryMetric
                                label="Sources"
                                value={String(streams.length)}
                                icon={RadioTower}
                            />

                            <SummaryMetric
                                label="Traffic"
                                value={formatBytesPerSecond(
                                    aggregate.bytesPerSecond,
                                )}
                                icon={Database}
                            />

                            <SummaryMetric
                                label="Frames"
                                value={formatRate(
                                    aggregate.framesPerSecond,
                                    'fps',
                                )}
                                icon={Activity}
                            />

                            <SummaryMetric
                                label="CRC"
                                value={formatRate(
                                    aggregate.crcErrorsPerMinute,
                                    'err/min',
                                )}
                                icon={TriangleAlert}
                                warning={aggregate.crcErrorsPerMinute > 0}
                            />
                        </div>
                    </div>
                </header>

                <section className="ntrip-glass-panel pointer-events-auto grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ntrip-ink/8 p-3">
                        <div>
                            <h2 className="text-sm font-semibold">
                                Active Source streams
                            </h2>

                            <p className="mt-0.5 text-xs text-ntrip-ink/72">
                                Rates are calculated between consecutive session
                                statistics.
                            </p>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />

                            <Input
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search station or mountpoint"
                                className="h-9 rounded-xl border-ntrip-ink/9 bg-ntrip-cloud/68 pl-8 text-xs shadow-none"
                            />
                        </div>
                    </div>

                    <div className="grid min-h-0 grid-cols-1 xl:grid-cols-3">
                        <div className="min-h-0 overflow-y-auto border-b border-ntrip-ink/8 xl:col-span-1 xl:border-r xl:border-b-0">
                            <RtcmStreamList
                                streams={filteredStreams}
                                selectedStreamId={selectedStreamId}
                                onSelect={(stream) =>
                                    setSelectedStreamId(stream.id)
                                }
                            />
                        </div>

                        <div className="min-h-0 xl:col-span-2">
                            <RtcmStreamDetail stream={selectedStream} />
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}
