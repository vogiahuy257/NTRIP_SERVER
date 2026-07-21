import type {
    RtcmFlowHistoryMeta,
    RtcmFlowHistoryPoint,
    RtcmFlowHistoryRequestResolution,
    RtcmFlowHistoryResolution,
    RtcmFlowHistoryResult,
    RtcmFlowMountpointSnapshot,
    RtcmFlowRoverSnapshot,
    RtcmFlowSnapshot,
    RtcmFlowSnapshotResult,
} from './rtcm-flow-types';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as UnknownRecord;
}

function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function asNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const result = asNumber(value, Number.NaN);

    return Number.isFinite(result) ? result : null;
}

function asNonNegativeNumber(value: unknown, fallback = 0): number {
    return Math.max(0, asNumber(value, fallback));
}

function asInteger(value: unknown, fallback = 0): number {
    return Math.trunc(asNumber(value, fallback));
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
    return Math.max(0, asInteger(value, fallback));
}

function asPositiveInteger(value: unknown): number | null {
    const result = asInteger(value, 0);

    return result > 0 ? result : null;
}

function asBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    return value === 1 || value === '1' || value === 'true';
}

function asDate(value: unknown): Date | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date : null;
}

function requiredDate(value: unknown, field: string): Date {
    const date = asDate(value);

    if (date === null) {
        throw new Error(`Invalid RTCM observability date: ${field}.`);
    }

    return date;
}

function normaliseRequestedResolution(
    value: unknown,
): RtcmFlowHistoryRequestResolution {
    if (value === 'detail' || value === 'minute') {
        return value;
    }

    return 'auto';
}

function normaliseResolution(value: unknown): RtcmFlowHistoryResolution {
    return value === 'minute' ? 'minute' : 'detail';
}

function normaliseMountpoint(
    value: unknown,
): RtcmFlowMountpointSnapshot | null {
    const item = asRecord(value);

    if (item === null) {
        return null;
    }

    const mountpointId = asPositiveInteger(item.mountpoint_id);

    if (mountpointId === null) {
        return null;
    }

    return {
        mountpointId,

        sourceConnected: asBoolean(item.source_connected),

        sourceBytesDelta: asNonNegativeInteger(item.source_bytes_delta),

        sourceBps: asNonNegativeInteger(item.source_bps),

        sourceChunksDelta: asNonNegativeInteger(item.source_chunks_delta),

        sourceLastReceivedAgeMs: asNullableNumber(
            item.source_last_received_age_ms,
        ),

        sourceGapMaxMs: asNonNegativeNumber(item.source_gap_max_ms),

        activeRovers: asNonNegativeInteger(item.active_rovers),

        expectedEgressBytesDelta: asNonNegativeInteger(
            item.expected_egress_bytes_delta,
        ),

        queuedEgressBytesDelta: asNonNegativeInteger(
            item.queued_egress_bytes_delta,
        ),

        writtenEgressBytesDelta: asNonNegativeInteger(
            item.written_egress_bytes_delta,
        ),

        expectedEgressBps: asNonNegativeInteger(item.expected_egress_bps),

        queuedEgressBps: asNonNegativeInteger(item.queued_egress_bps),

        writtenEgressBps: asNonNegativeInteger(item.written_egress_bps),

        fanoutCoverage: asNullableNumber(item.fanout_coverage),

        socketDrainRatio: asNullableNumber(item.socket_drain_ratio),

        fanoutCount: asNonNegativeInteger(item.fanout_count),

        fanoutDurationAvgMs: asNonNegativeNumber(item.fanout_duration_avg_ms),

        fanoutDurationP95Ms: asNonNegativeNumber(item.fanout_duration_p95_ms),

        fanoutDurationMaxMs: asNonNegativeNumber(item.fanout_duration_max_ms),

        backlogBytes: asNonNegativeInteger(item.backlog_bytes),

        maximumRoverBufferBytes: asNonNegativeInteger(
            item.maximum_rover_buffer_bytes,
        ),

        maximumBufferAgeMs: asNonNegativeNumber(item.maximum_buffer_age_ms),

        partialWritesDelta: asNonNegativeInteger(item.partial_writes_delta),

        zeroWritesDelta: asNonNegativeInteger(item.zero_writes_delta),

        writeFailuresDelta: asNonNegativeInteger(item.write_failures_delta),
    };
}

