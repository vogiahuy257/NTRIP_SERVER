import type {
    RtcmFlowMountpointSnapshot,
    RtcmFlowSnapshot,
} from './rtcm-flow-types';

export type RtcmFlowDiagnosisStatus =
    'unknown' | 'healthy' | 'warning' | 'critical';

export type RtcmFlowDiagnosisTarget = 'base' | 'caster' | 'rover';

export type RtcmFlowDiagnosisItem = {
    target: RtcmFlowDiagnosisTarget;
    label: string;
    status: RtcmFlowDiagnosisStatus;
    summary: string;
};

export type RtcmFlowDiagnosis = {
    overall: RtcmFlowDiagnosisStatus;
    items: RtcmFlowDiagnosisItem[];
};

function resolveOverallStatus(
    items: RtcmFlowDiagnosisItem[],
): RtcmFlowDiagnosisStatus {
    if (items.some((item) => item.status === 'critical')) {
        return 'critical';
    }

    if (items.some((item) => item.status === 'warning')) {
        return 'warning';
    }

    if (items.every((item) => item.status === 'healthy')) {
        return 'healthy';
    }

    return 'unknown';
}

function unknownDiagnosis(): RtcmFlowDiagnosis {
    const items: RtcmFlowDiagnosisItem[] = [
        {
            target: 'base',
            label: 'BASE input',
            status: 'unknown',
            summary: 'Waiting for source metrics.',
        },
        {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'unknown',
            summary: 'Waiting for fan-out metrics.',
        },
        {
            target: 'rover',
            label: 'Rover sockets',
            status: 'unknown',
            summary: 'Waiting for Rover metrics.',
        },
    ];

    return {
        overall: 'unknown',
        items,
    };
}

function diagnoseBase(
    snapshot: RtcmFlowSnapshot,
    mountpoint: RtcmFlowMountpointSnapshot,
): RtcmFlowDiagnosisItem {
    const intervalMs = Math.max(1, snapshot.intervalMs);
    const warningAgeMs = Math.max(2000, intervalMs * 2);
    const criticalAgeMs = Math.max(5000, intervalMs * 5);

    if (!mountpoint.sourceConnected) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'critical',
            summary: 'RTCM source is disconnected.',
        };
    }

    if (mountpoint.sourceLastReceivedAgeMs === null) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'warning',
            summary: 'Source is connected but freshness is unknown.',
        };
    }

    if (mountpoint.sourceLastReceivedAgeMs >= criticalAgeMs) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'critical',
            summary: 'No fresh RTCM data has arrived from BASE.',
        };
    }

    if (mountpoint.sourceLastReceivedAgeMs >= warningAgeMs) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'warning',
            summary: 'RTCM input is arriving later than expected.',
        };
    }

    if (!snapshot.baseline && mountpoint.sourceBps === 0) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'warning',
            summary: 'Source is connected but input throughput is zero.',
        };
    }

    if (snapshot.baseline) {
        return {
            target: 'base',
            label: 'BASE input',
            status: 'unknown',
            summary: 'Waiting for the next measurement interval.',
        };
    }

    return {
        target: 'base',
        label: 'BASE input',
        status: 'healthy',
        summary: 'RTCM source is fresh and active.',
    };
}

function diagnoseCaster(
    snapshot: RtcmFlowSnapshot,
    mountpoint: RtcmFlowMountpointSnapshot,
): RtcmFlowDiagnosisItem {
    if (mountpoint.activeRovers === 0) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'healthy',
            summary: 'No Rover fan-out load is currently active.',
        };
    }

    if (snapshot.baseline) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'unknown',
            summary: 'Waiting for the next fan-out interval.',
        };
    }

    if (mountpoint.expectedEgressBps === 0) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'warning',
            summary: 'Rovers are active but expected egress is zero.',
        };
    }

    const coverage = mountpoint.fanoutCoverage;

    if (coverage === null) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'warning',
            summary: 'Fan-out coverage cannot be calculated.',
        };
    }

    if (coverage < 0.9) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'critical',
            summary: 'Caster queued less than 90% of expected traffic.',
        };
    }

    if (coverage < 0.98) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'warning',
            summary: 'Fan-out coverage is below the target level.',
        };
    }

    const intervalMs = Math.max(1, snapshot.intervalMs);
    const warningLatencyMs = Math.max(50, intervalMs * 0.25);
    const criticalLatencyMs = Math.max(250, intervalMs * 0.75);

    if (mountpoint.fanoutDurationP95Ms >= criticalLatencyMs) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'critical',
            summary: 'Caster fan-out P95 latency is excessively high.',
        };
    }

    if (mountpoint.fanoutDurationP95Ms >= warningLatencyMs) {
        return {
            target: 'caster',
            label: 'Caster fan-out',
            status: 'warning',
            summary: 'Caster fan-out latency is increasing.',
        };
    }

    return {
        target: 'caster',
        label: 'Caster fan-out',
        status: 'healthy',
        summary: 'Caster is distributing expected RTCM traffic.',
    };
}

function diagnoseRover(
    snapshot: RtcmFlowSnapshot,
    mountpoint: RtcmFlowMountpointSnapshot,
): RtcmFlowDiagnosisItem {
    if (mountpoint.activeRovers === 0) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'healthy',
            summary: 'No active Rover socket requires monitoring.',
        };
    }

    if (snapshot.baseline) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'unknown',
            summary: 'Waiting for the next socket interval.',
        };
    }

    if (mountpoint.writeFailuresDelta > 0) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'critical',
            summary: 'One or more Rover socket writes failed.',
        };
    }

    const drain = mountpoint.socketDrainRatio;

    if (drain === null) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'warning',
            summary: 'Socket drain ratio cannot be calculated.',
        };
    }

    if (drain < 0.9) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'critical',
            summary: 'Rover sockets wrote less than 90% of expected traffic.',
        };
    }

    const intervalMs = Math.max(1, snapshot.intervalMs);
    const warningBufferAgeMs = Math.max(250, intervalMs);
    const criticalBufferAgeMs = Math.max(2000, intervalMs * 3);

    if (mountpoint.maximumBufferAgeMs >= criticalBufferAgeMs) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'critical',
            summary: 'A Rover output buffer is severely delayed.',
        };
    }

    if (
        drain < 0.98 ||
        mountpoint.zeroWritesDelta > 0 ||
        mountpoint.maximumBufferAgeMs >= warningBufferAgeMs
    ) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'warning',
            summary: 'A Rover socket is draining more slowly than expected.',
        };
    }

    if (mountpoint.backlogBytes > 0 && mountpoint.partialWritesDelta > 0) {
        return {
            target: 'rover',
            label: 'Rover sockets',
            status: 'warning',
            summary: 'Partial socket writes are creating a backlog.',
        };
    }

    return {
        target: 'rover',
        label: 'Rover sockets',
        status: 'healthy',
        summary: 'Rover sockets are draining normally.',
    };
}

export function diagnoseRtcmFlow(
    snapshot: RtcmFlowSnapshot | null,
    mountpoint: RtcmFlowMountpointSnapshot | null,
): RtcmFlowDiagnosis {
    if (snapshot === null || mountpoint === null) {
        return unknownDiagnosis();
    }

    const items = [
        diagnoseBase(snapshot, mountpoint),
        diagnoseCaster(snapshot, mountpoint),
        diagnoseRover(snapshot, mountpoint),
    ];

    return {
        overall: resolveOverallStatus(items),
        items,
    };
}
