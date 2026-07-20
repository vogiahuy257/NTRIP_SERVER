export function formatBps(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}k`;
    }

    return String(Math.round(value));
}

export function formatInteger(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatHeap(value: number | null): string {
    if (value === null) {
        return '—';
    }

    return `${Math.round(value / 1024)} KB`;
}

export function formatLastSeen(value: string | null): string {
    if (!value) {
        return 'No telemetry';
    }

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
        return 'Unknown';
    }

    const elapsedSeconds = Math.max(
        0,
        Math.round((Date.now() - timestamp) / 1000),
    );

    if (elapsedSeconds < 5) {
        return 'Just now';
    }

    if (elapsedSeconds < 60) {
        return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.round(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.round(elapsedMinutes / 60);

    if (elapsedHours < 24) {
        return `${elapsedHours}h ago`;
    }

    return `${Math.round(elapsedHours / 24)}d ago`;
}
