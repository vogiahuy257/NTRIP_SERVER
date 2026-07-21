import {
    normaliseRtcmFlowHistoryResponse,
    normaliseRtcmFlowSnapshotResponse,
} from './rtcm-flow-normalizer';

import type {
    RtcmFlowHistoryRequestResolution,
    RtcmFlowHistoryResult,
    RtcmFlowSnapshotResult,
} from './rtcm-flow-types';

const SNAPSHOT_URL = '/api/v1/observability/rtcm-flow/snapshot';

const HISTORY_URL = '/api/v1/observability/rtcm-flow/history';

type FetchHistoryOptions = {
    mountpointId: number;

    resolution?: RtcmFlowHistoryRequestResolution;

    from?: Date;
    to?: Date;

    maxPoints?: number;

    signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function responseError(response: Response): Promise<Error> {
    let message = `${response.status} ${response.statusText}`;

    try {
        const payload: unknown = await response.json();

        if (
            isRecord(payload) &&
            typeof payload.message === 'string' &&
            payload.message.trim() !== ''
        ) {
            message = payload.message;
        }
    } catch {
        /*
         * Response không phải JSON.
         * Giữ HTTP status làm thông báo.
         */
    }

    return new Error(message);
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
        method: 'GET',

        credentials: 'same-origin',

        headers: {
            Accept: 'application/json',
        },

        signal,
    });

    if (!response.ok) {
        throw await responseError(response);
    }

    return response.json() as Promise<unknown>;
}

export async function fetchRtcmFlowSnapshot(
    signal?: AbortSignal,
): Promise<RtcmFlowSnapshotResult> {
    const payload = await getJson(SNAPSHOT_URL, signal);

    return normaliseRtcmFlowSnapshotResponse(payload);
}

export async function fetchRtcmFlowHistory({
    mountpointId,
    resolution = 'auto',
    from,
    to,
    maxPoints = 1500,
    signal,
}: FetchHistoryOptions): Promise<RtcmFlowHistoryResult> {
    const parameters = new URLSearchParams({
        mountpoint_id: String(mountpointId),

        resolution,

        max_points: String(maxPoints),
    });

    if (from !== undefined) {
        parameters.set('from', from.toISOString());
    }

    if (to !== undefined) {
        parameters.set('to', to.toISOString());
    }

    const payload = await getJson(
        `${HISTORY_URL}?${parameters.toString()}`,
        signal,
    );

    return normaliseRtcmFlowHistoryResponse(payload);
}
