import { Head, Link, usePage } from '@inertiajs/react';
import { Cpu, MapPin, Plus, RefreshCw } from 'lucide-react';
import type { SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { usePendingDevices } from '@/features/pending-devices/use-pending-devices';
import { cn } from '@/lib/utils';

import { PendingDevicePanel } from './components/pending-device-panel';
import { StationDirectoryPanel } from './components/station-directory-panel';

type StationsTab = 'stations' | 'pending';

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function readTab(url: string): StationsTab {
    const query = url.split('?')[1] ?? '';

    const parameters = new URLSearchParams(query);

    return parameters.get('tab') === 'pending' ? 'pending' : 'stations';
}

function readSelectedDeviceId(url: string): number | null {
    const query = url.split('?')[1] ?? '';

    const parameters = new URLSearchParams(query);

    const rawDeviceId = parameters.get('device');

    if (rawDeviceId === null) {
        return null;
    }

    const deviceId = Number(rawDeviceId);

    return Number.isInteger(deviceId) && deviceId > 0 ? deviceId : null;
}

export default function Stations() {
    const { url } = usePage();

    const { stations } = useMapDashboard();

    const { devices, pendingCount, isRefreshing, refresh } =
        usePendingDevices();

    const activeTab = readTab(url);

    const selectedDeviceId = readSelectedDeviceId(url);

    return (
        <>
            <Head
                title={activeTab === 'pending' ? 'Pending Devices' : 'Stations'}
            />

            <div
                className={cn(
                    'pointer-events-none',
                    'absolute',
                    'inset-0',
                    'grid',
                    'min-h-0',
                    'grid-rows-[auto_minmax(0,1fr)]',
                    'gap-2',
                    'sm:gap-3',
                    'lg:gap-4',
                )}
            >
                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className={cn('ntrip-glass-panel', [
                        'pointer-events-auto',
                        'flex',
                        'min-h-16',
                        'flex-wrap',
                        'items-center',
                        'justify-between',
                        'gap-3',
                        'rounded-3xl',
                        'px-4',
                        'py-3',
                        'sm:px-5',
                    ])}
                >
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-ntrip-teal">
                            Network management
                        </p>

                        <h1
                            className={cn(
                                'mt-0.5',
                                'truncate',
                                'text-xl',
                                'font-semibold',
                                'tracking-[-0.04em]',
                                'text-ntrip-ink',
                            )}
                        >
                            Stations
                        </h1>

                        <p className="mt-1 hidden text-xs text-ntrip-ink/50 sm:block">
                            {activeTab === 'pending'
                                ? `${pendingCount} awaiting approval · ${devices.length} detected devices`
                                : `${stations.length} configured stations`}
                        </p>
                    </div>

                    <nav
                        aria-label="Station management tabs"
                        className={cn(
                            'order-3',
                            'flex',
                            'w-full',
                            'items-center',
                            'rounded-xl',
                            'bg-ntrip-cloud/46',
                            'p-1',
                            'shadow-ntrip-inset-soft',
                            'sm:order-none',
                            'sm:w-auto',
                        )}
                    >
                        <Link
                            href="/stations"
                            preserveScroll
                            preserveState
                            replace
                            aria-current={
                                activeTab === 'stations' ? 'page' : undefined
                            }
                            className={cn(
                                [
                                    'inline-flex',
                                    'h-9',
                                    'flex-1',
                                    'items-center',
                                    'justify-center',
                                    'gap-2',
                                    'rounded-lg',
                                    'px-3',
                                    'text-xs',
                                    'font-semibold',
                                    'transition',
                                    'sm:flex-none',
                                ],

                                activeTab === 'stations'
                                    ? [
                                          'bg-ntrip-cloud',
                                          'text-ntrip-ink',
                                          'shadow-ntrip-tab',
                                      ]
                                    : [
                                          'text-ntrip-ink/44',
                                          'hover:text-ntrip-ink',
                                      ],
                            )}
                        >
                            <MapPin className="size-3.5" />
                            Stations
                        </Link>

                        <Link
                            href="/stations?tab=pending"
                            preserveScroll
                            preserveState
                            replace
                            aria-current={
                                activeTab === 'pending' ? 'page' : undefined
                            }
                            className={cn(
                                [
                                    'inline-flex',
                                    'h-9',
                                    'flex-1',
                                    'items-center',
                                    'justify-center',
                                    'gap-2',
                                    'rounded-lg',
                                    'px-3',
                                    'text-xs',
                                    'font-semibold',
                                    'transition',
                                    'sm:flex-none',
                                ],

                                activeTab === 'pending'
                                    ? [
                                          'bg-ntrip-cloud',
                                          'text-ntrip-ink',
                                          'shadow-ntrip-tab',
                                      ]
                                    : [
                                          'text-ntrip-ink/44',
                                          'hover:text-ntrip-ink',
                                      ],
                            )}
                        >
                            <Cpu className="size-3.5" />
                            Pending Devices
                            {pendingCount > 0 ? (
                                <span
                                    className={cn(
                                        'inline-flex',
                                        'h-5',
                                        'min-w-5',
                                        'items-center',
                                        'justify-center',
                                        'rounded-full',
                                        'border',
                                        'border-ntrip-amber/30',
                                        'bg-ntrip-amber/18',
                                        'px-1.5',
                                        'text-[10px]',
                                        'font-bold',
                                        'text-ntrip-ink',
                                    )}
                                >
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            ) : null}
                        </Link>
                    </nav>

                    <div className="flex shrink-0 items-center gap-2">
                        {activeTab === 'stations' ? (
                            <>
                                <div
                                    className={cn(
                                        'hidden',
                                        'items-center',
                                        'gap-2',
                                        'rounded-xl',
                                        'bg-ntrip-cloud/68',
                                        'px-3',
                                        'py-2',
                                        'text-xs',
                                        'font-semibold',
                                        'text-ntrip-ink',
                                        'md:flex',
                                    )}
                                >
                                    <MapPin className="size-3.5 text-ntrip-teal" />
                                    {stations.length} locations
                                </div>

                                <Button
                                    asChild
                                    className="h-10 rounded-xl bg-ntrip-ink px-4 text-caption text-ntrip-cloud"
                                >
                                    <Link href="/stations/create">
                                        <Plus className="size-4" />

                                        <span className="hidden sm:inline">
                                            Add station
                                        </span>
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <>
                                <div
                                    className={cn(
                                        'hidden',
                                        'items-center',
                                        'gap-2',
                                        'rounded-xl',
                                        'bg-ntrip-amber/14',
                                        'px-3',
                                        'py-2',
                                        'text-xs',
                                        'font-semibold',
                                        'text-ntrip-ink',
                                        'md:flex',
                                    )}
                                >
                                    <Cpu className="size-3.5 text-ntrip-amber" />
                                    {pendingCount} pending
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={refresh}
                                    disabled={isRefreshing}
                                    className={cn(
                                        'h-10',
                                        'rounded-xl',
                                        'bg-ntrip-cloud/68',
                                        'px-3',
                                        'text-xs',
                                        'font-semibold',
                                        'text-ntrip-ink',
                                        'shadow-ntrip-inset-strong',
                                    )}
                                >
                                    <RefreshCw
                                        className={cn(
                                            'size-4',
                                            isRefreshing && 'animate-spin',
                                        )}
                                    />

                                    <span className="hidden sm:inline">
                                        Refresh
                                    </span>
                                </Button>
                            </>
                        )}
                    </div>
                </section>

                <div className="flex min-h-0 justify-end">
                    {activeTab === 'stations' ? (
                        <StationDirectoryPanel />
                    ) : (
                        <PendingDevicePanel
                            selectedDeviceId={selectedDeviceId}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
