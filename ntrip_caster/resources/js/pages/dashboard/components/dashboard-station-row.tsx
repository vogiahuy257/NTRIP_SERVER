import { cn } from '@/lib/utils';
import type { DashboardStation } from '@/types/ntrip-dashboard';

import { formatBps, formatLastSeen } from '../lib/dashboard-formatters';
import { HEALTH_LABELS } from './dashboard-types';

type DashboardStationRowProps = {
    station: DashboardStation;
    selected: boolean;
    onClick: () => void;
    onHoverChange: (hovered: boolean) => void;
};

export function DashboardStationRow({
    station,
    selected,
    onClick,
    onHoverChange,
}: DashboardStationRowProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
            onFocus={() => onHoverChange(true)}
            onBlur={() => onHoverChange(false)}
            className={cn(
                'grid w-full grid-cols-[minmax(0,1fr)_auto] mt-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                'bg-ntrip-cloud/75 border-ntrip-ink/8 shadow-ntrip-panel',
                selected
                    ? 'bg-ntrip-cloud/92 shadow-ntrip-inset-strong'
                    : 'hover:bg-ntrip-cloud/58 focus-visible:bg-ntrip-cloud/58',
            )}
        >
            <span className="flex min-w-0 items-center gap-2.5">
                <span
                    data-status={station.health}
                    className="ntrip-status-dot size-2 shrink-0 rounded-full"
                />

                <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-ntrip-ink">
                        {station.name}
                    </span>

                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ntrip-ink/62">
                        <span className="truncate">{station.deviceId}</span>
                        <span>·</span>
                        <span className="shrink-0">
                            {HEALTH_LABELS[station.health]}
                        </span>
                        <span>·</span>
                        <span className="shrink-0">
                            {station.activeRovers} rover
                            {station.activeRovers === 1 ? '' : 's'}
                        </span>
                    </span>
                </span>
            </span>

            <span className="shrink-0 text-right">
                <span className="block text-xs font-semibold text-ntrip-ink tabular-nums">
                    {formatBps(station.uploadBps)}
                    <span className="ml-1 font-medium text-ntrip-ink/34">
                        bps
                    </span>
                </span>

                <span className="mt-0.5 block text-xs text-ntrip-ink/38">
                    {formatLastSeen(station.lastSeenAt)}
                </span>
            </span>
        </button>
    );
}
