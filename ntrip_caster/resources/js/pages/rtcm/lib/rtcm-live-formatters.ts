export function formatBytes(value: number): string {
    if (value >= 1_073_741_824) {
        return `${(value / 1_073_741_824).toFixed(1)} GB`;
    }

    if (value >= 1_048_576) {
        return `${(value / 1_048_576).toFixed(1)} MB`;
    }

    if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${Math.max(0, Math.round(value))} B`;
}

export function formatBytesPerSecond(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)} MB/s`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} kB/s`;
    }

    return `${Math.max(0, value).toFixed(0)} B/s`;
}

export function formatRate(value: number, unit: string): string {
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k ${unit}`;
    }

    if (value >= 100) {
        return `${value.toFixed(0)} ${unit}`;
    }

    return `${value.toFixed(1)} ${unit}`;
}

export function formatSampleWindow(seconds: number): string {
    if (seconds <= 0) {
        return 'Waiting for next sample';
    }

    return `${seconds.toFixed(1)} s window`;
}

export function formatTimestamp(value: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date);
}
