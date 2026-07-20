import type { DashboardSession } from '@/types/ntrip-dashboard';

export function formatBytes(bytes: number): string {
    if (bytes >= 1_073_741_824) {
        return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    }

    if (bytes >= 1_048_576) {
        return `${(bytes / 1_048_576).toFixed(1)} MB`;
    }

    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${Math.max(0, bytes)} B`;
}

export function formatDateTime(value: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
}

export function formatDuration(
    session: DashboardSession,
    now = Date.now(),
): string {
    if (!session.connectedAt) {
        return '—';
    }

    const startedAt = new Date(session.connectedAt).getTime();

    if (!Number.isFinite(startedAt)) {
        return '—';
    }

    const endedAt = session.disconnectedAt
        ? new Date(session.disconnectedAt).getTime()
        : now;

    const elapsedSeconds = Math.max(
        0,
        Math.floor((endedAt - startedAt) / 1000),
    );

    const hours = Math.floor(elapsedSeconds / 3600);

    const minutes = Math.floor((elapsedSeconds % 3600) / 60);

    const seconds = elapsedSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}

export function getSessionIdentity(session: DashboardSession): string {
    if (session.authenticatedUsername) {
        return session.authenticatedUsername;
    }

    return session.connectionType === 'source'
        ? 'Station source'
        : 'Anonymous rover';
}

export function getMountpointName(session: DashboardSession): string {
    return session.mountpoint?.name ?? 'Unknown mountpoint';
}

export function getStationName(session: DashboardSession): string {
    return session.mountpoint?.station?.name ?? 'Unknown station';
}
