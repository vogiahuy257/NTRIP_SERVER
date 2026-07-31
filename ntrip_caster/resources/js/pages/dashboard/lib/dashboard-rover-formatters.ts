import type {
    DashboardRoverFixType,
    DashboardRoverSession,
} from '@/types/ntrip-dashboard';

const FIX_LABELS: Record<DashboardRoverFixType, string> = {
    no_fix: 'No fix',
    gps_fix: 'GPS fix',
    dgps: 'DGPS',
    rtk_fixed: 'RTK fixed',
    rtk_float: 'RTK float',
    estimated: 'Estimated',
    unknown: 'Unknown',
};

export function formatRoverCoordinate(
    value: number | null,
    hasGga: boolean,
): string {
    if (!hasGga || value === null) {
        return '-';
    }

    return value.toFixed(7);
}

export function formatRoverAltitude(
    value: number | null,
    hasGga: boolean,
): string {
    if (!hasGga || value === null) {
        return '-';
    }

    return `${value.toFixed(2)} m`;
}

export function formatRoverFix(
    value: DashboardRoverFixType | null,
    hasGga: boolean,
): string {
    if (!hasGga || value === null) {
        return '-';
    }

    return FIX_LABELS[value];
}

export function formatRoverSatellites(
    value: number | null,
    hasGga: boolean,
): string {
    if (!hasGga || value === null) {
        return '-';
    }

    return String(value);
}

export function formatRoverHdop(value: number | null, hasGga: boolean): string {
    if (!hasGga || value === null) {
        return '-';
    }

    return value.toFixed(2);
}

export function formatRoverMountpoint(rover: DashboardRoverSession): string {
    return rover.mountpoint?.name ?? 'Unassigned';
}
