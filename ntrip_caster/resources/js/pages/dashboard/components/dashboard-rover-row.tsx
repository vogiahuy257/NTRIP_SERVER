import { MapPin, Satellite } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
    getDashboardRoverName,
    hasRoverGgaData,
    hasRoverMapPosition,
} from '@/realtime/dashboard-session-selectors';
import type { DashboardRoverSession } from '@/types/ntrip-dashboard';

import {
    formatRoverAltitude,
    formatRoverCoordinate,
    formatRoverFix,
    formatRoverHdop,
    formatRoverMountpoint,
    formatRoverSatellites,
} from '../lib/dashboard-rover-formatters';

type DashboardRoverRowProps = {
    rover: DashboardRoverSession;
    selected: boolean;
    onClick: () => void;
};

type RoverValueProps = {
    label: string;
    value: string;
};

function RoverValue({ label, value }: RoverValueProps) {
    return (
        <span className="min-w-0 rounded-control-xs bg-ntrip-cloud/46 px-2 py-1.5 shadow-ntrip-inset-soft">
            <span className="block text-2xs font-medium tracking-[0.08em] text-ntrip-ink/42 uppercase">
                {label}
            </span>

            <span className="mt-0.5 block truncate text-xs font-semibold text-ntrip-ink tabular-nums">
                {value}
            </span>
        </span>
    );
}

export function DashboardRoverRow({
    rover,
    selected,
    onClick,
}: DashboardRoverRowProps) {
    const hasGga = hasRoverGgaData(rover);
    const onMap = hasRoverMapPosition(rover);

    const statusLabel = onMap
        ? 'On map'
        : hasGga
          ? 'No position'
          : 'Awaiting GGA';

    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                'mt-1 w-full rounded-xl border border-ntrip-ink/8 bg-ntrip-cloud/75 px-2.5 py-2 text-left shadow-ntrip-panel transition',

                selected
                    ? 'bg-ntrip-cloud/92 shadow-ntrip-inset-strong'
                    : 'hover:bg-ntrip-cloud/58 focus-visible:bg-ntrip-cloud/58',
            )}
        >
            <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                    <span
                        className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-xl',

                            onMap
                                ? 'bg-ntrip-teal/12 text-ntrip-teal'
                                : hasGga
                                  ? 'bg-ntrip-coral/10 text-ntrip-coral'
                                  : 'bg-ntrip-amber/12 text-ntrip-amber',
                        )}
                    >
                        {onMap ? (
                            <MapPin className="size-3.5" />
                        ) : (
                            <Satellite className="size-3.5" />
                        )}
                    </span>

                    <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-ntrip-ink">
                            {getDashboardRoverName(rover)}
                        </span>

                        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ntrip-ink/62">
                            <span className="truncate">
                                {formatRoverMountpoint(rover)}
                            </span>

                            <span>·</span>

                            <span className="shrink-0">
                                Session {String(rover.id)}
                            </span>
                        </span>
                    </span>
                </span>

                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-1 text-2xs font-semibold',

                        onMap
                            ? 'bg-ntrip-teal/12 text-ntrip-teal'
                            : hasGga
                              ? 'bg-ntrip-coral/10 text-ntrip-coral'
                              : 'bg-ntrip-amber/12 text-ntrip-ink/68',
                    )}
                >
                    {statusLabel}
                </span>
            </span>

            <span className="mt-2 grid grid-cols-3 gap-1.5">
                <RoverValue
                    label="Latitude"
                    value={formatRoverCoordinate(rover.roverLatitude, hasGga)}
                />

                <RoverValue
                    label="Longitude"
                    value={formatRoverCoordinate(rover.roverLongitude, hasGga)}
                />

                <RoverValue
                    label="Altitude"
                    value={formatRoverAltitude(rover.roverAltitudeM, hasGga)}
                />

                <RoverValue
                    label="Fix"
                    value={formatRoverFix(rover.roverFixType, hasGga)}
                />

                <RoverValue
                    label="Satellites"
                    value={formatRoverSatellites(rover.roverSatellites, hasGga)}
                />

                <RoverValue
                    label="HDOP"
                    value={formatRoverHdop(rover.roverHdop, hasGga)}
                />
            </span>
        </button>
    );
}
