import { cn } from '@/lib/utils';
import type { StationHealth } from '@/types/ntrip-dashboard';

type StatusPillProps = {
    status: StationHealth;
    label?: string;
    className?: string;
};

const LABELS: Record<StationHealth, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    offline: 'Offline',
};

export function StatusPill({
    status,
    label = LABELS[status],
    className,
}: StatusPillProps) {
    return (
        <span
            data-status={status}
            className={cn(
                'ntrip-status-pill h-7 gap-2 rounded-xl px-2.5 text-xs font-semibold tracking-[-0.01em]',
                className,
            )}
        >
            <span className="ntrip-status-pill__dot size-1.5 rounded-full" />
            {label}
        </span>
    );
}
