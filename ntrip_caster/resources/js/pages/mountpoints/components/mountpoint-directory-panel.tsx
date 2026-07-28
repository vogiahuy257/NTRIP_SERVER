import { Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Globe2,
    LockKeyhole,
    RadioTower,
    RefreshCw,
    Server,
    Wifi,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { formatBitrate } from '../lib/mountpoint-data';
import type { MountpointStatus, MountpointWithSessions } from '../types';
import { MountpointEmptyState } from './mountpoint-empty-state';

const STATUS_LABELS: Record<MountpointStatus, string> = {
    online: 'Online',
    'waiting-source': 'Waiting source',
    degraded: 'Degraded',
    disabled: 'Disabled',
};

type MountpointDirectoryPanelProps = {
    mountpoints: MountpointWithSessions[];

    updatingAccessModeIds: ReadonlySet<string>;

    onAnonymousAccessChange: (
        mountpointId: string,
        anonymousEnabled: boolean,
    ) => void | Promise<void>;
};

export function MountpointDirectoryPanel({
    mountpoints,
    updatingAccessModeIds,
    onAnonymousAccessChange,
}: MountpointDirectoryPanelProps) {
    if (mountpoints.length === 0) {
        return (
            <MountpointEmptyState
                icon={RadioTower}
                title="No matching mountpoints"
                description="Change the search text or status filter."
            />
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mountpoints.map((mountpoint) => {
                const anonymousEnabled = mountpoint.accessMode === 'public';

                const updating = updatingAccessModeIds.has(mountpoint.id);

                const AccessIcon = anonymousEnabled ? Globe2 : LockKeyhole;

                return (
                    <article
                        key={mountpoint.id}
                        className={cn(
                            'relative overflow-hidden rounded-control-lg border p-4 transition',
                            'border-ntrip-ink/8 bg-ntrip-cloud/75 shadow-ntrip-panel',
                            'hover:-translate-y-0.5 hover:border-ntrip-teal/35 hover:shadow-ntrip-panel-soft',
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-teal/12 text-ntrip-teal">
                                <RadioTower className="size-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                                <h2 className="truncate text-sm font-semibold tracking-[-0.015em]">
                                    {mountpoint.name}
                                </h2>

                                <p className="mt-1 truncate text-micro text-ntrip-ink/46">
                                    {mountpoint.identifier ??
                                        'NTRIP correction stream'}
                                </p>
                            </div>

                            <span
                                data-status={mountpoint.status}
                                className="ntrip-status-inline inline-flex shrink-0 items-center gap-1.5 text-2xs font-semibold"
                            >
                                <span className="ntrip-status-inline__dot size-2 rounded-full" />

                                {STATUS_LABELS[mountpoint.status]}
                            </span>
                        </div>

                        <dl className="mt-4 grid gap-2 text-micro">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="inline-flex items-center gap-1.5 text-ntrip-ink/44">
                                    <Server className="size-3" />
                                    Source
                                </dt>

                                <dd className="min-w-0 truncate font-medium">
                                    {mountpoint.station?.name ?? 'Unassigned'}
                                </dd>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-ntrip-ink/44">Format</dt>

                                <dd className="font-medium">
                                    {mountpoint.format ?? 'Unknown'}
                                </dd>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <dt className="inline-flex items-center gap-1.5 text-ntrip-ink/44">
                                    <Wifi className="size-3" />
                                    Rovers
                                </dt>

                                <dd className="font-medium tabular-nums">
                                    {mountpoint.roverCount}
                                </dd>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-ntrip-ink/44">Upload</dt>

                                <dd className="font-mono font-medium text-ntrip-ink/62">
                                    {formatBitrate(mountpoint.uploadBps)}
                                </dd>
                            </div>
                        </dl>

                        <div className="mt-4 rounded-2xl border border-ntrip-ink/8 bg-ntrip-ink/[3.5%] p-3">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex min-w-0 items-start gap-2.5">
                                    <span
                                        className={cn(
                                            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                                            anonymousEnabled
                                                ? 'bg-ntrip-teal/13 text-ntrip-teal'
                                                : 'bg-ntrip-ink/8 text-ntrip-ink/52',
                                        )}
                                    >
                                        <AccessIcon className="size-3.5" />
                                    </span>

                                    <div className="min-w-0">
                                        <p className="text-caption font-semibold">
                                            Anonymous access
                                        </p>

                                        <p className="mt-0.5 text-micro leading-4 text-ntrip-ink/46">
                                            {updating
                                                ? 'Updating access mode...'
                                                : anonymousEnabled
                                                  ? 'Rovers can connect without an account.'
                                                  : 'A permitted Rover Account is required.'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={anonymousEnabled}
                                    aria-label={`Anonymous access for ${mountpoint.name}`}
                                    disabled={updating}
                                    onClick={() => {
                                        void onAnonymousAccessChange(
                                            mountpoint.id,
                                            !anonymousEnabled,
                                        );
                                    }}
                                    className={cn(
                                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition',
                                        'focus-visible:ring-2 focus-visible:ring-ntrip-teal/35 focus-visible:outline-none',
                                        anonymousEnabled
                                            ? 'border-ntrip-teal/25 bg-ntrip-teal'
                                            : 'border-ntrip-ink/10 bg-ntrip-ink/16',
                                        updating && 'cursor-wait opacity-65',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'grid size-5 place-items-center rounded-full bg-ntrip-cloud shadow-sm transition-transform',
                                            anonymousEnabled
                                                ? 'translate-x-5'
                                                : 'translate-x-0.5',
                                        )}
                                    >
                                        {updating ? (
                                            <RefreshCw className="size-3 animate-spin text-ntrip-teal" />
                                        ) : null}
                                    </span>
                                </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-ntrip-ink/7 pt-2.5">
                                <span
                                    className={cn(
                                        'rounded-full px-2.5 py-1 text-2xs font-semibold',
                                        anonymousEnabled
                                            ? 'bg-ntrip-teal/12 text-ntrip-teal'
                                            : 'bg-ntrip-ink/7 text-ntrip-ink/56',
                                    )}
                                >
                                    {anonymousEnabled
                                        ? 'Public'
                                        : 'Authenticated'}
                                </span>

                                {mountpoint.station ? (
                                    <Link
                                        href={`/stations/${mountpoint.station.id}`}
                                        className="inline-flex items-center gap-1 text-2xs font-semibold text-ntrip-ink/48 transition hover:text-ntrip-teal"
                                    >
                                        Open Station
                                        <ArrowUpRight className="size-3" />
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