function normaliseRover(value: unknown): RtcmFlowRoverSnapshot | null {
    const item = asRecord(value);

    if (item === null) {
        return null;
    }

    const sessionId = asPositiveInteger(item.session_id);

    const mountpointId = asPositiveInteger(item.mountpoint_id);

    if (sessionId === null || mountpointId === null) {
        return null;
    }

    return {
        sessionId,
        mountpointId,

        queuedBytesDelta: asNonNegativeInteger(item.queued_bytes_delta),

        queuedBps: asNonNegativeInteger(item.queued_bps),

        writtenBytesDelta: asNonNegativeInteger(item.written_bytes_delta),

        writtenBps: asNonNegativeInteger(item.written_bps),

        currentBufferBytes: asNonNegativeInteger(item.current_buffer_bytes),

        currentBufferAgeMs: asNonNegativeNumber(item.current_buffer_age_ms),

        maximumBufferBytes: asNonNegativeInteger(item.maximum_buffer_bytes),

        maximumBufferAgeMs: asNonNegativeNumber(item.maximum_buffer_age_ms),

        lastSuccessfulWriteAgeMs: asNullableNumber(
            item.last_successful_write_age_ms,
        ),

        partialWritesDelta: asNonNegativeInteger(item.partial_writes_delta),

        zeroWritesDelta: asNonNegativeInteger(item.zero_writes_delta),

        writeFailuresDelta: asNonNegativeInteger(item.write_failures_delta),
    };
}

export function normaliseRtcmFlowSnapshot(
    value: unknown,
): RtcmFlowSnapshot | null {
    const root = asRecord(value);

    if (root === null) {
        return null;
    }

    const sequence = asPositiveInteger(root.sequence);

    const emittedAtUnixMs = asNonNegativeInteger(root.emitted_at_unix_ms);

    const emittedAt = asDate(emittedAtUnixMs);

    if (sequence === null || emittedAt === null) {
        return null;
    }

    const processIdValue = root.process_id;

    const processId =
        processIdValue === null ? null : asPositiveInteger(processIdValue);

    return {
        version: asPositiveInteger(root.version) ?? 1,

        sequence,
        processId,

        emittedAtUnixMs,
        emittedAt,

        intervalMs: Math.max(1, asNonNegativeInteger(root.interval_ms, 1000)),

        baseline: asBoolean(root.baseline),

        sequenceGap: asNonNegativeInteger(root.sequence_gap),

        mountpoints: asList(root.mountpoints)
            .map(normaliseMountpoint)
            .filter(
                (item): item is RtcmFlowMountpointSnapshot => item !== null,
            ),

        rovers: asList(root.rovers)
            .map(normaliseRover)
            .filter((item): item is RtcmFlowRoverSnapshot => item !== null),
    };
}

export function normaliseRtcmFlowSnapshotResponse(
    payload: unknown,
): RtcmFlowSnapshotResult {
    const root = asRecord(payload);

    if (root === null) {
        throw new Error('Invalid RTCM snapshot response.');
    }

    const meta = asRecord(root.meta);

    const snapshot =
        root.data === null ? null : normaliseRtcmFlowSnapshot(root.data);

    if (root.data !== null && snapshot === null) {
        throw new Error('Invalid RTCM snapshot payload.');
    }

    return {
        snapshot,

        available:
            meta === null ? snapshot !== null : asBoolean(meta.available),

        servedAt:
            meta === null
                ? new Date()
                : requiredDate(meta.served_at, 'meta.served_at'),
    };
}

