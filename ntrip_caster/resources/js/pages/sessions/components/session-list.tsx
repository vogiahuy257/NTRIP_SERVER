import { RadioTower, Router } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
    formatBytes,
    formatDuration,
    getMountpointName,
    getSessionIdentity,
} from '../lib/session-formatters';

import type { DashboardSession } from '@/types/ntrip-dashboard';

type SessionListProps = {
    sessions: DashboardSession[];
    selectedSessionId: string | null;
    now: number;
    onSelect: (session: DashboardSession) => void;
};

export function SessionList({
    sessions,
    selectedSessionId,
    now,
    onSelect,
}: SessionListProps) {
    if (sessions.length === 0) {
        return (
            <div className="grid min-h-56 place-items-center px-6 text-center">
                <div>
                    <p className="text-sm font-semibold">No sessions found</p>

                    <p className="mt-1 text-xs text-ntrip-ink/44">
                        No session matches the current filter.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <div className="min-w-180">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(110px,1fr)_110px_105px_90px] gap-3 border-b border-ntrip-ink/8 px-3 py-2 text-micro font-semibold tracking-[0.04em] text-ntrip-ink/38 uppercase">
                    <span>Connection</span>
                    <span>Mountpoint</span>
                    <span>Remote</span>
                    <span>Duration</span>
                    <span className="text-right">Traffic</span>
                </div>

                <div className="grid gap-1.5 p-1.5">
                    {sessions.map((session) => {
                        const active = session.disconnectedAt === null;

                        const selected = selectedSessionId === String(session.id);

                        const Icon =
                            session.connectionType === 'source'
                                ? RadioTower
                                : Router;

                        return (
                            <button
                                key={session.id}
                                type="button"
                                onClick={() => onSelect(session)}
                                className={cn(
                                    'grid w-full bg-ntrip-cloud/65 grid-cols-[minmax(0,1.4fr)_minmax(110px,1fr)_110px_105px_90px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                                    selected
                                        ? 'shadow-ntrip-inset-strong'
                                        : 'hover:bg-ntrip-cloud/92 border-ntrip-ink/8 hover:shadow-ntrip-panel-soft',
                                )}
                            >
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <span
                                        className={cn(
                                            'grid size-8 shrink-0 place-items-center rounded-xl',
                                            session.connectionType === 'source'
                                                ? 'bg-ntrip-teal/12 text-ntrip-teal'
                                                : 'bg-ntrip-amber/14 text-ntrip-amber',
                                        )}
                                    >
                                        <Icon className="size-3.5" />
                                    </span>

                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5">
                                            <span
                                                className={cn(
                                                    'size-1.5 shrink-0 rounded-full',
                                                    active
                                                        ? 'bg-ntrip-teal'
                                                        : 'bg-ntrip-ink/28',
                                                )}
                                            />

                                            <span className="truncate text-xs font-semibold">
                                                {getSessionIdentity(session)}
                                            </span>
                                        </span>

                                        <span className="mt-0.5 block truncate text-xs text-ntrip-ink/40">
                                            {session.connectionType}
                                        </span>
                                    </span>
                                </span>

                                <span className="truncate text-xs font-medium">
                                    {getMountpointName(session)}
                                </span>

                                <span className="truncate font-mono text-xs text-ntrip-ink/52">
                                    {session.remoteIp ?? '—'}
                                </span>

                                <span className="text-xs text-ntrip-ink/55 tabular-nums">
                                    {formatDuration(session, now)}
                                </span>

                                <span className="text-right text-xs font-semibold tabular-nums">
                                    {formatBytes(session.bytesTransferred)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
