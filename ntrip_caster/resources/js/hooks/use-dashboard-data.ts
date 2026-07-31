import { useConnectionStatus, useEcho } from '@laravel/echo-react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { selectDashboardRovers } from '@/realtime/dashboard-session-selectors';
import { normaliseDashboardSnapshot } from '@/realtime/dashboard-snapshot-normalizer';
import {
    NTRIP_DASHBOARD_CHANNEL,
    NTRIP_DASHBOARD_EVENTS,
    normaliseRealtimeConnectionState,
    type NtripDashboardRealtimeEvent,
} from '@/realtime/ntrip-realtime-types';

import { applyNtripSessionEvent } from '@/realtime/ntrip-session-reducer';

import { applyStationTelemetryUpdated } from '@/realtime/station-telemetry-reducer';

import type { DashboardSnapshot, StationHealth } from '@/types/ntrip-dashboard';

import { useRealtimeResync } from '@/realtime/use-realtime-resync';

const DASHBOARD_SNAPSHOT_URL = '/api/v1/dashboard/snapshot';

function createEmptySnapshot(): DashboardSnapshot {
    return {
        stations: [],
        activeSessionItems: [],
        activeSources: 0,
        activeRovers: 0,
        activeSessions: 0,

        totalTrafficBps: 0,
        totalCrcErrors: 0,

        /*
         * Epoch để snapshot đầu tiên luôn mới hơn
         * state rỗng ban đầu.
         */
        lastUpdatedAt: new Date(0),

        usingFallbackData: false,
    };
}

function isAbortError(reason: unknown): boolean {
    return reason instanceof Error && reason.name === 'AbortError';
}

function formatRequestError(reason: unknown): string {
    if (reason instanceof Error) {
        return reason.message;
    }

    return 'Unable to load dashboard data.';
}

async function fetchDashboardSnapshot(
    signal: AbortSignal,
): Promise<DashboardSnapshot> {
    const response = await fetch(DASHBOARD_SNAPSHOT_URL, {
        method: 'GET',

        credentials: 'same-origin',

        headers: {
            Accept: 'application/json',
        },

        signal,
    });

    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;

        try {
            const payload: unknown = await response.json();

            if (
                typeof payload === 'object' &&
                payload !== null &&
                'message' in payload &&
                typeof payload.message === 'string' &&
                payload.message.trim() !== ''
            ) {
                message = payload.message;
            }
        } catch {
            /*
             * Response không phải JSON.
             * Giữ HTTP status làm message.
             */
        }

        throw new Error(message);
    }

    const payload: unknown = await response.json();

    return normaliseDashboardSnapshot(payload);
}

export function useDashboardData() {
    const [snapshot, setSnapshot] =
        useState<DashboardSnapshot>(createEmptySnapshot);

    const snapshotRef = useRef<DashboardSnapshot>(snapshot);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<Date | null>(
        null,
    );

    const requestControllerRef = useRef<AbortController | null>(null);

    const mountedRef = useRef(false);

    const rawConnectionStatus = useConnectionStatus();

    const realtimeConnectionState = useMemo(
        () => normaliseRealtimeConnectionState(rawConnectionStatus),
        [rawConnectionStatus],
    );

    const commitSnapshot = useCallback(
        (nextSnapshot: DashboardSnapshot): void => {
            snapshotRef.current = nextSnapshot;

            setSnapshot(nextSnapshot);
        },
        [],
    );

    const refresh = useCallback(async (): Promise<boolean> => {
        /*
         * Hủy snapshot request cũ trước khi
         * bắt đầu request mới.
         */
        requestControllerRef.current?.abort();

        const controller = new AbortController();

        requestControllerRef.current = controller;

        if (mountedRef.current) {
            setIsRefreshing(true);
        }

        try {
            const nextSnapshot = await fetchDashboardSnapshot(
                controller.signal,
            );

            if (
                !mountedRef.current ||
                requestControllerRef.current !== controller
            ) {
                return false;
            }

            /*
             * Không cho một response Snapshot cũ
             * ghi đè event realtime mới hơn.
             */
            if (
                nextSnapshot.lastUpdatedAt.getTime() <
                snapshotRef.current.lastUpdatedAt.getTime()
            ) {
                setError(null);

                return true;
            }

            commitSnapshot(nextSnapshot);
            setError(null);

            return true;
        } catch (reason) {
            if (
                isAbortError(reason) ||
                !mountedRef.current ||
                requestControllerRef.current !== controller
            ) {
                return false;
            }

            /*
             * Giữ lại snapshot cuối cùng khi API lỗi.
             */
            setError(formatRequestError(reason));

            return false;
        } finally {
            if (
                mountedRef.current &&
                requestControllerRef.current === controller
            ) {
                requestControllerRef.current = null;

                setIsRefreshing(false);
            }
        }
    }, [commitSnapshot]);

    const handleDashboardRealtimeEvent = useCallback(
        (event: NtripDashboardRealtimeEvent): void => {
            let nextSnapshot = snapshotRef.current;

            if (event.entity === 'station') {
                const result = applyStationTelemetryUpdated(
                    snapshotRef.current,
                    event,
                );

                if (!result.matched) {
                    return;
                }

                nextSnapshot = result.snapshot;
            }

            if (event.entity === 'ntrip_session') {
                nextSnapshot = applyNtripSessionEvent(
                    snapshotRef.current,
                    event,
                );

                if (nextSnapshot === snapshotRef.current) {
                    return;
                }
            }

            commitSnapshot(nextSnapshot);

            setLastRealtimeEventAt(nextSnapshot.lastUpdatedAt);
        },
        [commitSnapshot],
    );

    useEcho<NtripDashboardRealtimeEvent>(
        NTRIP_DASHBOARD_CHANNEL,
        NTRIP_DASHBOARD_EVENTS,
        handleDashboardRealtimeEvent,
    );

    const { isRealtimeResyncing } = useRealtimeResync({
        connectionState: realtimeConnectionState,

        refresh,
    });

    useEffect(() => {
        mountedRef.current = true;

        void refresh();

        return () => {
            mountedRef.current = false;

            requestControllerRef.current?.abort();

            requestControllerRef.current = null;
        };
    }, [refresh]);

    const orderedStations = useMemo(
        () =>
            [...snapshot.stations].sort((left, right) => {
                const order: Record<StationHealth, number> = {
                    critical: 0,
                    warning: 1,
                    offline: 2,
                    healthy: 3,
                };

                return order[left.health] - order[right.health];
            }),
        [snapshot.stations],
    );

    const roverSessions = useMemo(
        () => selectDashboardRovers(snapshot.activeSessionItems),
        [snapshot.activeSessionItems],
    );

    return {
        ...snapshot,

        stations: orderedStations,
        roverSessions,

        isRefreshing,
        error,
        refresh,

        realtimeConnectionState,

        isRealtimeConnected: realtimeConnectionState === 'connected',
        isRealtimeResyncing,
        lastRealtimeEventAt,
    };
}
