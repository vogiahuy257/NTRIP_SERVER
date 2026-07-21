import { router } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { useMapDashboard } from '@/contexts/map-dashboard-context';
import {
    approvePendingDevice,
    fetchPendingDevices,
    rejectPendingDevice,
} from './pending-device-api';
import { extractBroadcastPendingDevice } from './pending-device-contract';
import type {
    ApprovePendingDeviceInput,
    PendingDeviceBroadcastPayload,
    PendingDeviceItem,
} from './types';

const REALTIME_CHANNEL = 'ntrip.dashboard';

const REALTIME_EVENTS = ['.device.discovered', '.device.updated'];

export type PendingDeviceContextValue = {
    devices: PendingDeviceItem[];
    pendingDevices: PendingDeviceItem[];
    pendingCount: number;

    isLoading: boolean;
    isRefreshing: boolean;

    error: string | null;
    actionError: string | null;

    approvingDeviceIds: ReadonlySet<number>;
    rejectingDeviceIds: ReadonlySet<number>;

    refresh: () => void;

    approve: (
        deviceId: number,
        input?: ApprovePendingDeviceInput,
    ) => Promise<PendingDeviceItem | null>;

    reject: (
        deviceId: number,
        reason?: string,
    ) => Promise<PendingDeviceItem | null>;
};

export const PendingDeviceContext = createContext<
    PendingDeviceContextValue | undefined
>(undefined);

type PendingDeviceProviderProps = {
    children: ReactNode;
};

