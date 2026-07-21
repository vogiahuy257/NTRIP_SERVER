import { Link, router } from '@inertiajs/react';
import {
    ArrowUpRight,
    Cpu,
    RefreshCw,
    Search,
    Server,
    Wifi,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
    PendingDeviceItem,
    PendingDeviceStatus,
} from '@/features/pending-devices/types';
import { usePendingDevices } from '@/features/pending-devices/use-pending-devices';
import { cn } from '@/lib/utils';
import { PendingDeviceReviewDialog } from './pending-device-review-dialog';

type DeviceStatusFilter = 'all' | PendingDeviceStatus;

type PendingDevicePanelProps = {
    selectedDeviceId: number | null;
};

const STATUS_OPTIONS: Array<{
    value: DeviceStatusFilter;
    label: string;
}> = [
    {
        value: 'all',
        label: 'All devices',
    },
    {
        value: 'pending',
        label: 'Pending approval',
    },
    {
        value: 'approved',
        label: 'Approved',
    },
    {
        value: 'provisioned',
        label: 'Provisioned',
    },
    {
        value: 'rejected',
        label: 'Rejected',
    },
];

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function deviceMatchesSearch(
    device: PendingDeviceItem,
    query: string,
): boolean {
    if (query === '') {
        return true;
    }

    return [
        device.hardwareId,
        device.reportedDeviceId ?? '',
        device.reportedMountpoint ?? '',
        device.firmwareVersion ?? '',
        device.remoteIp ?? '',
        device.station?.name ?? '',
        device.station?.deviceId ?? '',
    ].some((value) => value.toLowerCase().includes(query));
}

