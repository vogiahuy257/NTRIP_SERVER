import { Link } from '@inertiajs/react';
import { ArrowUpRight, RadioTower, Server, Wifi } from 'lucide-react';

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

export function MountpointDirectoryPanel({
    mountpoints,
}: {
    mountpoints: MountpointWithSessions[];
}) {
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
                return (
                    <Link
                        key={mountpoint.id}
                        href={
                            mountpoint.station
                                ? `/stations/${mountpoint.station.id}`
                                : '/stations'
                        }
                        className={cn(
                            'group relative overflow-hidden rounded-control-lg border p-4 pr-11 transition',
                            'border-ntrip-ink/8 bg-ntrip-cloud/75 shadow-ntrip-panel',
                            'hover:-translate-y-0.5 hover:border-ntrip-teal/50 hover:shadow-ntrip-panel-soft',
                        )}
                    >
                        <ArrowUpRight className="absolute top-4 right-4 size-4 text-ntrip-ink/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ntrip-teal" />

                        <div className="flex items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-teal/12 text-ntrip-teal">
                                <RadioTower className="size-4" />
                            </span>

                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-semibold tracking-[-0.015em]">
                                    {mountpoint.name}
                                </h2>
                                <p className="mt-1 truncate text-micro text-ntrip-ink/46">
                                    {mountpoint.identifier ??
                                        'NTRIP correction stream'}
                                </p>
                            </div>
                        </div>

                        <dl className="mt-4 grid gap-2 text-micro">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="inline-flex items-center gap-1.5 text-ntrip-ink/44">
                                    <Server className="size-3" /> Source
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
                                    <Wifi className="size-3" /> Rovers
                                </dt>
                                <dd className="font-medium tabular-nums">
                                    {mountpoint.roverCount}
                                </dd>
                            </div>
                        </dl>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ntrip-ink/7 pt-3 text-2xs">
                            <span
                                data-status={mountpoint.status}
                                className="ntrip-status-inline inline-flex items-center gap-1.5 font-semibold"
                            >
                                <span className="ntrip-status-inline__dot size-2 rounded-full" />
                                {STATUS_LABELS[mountpoint.status]}
                            </span>

                            <span className="font-mono text-ntrip-ink/44">
                                {formatBitrate(mountpoint.uploadBps)}
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
