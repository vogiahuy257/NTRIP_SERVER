import {
    extractPendingDevice,
    extractPendingDeviceList,
} from './pending-device-contract';

import type { ApprovePendingDeviceInput, PendingDeviceItem } from './types';

export const PENDING_DEVICE_REALTIME_CHANNEL = 'ntrip.dashboard';

export const PENDING_DEVICE_REALTIME_EVENTS: string[] = [
    '.device.discovered',
    '.device.updated',
];

const BASE_ENDPOINT = '/api/v1/pending-devices';

export const PENDING_DEVICE_ENDPOINTS = {
    index: BASE_ENDPOINT,

    show: (deviceId: number): string => `${BASE_ENDPOINT}/${deviceId}`,

    approve: (deviceId: number): string =>
        `${BASE_ENDPOINT}/${deviceId}/approve`,

    reject: (deviceId: number): string => `${BASE_ENDPOINT}/${deviceId}/reject`,
} as const;

function findCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const prefix = `${name}=`;

    const cookie = document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix));

    return cookie === undefined
        ? null
        : decodeURIComponent(cookie.slice(prefix.length));
}

function createHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (hasBody) {
        headers['Content-Type'] = 'application/json';
    }

    if (typeof document === 'undefined') {
        return headers;
    }

    const csrfToken = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const xsrfToken = findCookie('XSRF-TOKEN');

    if (xsrfToken) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    return headers;
}

async function readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => null);
}

function extractErrorMessage(payload: unknown): string | null {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }

    if (
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message.trim() !== ''
    ) {
        return payload.message;
    }

    if (
        'errors' in payload &&
        payload.errors !== null &&
        typeof payload.errors === 'object'
    ) {
        for (const error of Object.values(payload.errors)) {
            if (
                Array.isArray(error) &&
                typeof error[0] === 'string' &&
                error[0].trim() !== ''
            ) {
                return error[0];
            }
        }
    }

    return null;
}

async function requestJson(
    endpoint: string,
    init: RequestInit,
): Promise<unknown> {
    const response = await fetch(endpoint, {
        credentials: 'same-origin',
        ...init,
    });

    const payload = await readJson(response);

    if (!response.ok) {
        throw new Error(
            extractErrorMessage(payload) ??
                `Request failed with HTTP ${response.status}.`,
        );
    }

    return payload;
}

export async function fetchPendingDevices(
    signal?: AbortSignal,
): Promise<PendingDeviceItem[]> {
    const payload = await requestJson(PENDING_DEVICE_ENDPOINTS.index, {
        method: 'GET',
        signal,
        headers: createHeaders(false),
    });

    return extractPendingDeviceList(payload);
}

export async function fetchPendingDevice(
    deviceId: number,
    signal?: AbortSignal,
): Promise<PendingDeviceItem> {
    const payload = await requestJson(PENDING_DEVICE_ENDPOINTS.show(deviceId), {
        method: 'GET',
        signal,
        headers: createHeaders(false),
    });

    const device = extractPendingDevice(payload);

    if (device === null) {
        throw new Error('Pending device response is invalid.');
    }

    return device;
}

export async function approvePendingDevice(
    deviceId: number,
    input: ApprovePendingDeviceInput = {},
): Promise<PendingDeviceItem> {
    const payload = await requestJson(
        PENDING_DEVICE_ENDPOINTS.approve(deviceId),
        {
            method: 'POST',
            headers: createHeaders(true),

            body: JSON.stringify({
                device_id: input.deviceId,
                name: input.name,
                mountpoint: input.mountpoint,

                caster_host: input.casterHost,
                caster_port: input.casterPort,

                uart_baud: input.uartBaud,
                telemetry_interval_ms: input.telemetryIntervalMs,
                config_poll_interval_ms: input.configPollIntervalMs,
                max_rtcm_age_ms: input.maxRtcmAgeMs,
            }),
        },
    );

    const device = extractPendingDevice(payload);

    if (device === null) {
        throw new Error('Approved device response is invalid.');
    }

    return device;
}

export async function rejectPendingDevice(
    deviceId: number,
    reason?: string,
): Promise<PendingDeviceItem> {
    const normalizedReason = reason?.trim();

    const payload = await requestJson(
        PENDING_DEVICE_ENDPOINTS.reject(deviceId),
        {
            method: 'POST',
            headers: createHeaders(true),

            body: JSON.stringify(
                normalizedReason
                    ? {
                          reason: normalizedReason,
                      }
                    : {},
            ),
        },
    );

    const device = extractPendingDevice(payload);

    if (device === null) {
        throw new Error('Rejected device response is invalid.');
    }

    return device;
}
