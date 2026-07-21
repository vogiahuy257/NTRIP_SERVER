import { useConnectionStatus, useEcho } from '@laravel/echo-react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    NTRIP_DASHBOARD_CHANNEL,
    RTCM_FLOW_SNAPSHOT_UPDATED_EVENT,
    normaliseRealtimeConnectionState,
} from '@/realtime/ntrip-realtime-types';

import type { RtcmFlowSnapshotUpdatedEvent } from '@/realtime/ntrip-realtime-types';

import { useRealtimeResync } from '@/realtime/use-realtime-resync';

import {
    fetchRtcmFlowHistory,
    fetchRtcmFlowSnapshot,
} from '../lib/rtcm-flow-api';

import { normaliseRtcmFlowRealtimeEvent } from '../lib/rtcm-flow-realtime-normalizer';

import type {
    RtcmFlowHistoryRequestResolution,
    RtcmFlowHistoryResult,
    RtcmFlowMountpointSnapshot,
    RtcmFlowRoverSnapshot,
    RtcmFlowSnapshot,
} from '../lib/rtcm-flow-types';

const DEFAULT_HISTORY_WINDOW_MINUTES = 60;

const DEFAULT_HISTORY_MAX_POINTS = 1500;

const MINIMUM_STALE_AFTER_MS = 5000;

type HistoryLoadState = {
    settledQueryKey: string | null;
    result: RtcmFlowHistoryResult | null;
    error: string | null;
};

function isAbortError(reason: unknown): boolean {
    return reason instanceof Error && reason.name === 'AbortError';
}

function formatRequestError(reason: unknown, fallback: string): string {
    if (reason instanceof Error && reason.message.trim() !== '') {
        return reason.message;
    }

    return fallback;
}

function shouldReplaceSnapshot(
    current: RtcmFlowSnapshot | null,
    next: RtcmFlowSnapshot,
): boolean {
    if (current === null) {
        return true;
    }

    if (next.emittedAtUnixMs !== current.emittedAtUnixMs) {
        return next.emittedAtUnixMs > current.emittedAtUnixMs;
    }

    /*
     * Process mới có thể bắt đầu lại sequence từ 1.
     */
    if (next.processId !== current.processId) {
        return true;
    }

    return next.sequence > current.sequence;
}

