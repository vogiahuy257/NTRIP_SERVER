import { Crosshair, Focus, Minus, Plus } from 'lucide-react';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DashboardMapControlsProps = {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitNetwork: () => void;
    onFocusSelected: () => void;
};

function MapControlButton({
    label,
    children,
    onClick,
}: {
    label: string;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="size-8 rounded-xl bg-ntrip-cloud/68 text-ntrip-ink hover:bg-ntrip-cloud/94"
        >
            {children}
        </Button>
    );
}

export function DashboardMapControls({
    onZoomIn,
    onZoomOut,
    onFitNetwork,
    onFocusSelected,
}: DashboardMapControlsProps) {
    return (
        <div
            className={cn(
                'ntrip-glass-panel',
                'pointer-events-auto absolute bottom-0 left-0 z-30 hidden items-center gap-1 rounded-2xl p-1.5 sm:flex',
            )}
        >
            <MapControlButton label="Zoom in" onClick={onZoomIn}>
                <Plus className="size-3.5" />
            </MapControlButton>

            <MapControlButton label="Zoom out" onClick={onZoomOut}>
                <Minus className="size-3.5" />
            </MapControlButton>

            <MapControlButton label="Fit network" onClick={onFitNetwork}>
                <Focus className="size-3.5" />
            </MapControlButton>

            <MapControlButton
                label="Focus selected item"
                onClick={onFocusSelected}
            >
                <Crosshair className="size-3.5" />
            </MapControlButton>
        </div>
    );
}