function timestampOf(device: PendingDeviceItem): number {
    if (device.lastSeenAt === null) {
        return 0;
    }

    const timestamp = new Date(device.lastSeenAt).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortDevices(devices: PendingDeviceItem[]): PendingDeviceItem[] {
    return [...devices].sort(
        (left, right) => timestampOf(right) - timestampOf(left),
    );
}

function mergeDevice(
    current: PendingDeviceItem,
    incoming: PendingDeviceItem,
): PendingDeviceItem {
    return {
        ...current,
        ...incoming,

        /*
         * Realtime event có thể không chứa relationship
         * Station. Giữ dữ liệu Station đã tải từ API.
         */
        station: incoming.station ?? current.station,
    };
}

function upsertDevice(
    devices: PendingDeviceItem[],
    incoming: PendingDeviceItem,
): PendingDeviceItem[] {
    const current = devices.find((device) => device.id === incoming.id);

    const next =
        current === undefined ? incoming : mergeDevice(current, incoming);

    return sortDevices([
        ...devices.filter((device) => device.id !== incoming.id),
        next,
    ]);
}

function mergeLoadedDevices(
    current: PendingDeviceItem[],
    loaded: PendingDeviceItem[],
): PendingDeviceItem[] {
    return loaded.reduce(
        (devices, device) => upsertDevice(devices, device),
        current,
    );
}

function isAbortError(reason: unknown): boolean {
    return reason instanceof Error && reason.name === 'AbortError';
}

function errorMessage(reason: unknown, fallback: string): string {
    return reason instanceof Error ? reason.message : fallback;
}

function addId(current: Set<number>, deviceId: number): Set<number> {
    const next = new Set(current);

    next.add(deviceId);

    return next;
}

function removeId(current: Set<number>, deviceId: number): Set<number> {
    const next = new Set(current);

    next.delete(deviceId);

    return next;
}

function registerProvisionedDevices(
    devices: PendingDeviceItem[],
    knownDeviceIds: Set<number>,
): PendingDeviceItem[] {
    const newlyProvisioned: PendingDeviceItem[] = [];

    for (const device of devices) {
        if (device.status !== 'provisioned' || knownDeviceIds.has(device.id)) {
            continue;
        }

        knownDeviceIds.add(device.id);
        newlyProvisioned.push(device);
    }

    return newlyProvisioned;
}

export function PendingDeviceProvider({
    children,
}: PendingDeviceProviderProps) {
    const { refresh: refreshDashboard } = useMapDashboard();

    const [devices, setDevices] = useState<PendingDeviceItem[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [actionError, setActionError] = useState<string | null>(null);

    const [approvingDeviceIds, setApprovingDeviceIds] = useState<Set<number>>(
        () => new Set(),
    );

    const [rejectingDeviceIds, setRejectingDeviceIds] = useState<Set<number>>(
        () => new Set(),
    );

    const requestControllerRef = useRef<AbortController | null>(null);

    const knownProvisionedDeviceIdsRef = useRef<Set<number>>(new Set());

    const devicesLoadedRef = useRef(false);

    const syncProvisionedStation = useCallback(
        async (device: PendingDeviceItem, announce = true): Promise<void> => {
            const refreshed = await refreshDashboard();

            if (!announce) {
                return;
            }

            toast.success('Device provisioned', {
                description: refreshed
                    ? `${device.hardwareId} is now available on the dashboard.`
                    : `${device.hardwareId} was provisioned, but the dashboard could not be refreshed.`,
            });
        },
        [refreshDashboard],
    );

    const fetchDevices = useCallback(
        (controller: AbortController): Promise<void> => {
            return fetchPendingDevices(controller.signal)
                .then((loaded) => {
                    if (requestControllerRef.current !== controller) {
                        return;
                    }

                    const newlyProvisioned = registerProvisionedDevices(
                        loaded,
                        knownProvisionedDeviceIdsRef.current,
                    );

                    const shouldSynchronizeDashboard =
                        devicesLoadedRef.current && newlyProvisioned.length > 0;

                    devicesLoadedRef.current = true;

                    setDevices((current) =>
                        mergeLoadedDevices(current, loaded),
                    );

                    setError(null);

                    if (shouldSynchronizeDashboard) {
                        void syncProvisionedStation(newlyProvisioned[0], false);
                    }
                })
                .catch((requestError: unknown) => {
                    if (
                        isAbortError(requestError) ||
                        requestControllerRef.current !== controller
                    ) {
                        return;
                    }

                    setError(
                        errorMessage(
                            requestError,
                            'Unable to load pending devices.',
                        ),
                    );
                })
                .finally(() => {
                    if (requestControllerRef.current !== controller) {
                        return;
                    }

                    requestControllerRef.current = null;

                    setIsLoading(false);
                    setIsRefreshing(false);
                });
        },
        [syncProvisionedStation],
    );

    useEffect(() => {
        const controller = new AbortController();

        requestControllerRef.current = controller;

        void fetchDevices(controller);

        return () => {
            controller.abort();

            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
            }
        };
    }, [fetchDevices]);

    const handleRealtimeDevice = useCallback(
        (payload: PendingDeviceBroadcastPayload): void => {
            const device = extractBroadcastPendingDevice(payload);

            if (device === null) {
return;
}

            const newlyProvisioned =
                registerProvisionedDevices(
                    [device],
                    knownProvisionedDeviceIdsRef.current,
                ).length > 0;

            setDevices((current) => upsertDevice(current, device));

            if (newlyProvisioned) {
                void syncProvisionedStation(device);

                return;
            }

            if (
                payload.action !== 'discovered' ||
                device.status !== 'pending'
            ) {
                return;
            }

            toast('New ESP32 device detected', {
                id: `pending-device-${device.id}`,

                description: device.hardwareId,

                action: {
                    label: 'Review device',

                    onClick: () => {
                        router.visit(
                            `/stations?tab=pending&device=${device.id}`,
                            {
                                preserveScroll: true,
                                preserveState: true,
                            },
                        );
                    },
                },
            });
        },
        [syncProvisionedStation],
    );

    /*
     * useEcho mặc định subscribe private channel.
     * Hai custom broadcastAs event có dấu "." ở đầu.
     */
    useEcho<PendingDeviceBroadcastPayload>(
        REALTIME_CHANNEL,
        REALTIME_EVENTS,
        handleRealtimeDevice,
    );

    const refresh = useCallback((): void => {
        requestControllerRef.current?.abort();

        const controller = new AbortController();

        requestControllerRef.current = controller;

        setIsRefreshing(true);
        setError(null);

        void fetchDevices(controller);
    }, [fetchDevices]);

    const approve = useCallback(
        async (
            deviceId: number,
            input: ApprovePendingDeviceInput = {},
        ): Promise<PendingDeviceItem | null> => {
            setActionError(null);

            setApprovingDeviceIds((current) => addId(current, deviceId));

            try {
                const device = await approvePendingDevice(deviceId, input);

                setDevices((current) => upsertDevice(current, device));

                toast.success('Device approved', {
                    description:
                        'Waiting for the ESP32 to download its configuration.',
                });

                return device;
            } catch (requestError) {
                const message = errorMessage(
                    requestError,
                    'Unable to approve device.',
                );

                setActionError(message);

                toast.error('Approval failed', {
                    description: message,
                });

                return null;
            } finally {
                setApprovingDeviceIds((current) => removeId(current, deviceId));
            }
        },
        [],
    );

    const reject = useCallback(
        async (
            deviceId: number,
            reason?: string,
        ): Promise<PendingDeviceItem | null> => {
            setActionError(null);

            setRejectingDeviceIds((current) => addId(current, deviceId));

            try {
                const device = await rejectPendingDevice(deviceId, reason);

                setDevices((current) => upsertDevice(current, device));

                toast.success('Device rejected');

                return device;
            } catch (requestError) {
                const message = errorMessage(
                    requestError,
                    'Unable to reject device.',
                );

                setActionError(message);

                toast.error('Rejection failed', {
                    description: message,
                });

                return null;
            } finally {
                setRejectingDeviceIds((current) => removeId(current, deviceId));
            }
        },
        [],
    );

    const pendingDevices = useMemo(
        () => devices.filter((device) => device.status === 'pending'),
        [devices],
    );

    const contextValue = useMemo<PendingDeviceContextValue>(
        () => ({
            devices,
            pendingDevices,
            pendingCount: pendingDevices.length,

            isLoading,
            isRefreshing,

            error,
            actionError,

            approvingDeviceIds,
            rejectingDeviceIds,

            refresh,
            approve,
            reject,
        }),
        [
            actionError,
            approve,
            approvingDeviceIds,
            devices,
            error,
            isLoading,
            isRefreshing,
            pendingDevices,
            refresh,
            reject,
            rejectingDeviceIds,
        ],
    );

    return (
        <PendingDeviceContext.Provider value={contextValue}>
            {children}
        </PendingDeviceContext.Provider>
    );
}
