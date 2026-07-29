import { useEcho } from '@laravel/echo-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiHeaders } from '@/lib/api-headers';
import {
    ALERT_ENDPOINTS,
    ALERT_REALTIME_CHANNEL,
    ALERT_REALTIME_EVENTS,
    extractAlert,
    extractAlertList,
    extractBroadcastAlert,
} from './alert-contract';
import {
    isActiveAlert
    
    
} from './types';
import type {AlertBroadcastPayload, AlertItem} from './types';

const RECENT_ALERT_LIMIT = 20;

const SEVERITY_ORDER: Record<AlertItem['severity'], number> = {
    critical: 0,
    warning: 1,
};

function timestampOf(alert: AlertItem): number {
    const value = alert.resolvedAt ?? alert.lastObservedAt ?? alert.openedAt;

    if (value === null) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortActiveAlerts(alerts: AlertItem[]): AlertItem[] {
    return [...alerts].sort((left, right) => {
        const severityDifference =
            SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];

        if (severityDifference !== 0) {
            return severityDifference;
        }

        return timestampOf(right) - timestampOf(left);
    });
}

function sortRecentAlerts(alerts: AlertItem[]): AlertItem[] {
    return [...alerts].sort(
        (left, right) => timestampOf(right) - timestampOf(left),
    );
}

function upsertAlert(alerts: AlertItem[], nextAlert: AlertItem): AlertItem[] {
    return [...alerts.filter((alert) => alert.id !== nextAlert.id), nextAlert];
}

function isAbortError(reason: unknown): boolean {
    return reason instanceof Error && reason.name === 'AbortError';
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

    return null;
}

async function readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => null);
}

async function fetchAlerts(
    endpoint: string,
    signal: AbortSignal,
): Promise<AlertItem[]> {
    const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'same-origin',
        signal,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const payload = await readJson(response);

    if (!response.ok) {
        throw new Error(
            extractErrorMessage(payload) ??
                `Alert request failed with HTTP ${response.status}.`,
        );
    }

    return extractAlertList(payload);
}

export function useAlertNotifications() {
    const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([]);
    const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [acknowledgingAlertIds, setAcknowledgingAlertIds] = useState<
        Set<number>
    >(() => new Set());

    const [eventVersion, setEventVersion] = useState(0);

    const requestControllerRef = useRef<AbortController | null>(null);

    const loadAlerts = useCallback(
        async (refreshing = false): Promise<void> => {
            requestControllerRef.current?.abort();

            const controller = new AbortController();
            requestControllerRef.current = controller;

            if (refreshing) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            setError(null);

            try {
                const [active, history] = await Promise.all([
                    fetchAlerts(ALERT_ENDPOINTS.active, controller.signal),
                    fetchAlerts(ALERT_ENDPOINTS.history, controller.signal),
                ]);

                if (requestControllerRef.current !== controller) {
                    return;
                }

                setActiveAlerts(sortActiveAlerts(active.filter(isActiveAlert)));
                setRecentAlerts(
                    sortRecentAlerts(
                        history.filter((alert) => alert.status === 'resolved'),
                    ).slice(0, RECENT_ALERT_LIMIT),
                );
            } catch (requestError) {
                if (
                    isAbortError(requestError) ||
                    requestControllerRef.current !== controller
                ) {
                    return;
                }

                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to load alerts.',
                );
            } finally {
                if (requestControllerRef.current === controller) {
                    requestControllerRef.current = null;
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        void loadAlerts();

        return () => {
            requestControllerRef.current?.abort();
            requestControllerRef.current = null;
        };
    }, [loadAlerts]);

    const handleRealtimeAlert = useCallback(
        (payload: AlertBroadcastPayload): void => {
            const alert = extractBroadcastAlert(payload);

            if (alert === null) {
                return;
            }

            if (alert.status === 'resolved') {
                setActiveAlerts((current) =>
                    current.filter((item) => item.id !== alert.id),
                );

                setRecentAlerts((current) =>
                    sortRecentAlerts(upsertAlert(current, alert)).slice(
                        0,
                        RECENT_ALERT_LIMIT,
                    ),
                );
            } else {
                setRecentAlerts((current) =>
                    current.filter((item) => item.id !== alert.id),
                );

                setActiveAlerts((current) =>
                    sortActiveAlerts(upsertAlert(current, alert)),
                );
            }

            setEventVersion((current) => current + 1);
        },
        [],
    );

    useEcho<AlertBroadcastPayload>(
        ALERT_REALTIME_CHANNEL,
        ALERT_REALTIME_EVENTS,
        handleRealtimeAlert,
    );

    const activeCount = activeAlerts.length;

    const criticalCount = useMemo(
        () =>
            activeAlerts.filter((alert) => alert.severity === 'critical')
                .length,
        [activeAlerts],
    );

    const unacknowledgedCount = useMemo(
        () => activeAlerts.filter((alert) => alert.status === 'open').length,
        [activeAlerts],
    );

    const refresh = useCallback((): void => {
        setActionError(null);
        void loadAlerts(true);
    }, [loadAlerts]);

    const acknowledgeAlert = useCallback(
        async (alertId: number): Promise<boolean> => {
            setActionError(null);

            setAcknowledgingAlertIds((current) => {
                const next = new Set(current);
                next.add(alertId);

                return next;
            });

            try {
                const response = await fetch(
                    ALERT_ENDPOINTS.acknowledge(alertId),
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: createApiHeaders(),
                    },
                );

                const payload = await readJson(response);

                if (!response.ok) {
                    throw new Error(
                        extractErrorMessage(payload) ??
                            `Unable to acknowledge alert. HTTP ${response.status}.`,
                    );
                }

                const acknowledgedAlert = extractAlert(payload);

                if (acknowledgedAlert !== null) {
                    setActiveAlerts((current) =>
                        sortActiveAlerts(
                            upsertAlert(current, acknowledgedAlert),
                        ),
                    );
                }

                return true;
            } catch (requestError) {
                setActionError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to acknowledge alert.',
                );

                return false;
            } finally {
                setAcknowledgingAlertIds((current) => {
                    const next = new Set(current);
                    next.delete(alertId);

                    return next;
                });
            }
        },
        [],
    );

    return {
        activeAlerts,
        recentAlerts,

        activeCount,
        criticalCount,
        unacknowledgedCount,

        isLoading,
        isRefreshing,

        error,
        actionError,

        acknowledgingAlertIds,
        eventVersion,

        refresh,
        acknowledgeAlert,
    };
}
