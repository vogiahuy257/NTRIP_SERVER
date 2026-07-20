import { useCallback, useEffect, useRef, useState } from 'react';

import { normaliseDashboardSession } from '@/realtime/dashboard-session-normalizer';

import type {
    DashboardSession,
    NtripSessionConnectionType,
} from '@/types/ntrip-dashboard';

type UnknownRecord = Record<string, unknown>;

export type SessionTypeFilter = 'all' | NtripSessionConnectionType;

type UseSessionHistoryOptions = {
    enabled: boolean;
    type: SessionTypeFilter;
    search: string;
};

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
    return isRecord(value) ? value : {};
}

function asNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function parseResponse(payload: unknown): {
    items: DashboardSession[];
    currentPage: number;
    lastPage: number;
    total: number;
} {
    const root = asRecord(payload);
    const paginator = asRecord(root.data);

    const rawItems = Array.isArray(paginator.data) ? paginator.data : [];

    const items = rawItems
        .map(normaliseDashboardSession)
        .filter((session): session is DashboardSession => session !== null);

    return {
        items,

        currentPage: asNumber(paginator.current_page, 1),

        lastPage: asNumber(paginator.last_page, 1),

        total: asNumber(paginator.total, items.length),
    };
}

export function useSessionHistory({
    enabled,
    type,
    search,
}: UseSessionHistoryOptions) {
    const [items, setItems] = useState<DashboardSession[]>([]);

    const [page, setPage] = useState(1);

    const [lastPage, setLastPage] = useState(1);

    const [total, setTotal] = useState(0);

    const [isLoading, setIsLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setPage(1);
    }, [search, type]);

    const refresh = useCallback(async (): Promise<void> => {
        if (!enabled) {
            return;
        }

        controllerRef.current?.abort();

        const controller = new AbortController();

        controllerRef.current = controller;

        setIsLoading(true);
        setError(null);

        const parameters = new URLSearchParams({
            status: 'ended',
            page: String(page),
            per_page: '25',
        });

        if (type !== 'all') {
            parameters.set('type', type);
        }

        const query = search.trim();

        if (query !== '') {
            parameters.set('search', query);
        }

        try {
            const response = await fetch(
                `/api/v1/ntrip/sessions?${parameters.toString()}`,
                {
                    credentials: 'same-origin',

                    headers: {
                        Accept: 'application/json',
                    },

                    signal: controller.signal,
                },
            );

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const payload: unknown = await response.json();

            const result = parseResponse(payload);

            if (controllerRef.current !== controller) {
                return;
            }

            setItems(result.items);
            setPage(result.currentPage);
            setLastPage(result.lastPage);
            setTotal(result.total);
        } catch (reason) {
            if (reason instanceof Error && reason.name === 'AbortError') {
                return;
            }

            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to load session history.',
            );
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;

                setIsLoading(false);
            }
        }
    }, [enabled, page, search, type]);

    useEffect(() => {
        void refresh();

        return () => {
            controllerRef.current?.abort();
        };
    }, [refresh]);

    return {
        items,
        page,
        lastPage,
        total,
        isLoading,
        error,
        setPage,
        refresh,
    };
}