function normaliseHistoryPoint(value: unknown): RtcmFlowHistoryPoint | null {
    const item = asRecord(value);

    if (item === null) {
        return null;
    }

    const timestamp = asDate(item.timestamp);

    if (timestamp === null) {
        return null;
    }

    return {
        timestamp,

        intervalMs: asNonNegativeInteger(item.interval_ms),

        sampleCount: asNonNegativeInteger(item.sample_count),

        sourceConnectedRatio: asNonNegativeNumber(item.source_connected_ratio),

        sourceBps: asNonNegativeInteger(item.source_bps),

        sourceBpsMax: asNonNegativeInteger(item.source_bps_max),

        sourceLastReceivedAgeMs: asNullableNumber(
            item.source_last_received_age_ms,
        ),

        sourceGapMaxMs: asNonNegativeNumber(item.source_gap_max_ms),

        activeRovers: asNonNegativeNumber(item.active_rovers),

        activeRoversMax: asNonNegativeInteger(item.active_rovers_max),

        expectedEgressBps: asNonNegativeInteger(item.expected_egress_bps),

        expectedEgressBpsMax: asNonNegativeInteger(
            item.expected_egress_bps_max,
        ),

        queuedEgressBps: asNonNegativeInteger(item.queued_egress_bps),

        queuedEgressBpsMax: asNonNegativeInteger(item.queued_egress_bps_max),

        writtenEgressBps: asNonNegativeInteger(item.written_egress_bps),

        writtenEgressBpsMax: asNonNegativeInteger(item.written_egress_bps_max),

        fanoutCoverage: asNullableNumber(item.fanout_coverage),

        fanoutCoverageMin: asNullableNumber(item.fanout_coverage_min),

        socketDrainRatio: asNullableNumber(item.socket_drain_ratio),

        socketDrainRatioMin: asNullableNumber(item.socket_drain_ratio_min),

        fanoutDurationAvgMs: asNonNegativeNumber(item.fanout_duration_avg_ms),

        fanoutDurationP95Ms: asNonNegativeNumber(item.fanout_duration_p95_ms),

        fanoutDurationMaxMs: asNonNegativeNumber(item.fanout_duration_max_ms),

        backlogBytes: asNonNegativeInteger(item.backlog_bytes),

        backlogBytesMax: asNonNegativeInteger(item.backlog_bytes_max),

        maximumRoverBufferBytes: asNonNegativeInteger(
            item.maximum_rover_buffer_bytes,
        ),

        maximumBufferAgeMs: asNonNegativeNumber(item.maximum_buffer_age_ms),

        partialWrites: asNonNegativeInteger(item.partial_writes),

        zeroWrites: asNonNegativeInteger(item.zero_writes),

        writeFailures: asNonNegativeInteger(item.write_failures),
    };
}

function normaliseHistoryMeta(value: unknown): RtcmFlowHistoryMeta {
    const meta = asRecord(value);

    if (meta === null) {
        throw new Error('Invalid RTCM history metadata.');
    }

    const mountpointId = asPositiveInteger(meta.mountpoint_id);

    if (mountpointId === null) {
        throw new Error('Invalid RTCM history mountpoint.');
    }

    return {
        mountpointId,

        requestedResolution: normaliseRequestedResolution(
            meta.requested_resolution,
        ),

        resolution: normaliseResolution(meta.resolution),

        requestedFrom: requiredDate(meta.requested_from, 'meta.requested_from'),

        requestedTo: requiredDate(meta.requested_to, 'meta.requested_to'),

        effectiveFrom: requiredDate(meta.effective_from, 'meta.effective_from'),

        effectiveTo: requiredDate(meta.effective_to, 'meta.effective_to'),

        retentionClamped: asBoolean(meta.retention_clamped),

        originalPointCount: asNonNegativeInteger(meta.original_point_count),

        returnedPointCount: asNonNegativeInteger(meta.returned_point_count),

        maxPoints: asNonNegativeInteger(meta.max_points),

        downsampled: asBoolean(meta.downsampled),
    };
}

export function normaliseRtcmFlowHistoryResponse(
    payload: unknown,
): RtcmFlowHistoryResult {
    const root = asRecord(payload);

    if (root === null) {
        throw new Error('Invalid RTCM history response.');
    }

    return {
        points: asList(root.data)
            .map(normaliseHistoryPoint)
            .filter((point): point is RtcmFlowHistoryPoint => point !== null),

        meta: normaliseHistoryMeta(root.meta),
    };
}
