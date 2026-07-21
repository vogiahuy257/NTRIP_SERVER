const decimalFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function formatThroughput(
    bytesPerSecond: number | null | undefined,
): string {
    if (!isFiniteNumber(bytesPerSecond)) {
        return '—';
    }

    const value = Math.max(0, bytesPerSecond);

    if (value >= 1_000_000) {
        return `${decimalFormatter.format(value / 1_000_000)} MB/s`;
    }

    if (value >= 1_000) {
        return `${decimalFormatter.format(value / 1_000)} KB/s`;
    }

    return `${integerFormatter.format(value)} B/s`;
}

export function formatBytes(bytes: number | null | undefined): string {
    if (!isFiniteNumber(bytes)) {
        return '—';
    }

    const value = Math.max(0, bytes);

    if (value >= 1_000_000_000) {
        return `${decimalFormatter.format(value / 1_000_000_000)} GB`;
    }

    if (value >= 1_000_000) {
        return `${decimalFormatter.format(value / 1_000_000)} MB`;
    }

    if (value >= 1_000) {
        return `${decimalFormatter.format(value / 1_000)} KB`;
    }

    return `${integerFormatter.format(value)} B`;
}

export function formatRatio(ratio: number | null | undefined): string {
    if (!isFiniteNumber(ratio)) {
        return '—';
    }

    return `${decimalFormatter.format(Math.max(0, ratio) * 100)}%`;
}

export function formatDuration(
    milliseconds: number | null | undefined,
): string {
    if (!isFiniteNumber(milliseconds)) {
        return '—';
    }

    const value = Math.max(0, milliseconds);

    if (value >= 1000) {
        return `${decimalFormatter.format(value / 1000)} s`;
    }

    return `${decimalFormatter.format(value)} ms`;
}

export function formatCount(value: number | null | undefined): string {
    if (!isFiniteNumber(value)) {
        return '—';
    }

    return integerFormatter.format(Math.max(0, value));
}

export function formatTimeLabel(date: Date, windowMinutes: number): string {
    return windowMinutes >= 1440
        ? dateTimeFormatter.format(date)
        : timeFormatter.format(date);
}

export function formatSnapshotAge(milliseconds: number | null): string {
    if (milliseconds === null) {
        return 'No snapshot';
    }

    if (milliseconds < 1000) {
        return 'Updated now';
    }

    return `Updated ${formatDuration(milliseconds)} ago`;
}
