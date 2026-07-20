import {
    Activity,
    Clock3,
    Database,
    RadioTower,
    Router,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
    formatBytes,
    formatDateTime,
    formatDuration,
    getMountpointName,
    getSessionIdentity,
    getStationName,
} from '../lib/session-formatters';

import type { DashboardSession } from '@/types/ntrip-dashboard';

type SessionDetailPanelProps = {
    session: DashboardSession;
    now: number;
    onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <dt className="text-xs text-ntrip-ink/62">{label}</dt>

            <dd className="max-w-[65%] text-right text-xs font-semibold break-words">
                {value}
            </dd>
        </div>
    );
}

export function SessionDetailPanel({
    session,
    now,
    onClose,
}: SessionDetailPanelProps) {
    const active = session.disconnectedAt === null;

    const Icon = session.connectionType === 'source' ? RadioTower : Router;

    return (
        <aside className="min-h-0 overflow-y-auto border-t border-ntrip-ink/8 p-4 xl:border-t-0 xl:border-l">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={cn(
                            'grid size-10 shrink-0 place-items-center rounded-2xl',
                            session.connectionType === 'source'
                                ? 'bg-ntrip-teal/12 text-ntrip-teal'
                                : 'bg-ntrip-amber/14 text-ntrip-amber',
                        )}
                    >
                        <Icon className="size-4" />
                    </span>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                            {getSessionIdentity(session)}
                        </p>

                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ntrip-ink/44">
                            <span
                                className={cn(
                                    'size-1.5 rounded-full',
                                    active
                                        ? 'bg-ntrip-teal'
                                        : 'bg-ntrip-ink/30',
                                )}
                            />

                            {active ? 'Active' : 'Ended'}
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close session details"
                    onClick={onClose}
                    className="size-8 rounded-xl"
                >
                    <X className="size-3.5" />
                </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-ntrip-cloud/58 p-3 shadow-ntrip-inset">
                    <Database className="size-3.5 text-ntrip-ink/42" />

                    <p className="mt-2 text-xs text-ntrip-ink/42">
                        Transferred
                    </p>

                    <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatBytes(session.bytesTransferred)}
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/58 p-3 shadow-ntrip-inset">
                    <Clock3 className="size-3.5 text-ntrip-ink/42" />

                    <p className="mt-2 text-xs text-ntrip-ink/42">Duration</p>

                    <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatDuration(session, now)}
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/58 p-3 shadow-ntrip-inset">
                    <Activity className="size-3.5 text-ntrip-ink/42" />

                    <p className="mt-2 text-xs text-ntrip-ink/42">
                        RTCM frames
                    </p>

                    <p className="mt-1 text-sm font-semibold tabular-nums">
                        {session.validRtcmFrames}
                    </p>
                </div>

                <div className="rounded-xl bg-ntrip-cloud/58 p-3 shadow-ntrip-inset">
                    <Activity
                        className={cn(
                            'size-3.5',
                            session.rtcmCrcErrors > 0
                                ? 'text-ntrip-coral'
                                : 'text-ntrip-ink/42',
                        )}
                    />

                    <p className="mt-2 text-xs text-ntrip-ink/42">CRC errors</p>

                    <p
                        className={cn(
                            'mt-1 text-sm font-semibold tabular-nums',
                            session.rtcmCrcErrors > 0 && 'text-ntrip-coral',
                        )}
                    >
                        {session.rtcmCrcErrors}
                    </p>
                </div>
            </div>

            <dl className="mt-4 grid gap-3 border-t border-ntrip-ink/8 pt-4">
                <DetailRow
                    label="Connection type"
                    value={session.connectionType}
                />

                <DetailRow
                    label="Mountpoint"
                    value={getMountpointName(session)}
                />

                <DetailRow label="Station" value={getStationName(session)} />

                <DetailRow label="Remote IP" value={session.remoteIp ?? '—'} />

                <DetailRow
                    label="Client agent"
                    value={session.clientAgent ?? '—'}
                />

                <DetailRow
                    label="NTRIP version"
                    value={session.ntripVersion ?? '—'}
                />

                <DetailRow
                    label="Connected"
                    value={formatDateTime(session.connectedAt)}
                />

                <DetailRow
                    label="Disconnected"
                    value={formatDateTime(session.disconnectedAt)}
                />

                <DetailRow
                    label="Reason"
                    value={session.disconnectReason ?? '—'}
                />
            </dl>
        </aside>
    );
}
