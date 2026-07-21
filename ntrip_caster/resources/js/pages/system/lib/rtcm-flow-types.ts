export type RtcmFlowHistoryRequestResolution = 'auto' | 'detail' | 'minute';

export type RtcmFlowHistoryResolution = 'detail' | 'minute';

export type RtcmFlowMountpointSnapshot = {
    mountpointId: number;

    sourceConnected: boolean;

    sourceBytesDelta: number;
    sourceBps: number;
    sourceChunksDelta: number;

    sourceLastReceivedAgeMs: number | null;
    sourceGapMaxMs: number;

    activeRovers: number;

    expectedEgressBytesDelta: number;
    queuedEgressBytesDelta: number;
    writtenEgressBytesDelta: number;

    expectedEgressBps: number;
    queuedEgressBps: number;
    writtenEgressBps: number;

    fanoutCoverage: number | null;
    socketDrainRatio: number | null;

    fanoutCount: number;

    fanoutDurationAvgMs: number;
    fanoutDurationP95Ms: number;
    fanoutDurationMaxMs: number;

    backlogBytes: number;
    maximumRoverBufferBytes: number;
    maximumBufferAgeMs: number;

    partialWritesDelta: number;
    zeroWritesDelta: number;
    writeFailuresDelta: number;
};

export type RtcmFlowRoverSnapshot = {
    sessionId: number;
    mountpointId: number;

    queuedBytesDelta: number;
    queuedBps: number;

    writtenBytesDelta: number;
    writtenBps: number;

    currentBufferBytes: number;
    currentBufferAgeMs: number;

    maximumBufferBytes: number;
    maximumBufferAgeMs: number;

    lastSuccessfulWriteAgeMs: number | null;

    partialWritesDelta: number;
    zeroWritesDelta: number;
    writeFailuresDelta: number;
};

export type RtcmFlowSnapshot = {
    version: number;
    sequence: number;
    processId: number | null;

    emittedAtUnixMs: number;
    emittedAt: Date;

    intervalMs: number;
    baseline: boolean;
    sequenceGap: number;

    mountpoints: RtcmFlowMountpointSnapshot[];
    rovers: RtcmFlowRoverSnapshot[];
};

export type RtcmFlowSnapshotResult = {
    snapshot: RtcmFlowSnapshot | null;

    available: boolean;
    servedAt: Date;
};

export type RtcmFlowHistoryPoint = {
    timestamp: Date;

    intervalMs: number;
    sampleCount: number;

    sourceConnectedRatio: number;

    sourceBps: number;
    sourceBpsMax: number;

    sourceLastReceivedAgeMs: number | null;
    sourceGapMaxMs: number;

    activeRovers: number;
    activeRoversMax: number;

    expectedEgressBps: number;
    expectedEgressBpsMax: number;

    queuedEgressBps: number;
    queuedEgressBpsMax: number;

    writtenEgressBps: number;
    writtenEgressBpsMax: number;

    fanoutCoverage: number | null;
    fanoutCoverageMin: number | null;

    socketDrainRatio: number | null;
    socketDrainRatioMin: number | null;

    fanoutDurationAvgMs: number;
    fanoutDurationP95Ms: number;
    fanoutDurationMaxMs: number;

    backlogBytes: number;
    backlogBytesMax: number;

    maximumRoverBufferBytes: number;
    maximumBufferAgeMs: number;

    partialWrites: number;
    zeroWrites: number;
    writeFailures: number;
};

export type RtcmFlowHistoryMeta = {
    mountpointId: number;

    requestedResolution: RtcmFlowHistoryRequestResolution;
    resolution: RtcmFlowHistoryResolution;

    requestedFrom: Date;
    requestedTo: Date;

    effectiveFrom: Date;
    effectiveTo: Date;

    retentionClamped: boolean;

    originalPointCount: number;
    returnedPointCount: number;
    maxPoints: number;

    downsampled: boolean;
};

export type RtcmFlowHistoryResult = {
    points: RtcmFlowHistoryPoint[];
    meta: RtcmFlowHistoryMeta;
};
