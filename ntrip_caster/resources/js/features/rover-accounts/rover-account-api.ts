import {
    normalizeRoverAccountList,
    normalizeRoverAccountMountpointList,
    normalizeRoverAccountResponse,
} from './rover-account-contract';

import type {
    RoverAccount,
    RoverAccountCreateInput,
    RoverAccountFieldErrors,
    RoverAccountMountpoint,
    RoverAccountMountpointGrantInput,
    RoverAccountUpdateInput,
} from './types';

const BASE_ENDPOINT = '/api/v1/rover-accounts';

type JsonObject = Record<string, unknown>;

export class RoverAccountApiError extends Error {
    public constructor(
        message: string,
        public readonly status: number,
        public readonly errors: RoverAccountFieldErrors = {},
    ) {
        super(message);
        this.name = 'RoverAccountApiError';
    }
}

function asObject(value: unknown): JsonObject | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as JsonObject;
}

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

function normalizeFieldErrors(value: unknown): RoverAccountFieldErrors {
    const source = asObject(value);

    if (source === null) {
        return {};
    }

    const result: RoverAccountFieldErrors = {};

    for (const [field, messages] of Object.entries(source)) {
        if (!Array.isArray(messages)) {
            continue;
        }

        const validMessages = messages.filter(
            (message): message is string => typeof message === 'string',
        );

        if (validMessages.length > 0) {
            result[field] = validMessages;
        }
    }

    return result;
}

async function readJson(response: Response): Promise<unknown> {
    if (response.status === 204) {
        return null;
    }

    return response.json().catch(() => null);
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
        const root = asObject(payload);
        const message =
            typeof root?.message === 'string' && root.message.trim() !== ''
                ? root.message
                : `Request failed with HTTP ${response.status}.`;

        throw new RoverAccountApiError(
            message,
            response.status,
            normalizeFieldErrors(root?.errors),
        );
    }

    return payload;
}

function accountPayload(
    input: RoverAccountCreateInput | RoverAccountUpdateInput,
): JsonObject {
    const payload: JsonObject = {};

    if ('username' in input && input.username !== undefined) {
        payload.username = input.username;
    }

    if ('displayName' in input && input.displayName !== undefined) {
        payload.display_name = input.displayName;
    }

    if ('password' in input && input.password !== undefined) {
        payload.password = input.password;
        payload.password_confirmation = input.passwordConfirmation ?? '';
    }

    if ('enabled' in input && input.enabled !== undefined) {
        payload.enabled = input.enabled;
    }

    if ('maxConnections' in input && input.maxConnections !== undefined) {
        payload.max_connections = input.maxConnections;
    }

    if ('expiresAt' in input && input.expiresAt !== undefined) {
        payload.expires_at = input.expiresAt;
    }

    if ('notes' in input && input.notes !== undefined) {
        payload.notes = input.notes;
    }

    return payload;
}

export async function fetchRoverAccounts(
    signal?: AbortSignal,
): Promise<RoverAccount[]> {
    const parameters = new URLSearchParams({
        per_page: '100',
    });

    const payload = await requestJson(`${BASE_ENDPOINT}?${parameters}`, {
        method: 'GET',
        signal,
        headers: createHeaders(false),
    });

    return normalizeRoverAccountList(payload);
}

export async function fetchRoverAccount(
    accountId: number,
    signal?: AbortSignal,
): Promise<RoverAccount> {
    const payload = await requestJson(`${BASE_ENDPOINT}/${accountId}`, {
        method: 'GET',
        signal,
        headers: createHeaders(false),
    });

    return normalizeRoverAccountResponse(payload);
}

export async function createRoverAccount(
    input: RoverAccountCreateInput,
): Promise<RoverAccount> {
    const payload = await requestJson(BASE_ENDPOINT, {
        method: 'POST',
        headers: createHeaders(true),
        body: JSON.stringify(accountPayload(input)),
    });

    return normalizeRoverAccountResponse(payload);
}

export async function updateRoverAccount(
    accountId: number,
    input: RoverAccountUpdateInput,
): Promise<RoverAccount> {
    const payload = await requestJson(`${BASE_ENDPOINT}/${accountId}`, {
        method: 'PUT',
        headers: createHeaders(true),
        body: JSON.stringify(accountPayload(input)),
    });

    return normalizeRoverAccountResponse(payload);
}

export async function deleteRoverAccount(accountId: number): Promise<void> {
    await requestJson(`${BASE_ENDPOINT}/${accountId}`, {
        method: 'DELETE',
        headers: createHeaders(false),
    });
}

export async function fetchRoverAccountMountpoints(
    accountId: number,
    signal?: AbortSignal,
): Promise<RoverAccountMountpoint[]> {
    const payload = await requestJson(
        `${BASE_ENDPOINT}/${accountId}/mountpoints`,
        {
            method: 'GET',
            signal,
            headers: createHeaders(false),
        },
    );

    return normalizeRoverAccountMountpointList(payload);
}

export async function syncRoverAccountMountpoints(
    accountId: number,
    mountpoints: RoverAccountMountpointGrantInput[],
): Promise<RoverAccountMountpoint[]> {
    const payload = await requestJson(
        `${BASE_ENDPOINT}/${accountId}/mountpoints`,
        {
            method: 'PUT',
            headers: createHeaders(true),
            body: JSON.stringify({
                mountpoints: mountpoints.map((mountpoint) => ({
                    id: mountpoint.id,
                    enabled: mountpoint.enabled,
                    max_connections: mountpoint.maxConnections,
                    starts_at: mountpoint.startsAt,
                    expires_at: mountpoint.expiresAt,
                })),
            }),
        },
    );

    return normalizeRoverAccountMountpointList(payload);
}
