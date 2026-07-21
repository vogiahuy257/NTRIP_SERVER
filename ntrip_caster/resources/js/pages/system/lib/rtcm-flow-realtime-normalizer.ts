import { normaliseRtcmFlowSnapshot } from './rtcm-flow-normalizer';

import type { RtcmFlowSnapshot } from './rtcm-flow-types';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as UnknownRecord;
}

export function normaliseRtcmFlowRealtimeEvent(
    value: unknown,
): RtcmFlowSnapshot | null {
    const event = asRecord(value);

    if (event === null) {
        return null;
    }

    return normaliseRtcmFlowSnapshot(event.snapshot);
}