export function useRtcmFlowObservability() {
    const [snapshot, setSnapshot] = useState<RtcmFlowSnapshot | null>(null);

    const snapshotRef = useRef<RtcmFlowSnapshot | null>(null);

    const [requestedMountpointId, setRequestedMountpointId] = useState<
        number | null
    >(null);

    const [historyWindowMinutes, setHistoryWindowMinutes] = useState(
        DEFAULT_HISTORY_WINDOW_MINUTES,
    );

    const [historyResolution, setHistoryResolution] =
        useState<RtcmFlowHistoryRequestResolution>('auto');

    const [historyReloadRevision, setHistoryReloadRevision] = useState(0);

    const [historyState, setHistoryState] = useState<HistoryLoadState>({
        settledQueryKey: null,
        result: null,
        error: null,
    });

    const [initialSnapshotSettled, setInitialSnapshotSettled] = useState(false);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [snapshotError, setSnapshotError] = useState<string | null>(null);

    const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<Date | null>(
        null,
    );

    const [snapshotReceivedAtUnixMs, setSnapshotReceivedAtUnixMs] = useState<
        number | null
    >(null);

    const [currentUnixMs, setCurrentUnixMs] = useState(() => Date.now());

    const snapshotRequestControllerRef = useRef<AbortController | null>(null);

    const historyRequestControllerRef = useRef<AbortController | null>(null);

    const rawConnectionStatus = useConnectionStatus();

    const realtimeConnectionState = useMemo(
        () => normaliseRealtimeConnectionState(rawConnectionStatus),
        [rawConnectionStatus],
    );

    const commitSnapshot = useCallback(
        (nextSnapshot: RtcmFlowSnapshot): boolean => {
            if (!shouldReplaceSnapshot(snapshotRef.current, nextSnapshot)) {
                return false;
            }

            snapshotRef.current = nextSnapshot;

            setSnapshot(nextSnapshot);
            setSnapshotReceivedAtUnixMs(Date.now());

            return true;
        },
        [],
    );

    const refresh = useCallback(async (): Promise<boolean> => {
        snapshotRequestControllerRef.current?.abort();

        const controller = new AbortController();

        snapshotRequestControllerRef.current = controller;
        setIsRefreshing(true);

        try {
            const result = await fetchRtcmFlowSnapshot(controller.signal);

            if (snapshotRequestControllerRef.current !== controller) {
                return false;
            }

            if (result.snapshot !== null) {
                commitSnapshot(result.snapshot);
            }

            setSnapshotError(null);

            return true;
        } catch (reason) {
            if (
                isAbortError(reason) ||
                snapshotRequestControllerRef.current !== controller
            ) {
                return false;
            }

            /*
             * Không xóa snapshot cuối cùng
             * khi API tạm thời bị lỗi.
             */
            setSnapshotError(
                formatRequestError(
                    reason,
                    'Unable to load RTCM flow snapshot.',
                ),
            );

            return false;
        } finally {
            if (snapshotRequestControllerRef.current === controller) {
                snapshotRequestControllerRef.current = null;

                setIsRefreshing(false);
                setInitialSnapshotSettled(true);
            }
        }
    }, [commitSnapshot]);

    const handleRealtimeEvent = useCallback(
        (event: RtcmFlowSnapshotUpdatedEvent): void => {
            const nextSnapshot = normaliseRtcmFlowRealtimeEvent(event);

            if (nextSnapshot === null || !commitSnapshot(nextSnapshot)) {
                return;
            }

            setSnapshotError(null);
            setInitialSnapshotSettled(true);
            setLastRealtimeEventAt(nextSnapshot.emittedAt);
        },
        [commitSnapshot],
    );

    useEcho<RtcmFlowSnapshotUpdatedEvent>(
        NTRIP_DASHBOARD_CHANNEL,
        RTCM_FLOW_SNAPSHOT_UPDATED_EVENT,
        handleRealtimeEvent,
    );

    const { isRealtimeResyncing, lastRealtimeResyncedAt } = useRealtimeResync({
        connectionState: realtimeConnectionState,

        /*
         * Sau reconnect chỉ cần lấy snapshot mới nhất.
         * Không tải lại history mỗi lần WebSocket nối lại.
         */
        refresh,
    });

    const mountpoints = useMemo<RtcmFlowMountpointSnapshot[]>(
        () =>
            [...(snapshot?.mountpoints ?? [])].sort(
                (left, right) => left.mountpointId - right.mountpointId,
            ),
        [snapshot],
    );

    /*
     * selectedMountpointId là dữ liệu có thể suy ra từ state hiện có,
     * vì vậy không đồng bộ nó bằng Effect.
     */
    const selectedMountpointId = useMemo((): number | null => {
        if (
            requestedMountpointId !== null &&
            mountpoints.some(
                (mountpoint) =>
                    mountpoint.mountpointId === requestedMountpointId,
            )
        ) {
            return requestedMountpointId;
        }

        return mountpoints[0]?.mountpointId ?? null;
    }, [mountpoints, requestedMountpointId]);

    const selectedMountpoint = useMemo(
        () =>
            mountpoints.find(
                (mountpoint) =>
                    mountpoint.mountpointId === selectedMountpointId,
            ) ?? null,
        [mountpoints, selectedMountpointId],
    );

    const rovers = useMemo<RtcmFlowRoverSnapshot[]>(
        () =>
            (snapshot?.rovers ?? [])
                .filter((rover) => rover.mountpointId === selectedMountpointId)
                .sort((left, right) => left.sessionId - right.sessionId),
        [selectedMountpointId, snapshot],
    );

    const historyQueryKey = useMemo((): string | null => {
        if (selectedMountpointId === null) {
            return null;
        }

        return [
            selectedMountpointId,
            historyResolution,
            Math.max(1, historyWindowMinutes),
            historyReloadRevision,
        ].join(':');
    }, [
        historyReloadRevision,
        historyResolution,
        historyWindowMinutes,
        selectedMountpointId,
    ]);

    const reloadHistory = useCallback((): void => {
        setHistoryReloadRevision((revision) => revision + 1);
    }, []);

    /*
     * Snapshot ban đầu là đồng bộ với hệ thống bên ngoài (HTTP API),
     * nên Effect là phù hợp. Mọi setState chỉ chạy sau khi request settle.
     */
    useEffect(() => {
        snapshotRequestControllerRef.current?.abort();

        const controller = new AbortController();
        let ignore = false;

        snapshotRequestControllerRef.current = controller;

        async function loadInitialSnapshot(): Promise<void> {
            try {
                const result = await fetchRtcmFlowSnapshot(controller.signal);

                if (
                    ignore ||
                    snapshotRequestControllerRef.current !== controller
                ) {
                    return;
                }

                if (result.snapshot !== null) {
                    commitSnapshot(result.snapshot);
                }

                setSnapshotError(null);
            } catch (reason) {
                if (
                    ignore ||
                    isAbortError(reason) ||
                    snapshotRequestControllerRef.current !== controller
                ) {
                    return;
                }

                setSnapshotError(
                    formatRequestError(
                        reason,
                        'Unable to load RTCM flow snapshot.',
                    ),
                );
            } finally {
                if (
                    !ignore &&
                    snapshotRequestControllerRef.current === controller
                ) {
                    snapshotRequestControllerRef.current = null;
                    setInitialSnapshotSettled(true);
                }
            }
        }

        void loadInitialSnapshot();

        return () => {
            ignore = true;
            controller.abort();

            if (snapshotRequestControllerRef.current === controller) {
                snapshotRequestControllerRef.current = null;
            }
        };
    }, [commitSnapshot]);

    /*
     * History được đồng bộ theo Mountpoint, cửa sổ thời gian,
     * độ phân giải và yêu cầu reload hiện tại.
     */
    useEffect(() => {
        const mountpointId = selectedMountpointId;

        if (mountpointId === null || historyQueryKey === null) {
            return;
        }

        const activeMountpointId: number = mountpointId;
        const activeHistoryQueryKey: string = historyQueryKey;

        historyRequestControllerRef.current?.abort();

        const controller = new AbortController();
        let ignore = false;

        historyRequestControllerRef.current = controller;

        const to = new Date();

        const from = new Date(
            to.getTime() - Math.max(1, historyWindowMinutes) * 60_000,
        );

        async function loadHistory(): Promise<void> {
            try {
                const result = await fetchRtcmFlowHistory({
                    mountpointId: activeMountpointId,
                    resolution: historyResolution,
                    from,
                    to,
                    maxPoints: DEFAULT_HISTORY_MAX_POINTS,
                    signal: controller.signal,
                });

                if (
                    ignore ||
                    historyRequestControllerRef.current !== controller ||
                    result.meta.mountpointId !== activeMountpointId
                ) {
                    return;
                }

                setHistoryState({
                    settledQueryKey: activeHistoryQueryKey,
                    result,
                    error: null,
                });
            } catch (reason) {
                if (
                    ignore ||
                    isAbortError(reason) ||
                    historyRequestControllerRef.current !== controller
                ) {
                    return;
                }

                setHistoryState((current) => ({
                    settledQueryKey: activeHistoryQueryKey,
                    result: current.result,
                    error: formatRequestError(
                        reason,
                        'Unable to load RTCM flow history.',
                    ),
                }));
            } finally {
                if (
                    !ignore &&
                    historyRequestControllerRef.current === controller
                ) {
                    historyRequestControllerRef.current = null;
                }
            }
        }

        void loadHistory();

        return () => {
            ignore = true;
            controller.abort();

            if (historyRequestControllerRef.current === controller) {
                historyRequestControllerRef.current = null;
            }
        };
    }, [
        historyQueryKey,
        historyResolution,
        historyWindowMinutes,
        selectedMountpointId,
    ]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentUnixMs(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(
        () => () => {
            snapshotRequestControllerRef.current?.abort();
            snapshotRequestControllerRef.current = null;

            historyRequestControllerRef.current?.abort();
            historyRequestControllerRef.current = null;
        },
        [],
    );

    const history =
        historyState.result?.meta.mountpointId === selectedMountpointId
            ? historyState.result
            : null;

    const isHistoryLoading =
        historyQueryKey !== null &&
        historyState.settledQueryKey !== historyQueryKey;

    const historyError =
        historyQueryKey !== null &&
        historyState.settledQueryKey === historyQueryKey
            ? historyState.error
            : null;

    const staleAfterMs = Math.max(
        MINIMUM_STALE_AFTER_MS,
        (snapshot?.intervalMs ?? 1000) * 3,
    );

    const snapshotAgeMs =
        snapshotReceivedAtUnixMs === null
            ? null
            : Math.max(0, currentUnixMs - snapshotReceivedAtUnixMs);

    const isStale =
        snapshot === null ||
        snapshotAgeMs === null ||
        snapshotAgeMs > staleAfterMs;

    return {
        snapshot,

        mountpoints,

        selectedMountpointId,
        setSelectedMountpointId: setRequestedMountpointId,

        selectedMountpoint,

        rovers,

        history,
        historyPoints: history?.points ?? [],
        historyMeta: history?.meta ?? null,

        historyWindowMinutes,
        setHistoryWindowMinutes,

        historyResolution,
        setHistoryResolution,

        isInitialLoading: !initialSnapshotSettled,
        isRefreshing,
        isHistoryLoading,

        realtimeConnectionState,
        isRealtimeConnected: realtimeConnectionState === 'connected',

        isRealtimeResyncing,
        isStale,

        staleAfterMs,
        snapshotAgeMs,

        snapshotError,
        historyError,

        lastRealtimeEventAt,
        lastRealtimeResyncedAt,

        refresh,
        reloadHistory,
    };
}
