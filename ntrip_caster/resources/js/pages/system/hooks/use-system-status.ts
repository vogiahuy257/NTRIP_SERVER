import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSystemStatus } from '../lib/system-status';
import type { SystemStatus } from '../lib/system-status';

const REFRESH_INTERVAL_MS = 15_000;

type UseSystemStatusResult = {
    status: SystemStatus | null;
    error: string | null;

    isInitialLoading: boolean;
    isRefreshing: boolean;

    refresh: () => Promise<void>;
};

export function useSystemStatus(): UseSystemStatusResult {
    const [status, setStatus] = useState<SystemStatus | null>(null);

    const [error, setError] = useState<string | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const activeRequestRef = useRef<AbortController | null>(null);

    const requestStatus = useCallback(
        async (showRefreshIndicator: boolean): Promise<void> => {
            activeRequestRef.current?.abort();

            const controller = new AbortController();

            activeRequestRef.current = controller;

            if (showRefreshIndicator) {
                setIsRefreshing(true);
            }

            try {
                const nextStatus = await fetchSystemStatus(controller.signal);

                if (controller.signal.aborted) {
                    return;
                }

                setStatus(nextStatus);
                setError(null);
            } catch (reason) {
                if (
                    controller.signal.aborted ||
                    (reason instanceof DOMException &&
                        reason.name === 'AbortError')
                ) {
                    return;
                }

                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Unable to load System Status.',
                );
            } finally {
                if (activeRequestRef.current === controller) {
                    activeRequestRef.current = null;

                    if (showRefreshIndicator) {
                        setIsRefreshing(false);
                    }
                }
            }
        },
        [],
    );

    const refresh = useCallback(async (): Promise<void> => {
        await requestStatus(true);
    }, [requestStatus]);

    useEffect(() => {
        const initialRequestId = window.setTimeout(() => {
            void requestStatus(false);
        }, 0);

        const intervalId = window.setInterval(() => {
            void requestStatus(false);
        }, REFRESH_INTERVAL_MS);

        return () => {
            window.clearTimeout(initialRequestId);
            window.clearInterval(intervalId);

            activeRequestRef.current?.abort();
            activeRequestRef.current = null;
        };
    }, [requestStatus]);

    return {
        status,
        error,

        isInitialLoading: status === null && error === null,

        isRefreshing,

        refresh,
    };
}