function formatTimestamp(value: string | null): string {
    if (value === null) {
        return 'Not reported';
    }

    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        return 'Unknown';
    }

    const date = new Date(timestamp);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    const day = String(date.getUTCDate()).padStart(2, '0');

    const hour = String(date.getUTCHours()).padStart(2, '0');

    const minute = String(date.getUTCMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hour}:${minute} UTC`;
}

function statusLabel(status: PendingDeviceStatus): string {
    switch (status) {
        case 'pending':
            return 'Pending';

        case 'approved':
            return 'Approved';

        case 'provisioned':
            return 'Provisioned';

        case 'rejected':
            return 'Rejected';

        default:
            return 'Unknown';
    }
}

function DeviceStatusPill({ status }: { status: PendingDeviceStatus }) {
    return (
        <span
            className={cn(
                [
                    'inline-flex',
                    'h-6',
                    'shrink-0',
                    'items-center',
                    'rounded-full',
                    'border',
                    'px-2',
                    'text-[10px]',
                    'leading-none',
                    'font-semibold',
                ],

                status === 'pending' && [
                    'border-ntrip-amber/28',
                    'bg-ntrip-amber/15',
                    'text-ntrip-ink',
                ],

                status === 'approved' && [
                    'border-ntrip-teal/25',
                    'bg-ntrip-teal/10',
                    'text-ntrip-teal',
                ],

                status === 'provisioned' && [
                    'border-ntrip-teal/30',
                    'bg-ntrip-teal/16',
                    'text-ntrip-teal',
                ],

                status === 'rejected' && [
                    'border-ntrip-coral/25',
                    'bg-ntrip-coral/10',
                    'text-ntrip-coral',
                ],

                status === 'unknown' && [
                    'border-ntrip-ink/10',
                    'bg-ntrip-cloud/55',
                    'text-ntrip-ink/52',
                ],
            )}
        >
            {statusLabel(status)}
        </span>
    );
}

function PendingDeviceItemRow({
    device,
    selected,
}: {
    device: PendingDeviceItem;
    selected: boolean;
}) {
    const displayName = device.reportedDeviceId ?? device.hardwareId;

    return (
        <Link
            href={`/stations?tab=pending&device=${device.id}`}
            preserveScroll
            preserveState
            replace
            aria-label={`Review device ${device.hardwareId}`}
            className={cn(
                [
                    'group',
                    'relative',
                    'block',
                    'w-full',
                    'overflow-hidden',
                    'rounded-2xl',
                    'px-4',
                    'py-4',
                    'text-left',
                    'outline-none',
                    'transition',
                    'duration-200',
                    'focus-visible:ring-2',
                    'focus-visible:ring-ntrip-teal/35',
                ],

                selected
                    ? ['bg-ntrip-cloud/96', 'shadow-ntrip-selected']
                    : [
                          'bg-ntrip-cloud/56',
                          'shadow-ntrip-inset-soft',
                          'hover:bg-ntrip-cloud/82',
                          'hover:shadow-ntrip-selected-hover',
                      ],
            )}
        >
            <div className="flex min-w-0 items-start gap-3 pr-8">
                <span
                    className={cn(
                        'grid',
                        'size-10',
                        'shrink-0',
                        'place-items-center',
                        'rounded-xl',
                        device.status === 'rejected'
                            ? ['bg-ntrip-coral/10', 'text-ntrip-coral']
                            : ['bg-ntrip-amber/13', 'text-ntrip-ink'],
                    )}
                >
                    <Cpu className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3
                            className={cn(
                                'min-w-0',
                                'flex-1',
                                'truncate',
                                'text-sm',
                                'font-semibold',
                                'tracking-[-0.015em]',
                                'text-ntrip-ink',
                            )}
                        >
                            {displayName}
                        </h3>

                        <DeviceStatusPill status={device.status} />
                    </div>

                    <p
                        className={cn(
                            'mt-1',
                            'truncate',
                            'font-mono',
                            'text-[11px]',
                            'text-ntrip-ink/48',
                        )}
                    >
                        {device.hardwareId}
                    </p>

                    <div className="mt-3 grid gap-1.5 text-xs text-ntrip-ink/48">
                        <div className="flex min-w-0 items-center gap-2">
                            <Server className="size-3 shrink-0 text-ntrip-teal" />

                            <span className="truncate">
                                {device.reportedMountpoint ??
                                    'Mountpoint not reported'}
                            </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                            <Wifi className="size-3 shrink-0 text-ntrip-teal" />

                            <span className="truncate">
                                {device.remoteIp ?? 'IP unavailable'}

                                {device.firmwareVersion
                                    ? ` · Firmware ${device.firmwareVersion}`
                                    : ''}
                            </span>
                        </div>
                    </div>

                    <div
                        className={cn(
                            'mt-3',
                            'flex',
                            'flex-wrap',
                            'items-center',
                            'gap-x-3',
                            'gap-y-1',
                            'text-[11px]',
                            'text-ntrip-ink/38',
                        )}
                    >
                        <span>
                            Last seen {formatTimestamp(device.lastSeenAt)}
                        </span>

                        <span>
                            {device.connectionAttempts} connection attempts
                        </span>
                    </div>
                </div>
            </div>

            <ArrowUpRight
                className={cn(
                    'absolute',
                    'top-3.5',
                    'right-3.5',
                    'size-4',
                    'text-ntrip-ink/30',
                    'transition',
                    'duration-200',
                    'group-hover:translate-x-0.5',
                    'group-hover:-translate-y-0.5',
                    'group-hover:text-ntrip-teal',
                )}
            />
        </Link>
    );
}

export function PendingDevicePanel({
    selectedDeviceId,
}: PendingDevicePanelProps) {
    const { devices, pendingCount, isLoading, isRefreshing, error, refresh } =
        usePendingDevices();

    const [searchQuery, setSearchQuery] = useState('');

    const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>('all');

    const filteredDevices = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return devices.filter((device) => {
            const matchesStatus =
                statusFilter === 'all' || device.status === statusFilter;

            return (
                matchesStatus && deviceMatchesSearch(device, normalizedQuery)
            );
        });
    }, [devices, searchQuery, statusFilter]);

    const selectedDevice =
        selectedDeviceId === null
            ? null
            : (devices.find((device) => device.id === selectedDeviceId) ??
              null);

    function closeSelectedDevice(): void {
        router.visit('/stations?tab=pending', {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    }

    return (
        <section
            onPointerDown={stopMapEvent}
            onDoubleClick={stopMapEvent}
            onWheel={stopMapEvent}
            className={cn('ntrip-glass-panel-dense', [
                'pointer-events-auto',
                'flex',
                'h-full',
                'min-h-0',
                'w-full',
                'flex-col',
                'overflow-hidden',
                'rounded-2xl',
                'sm:max-w-120',
                'lg:max-w-128',
            ])}
        >
            <header
                className={cn(
                    'border-b',
                    'border-ntrip-ink/8',
                    'px-4',
                    'py-4',
                    'sm:px-5',
                )}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-ntrip-amber">
                            Device provisioning
                        </p>

                        <h2
                            className={cn(
                                'mt-1',
                                'text-lg',
                                'font-semibold',
                                'tracking-[-0.03em]',
                                'text-ntrip-ink',
                            )}
                        >
                            Pending devices
                        </h2>

                        <p className="mt-1 text-xs text-ntrip-ink/48">
                            {pendingCount} awaiting approval
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isLoading || isRefreshing}
                        onClick={refresh}
                        aria-label="Refresh pending devices"
                        className={cn(
                            'size-9',
                            'rounded-xl',
                            'bg-ntrip-cloud/68',
                            'text-ntrip-ink/60',
                            'hover:bg-ntrip-cloud',
                            'hover:text-ntrip-ink',
                        )}
                    >
                        <RefreshCw
                            className={cn(
                                'size-4',
                                isRefreshing && 'animate-spin',
                            )}
                        />
                    </Button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="relative">
                        <Search
                            className={cn(
                                'pointer-events-none',
                                'absolute',
                                'top-1/2',
                                'left-3',
                                'size-3.5',
                                '-translate-y-1/2',
                                'text-ntrip-ink/34',
                            )}
                        />

                        <Input
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                            }}
                            placeholder="Search hardware, IP, mountpoint"
                            className={cn(
                                'h-9',
                                'rounded-xl',
                                'border-ntrip-ink/9',
                                'bg-ntrip-cloud/72',
                                'pl-9',
                                'text-xs',
                            )}
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(
                                event.target.value as DeviceStatusFilter,
                            );
                        }}
                        aria-label="Filter devices by status"
                        className={cn(
                            'h-9',
                            'rounded-xl',
                            'border',
                            'border-ntrip-ink/9',
                            'bg-ntrip-cloud/72',
                            'px-3',
                            'text-xs',
                            'font-semibold',
                            'text-ntrip-ink',
                            'outline-none',
                            'focus:border-ntrip-teal/30',
                        )}
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {error !== null ? (
                    <div
                        className={cn(
                            'mt-3',
                            'rounded-xl',
                            'border',
                            'border-ntrip-coral/24',
                            'bg-ntrip-coral/9',
                            'px-3',
                            'py-2',
                            'text-xs',
                            'font-medium',
                            'text-ntrip-coral',
                        )}
                    >
                        {error}
                    </div>
                ) : null}
            </header>

            <div
                className={cn(
                    'min-h-0',
                    'flex-1',
                    'overflow-y-auto',
                    'p-3',
                    'sm:p-4',
                )}
            >
                {isLoading ? (
                    <div className="grid h-full min-h-52 place-items-center">
                        <div className="text-center">
                            <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />

                            <p className="mt-3 text-xs font-semibold text-ntrip-ink">
                                Loading devices
                            </p>
                        </div>
                    </div>
                ) : null}

                {!isLoading && filteredDevices.length === 0 ? (
                    <div
                        className={cn(
                            'grid',
                            'h-full',
                            'min-h-52',
                            'place-items-center',
                            'rounded-2xl',
                            'border',
                            'border-dashed',
                            'border-ntrip-ink/10',
                            'bg-ntrip-cloud/36',
                            'px-6',
                            'text-center',
                        )}
                    >
                        <div>
                            <span
                                className={cn(
                                    'mx-auto',
                                    'grid',
                                    'size-11',
                                    'place-items-center',
                                    'rounded-2xl',
                                    'bg-ntrip-teal/10',
                                    'text-ntrip-teal',
                                )}
                            >
                                <Cpu className="size-5" />
                            </span>

                            <h3 className="mt-3 text-sm font-semibold text-ntrip-ink">
                                No devices found
                            </h3>

                            <p className="mt-1 text-xs text-ntrip-ink/46">
                                New ESP32 sources will appear here
                                automatically.
                            </p>
                        </div>
                    </div>
                ) : null}

                {!isLoading && filteredDevices.length > 0 ? (
                    <div className="grid gap-2.5">
                        {filteredDevices.map((device) => (
                            <PendingDeviceItemRow
                                key={device.id}
                                device={device}
                                selected={device.id === selectedDeviceId}
                            />
                        ))}
                    </div>
                ) : null}
            </div>

            {selectedDevice !== null ? (
                <PendingDeviceReviewDialog
                    key={selectedDevice.id}
                    device={selectedDevice}
                    onClose={closeSelectedDevice}
                />
            ) : null}
        </section>
    );
}
