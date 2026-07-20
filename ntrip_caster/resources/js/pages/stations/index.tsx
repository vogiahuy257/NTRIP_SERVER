import { Head, Link } from '@inertiajs/react';
import { MapPin, Plus } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';

import { StationDirectoryPanel } from './components/station-directory-panel';

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

export default function Stations() {
    const { stations, selectedStation } = useMapDashboard();

    return (
        <>
            <Head title="Stations" />

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
                        'items-center',
                        'justify-between',
                        'gap-4',
                        'rounded-3xl',
                        'px-4',
                        'py-3',
                        'sm:px-5',
                    ])}
                >
                    <div className="min-w-0">
                        <p
                            className={cn(
                                'text-xs',
                                'font-semibold',
                                'text-ntrip-teal',
                            )}
                        >
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

                        <p
                            className={cn(
                                'mt-1',
                                'hidden',
                                'text-xs',
                                'text-ntrip-ink/50',
                                'sm:block',
                            )}
                        >
                            {stations.length} configured stations
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
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
                            <MapPin
                                className={cn('size-3.5', 'text-ntrip-teal')}
                            />
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
                    </div>
                </section>

                <div className={cn('flex', 'min-h-0', 'justify-end')}>
                    <StationDirectoryPanel />
                </div>
            </div>
        </>
    );
}
