import '@xyflow/react/dist/style.css';

import { Head } from '@inertiajs/react';
import { RadioTower, RefreshCw, Server, Wifi, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import type { RoverAccount } from '@/features/rover-accounts/types';
import { useRoverAccounts } from '@/features/rover-accounts/use-rover-accounts';
import { useIsMobile } from '@/hooks/use-mobile';
import { createApiHeaders } from '@/lib/api-headers';
import { cn } from '@/lib/utils';

import { MountpointOperationsPanel } from './components/mountpoint-operations-panel';
import type { MountpointWorkbenchStatusFilter } from './components/mountpoint-operations-panel';
import { MountpointTopologyPanel } from './components/mountpoint-topology-panel';
import type { SelectedTopologyEntity } from './components/mountpoint-topology-panel';
import { attachSessions, normalizeMountpoints } from './lib/mountpoint-data';
import {
    mapDashboardSessionsToActiveSessions,
    mergeRealtimeStationsIntoMountpoints,
} from './lib/mountpoint-realtime';
import type { MountpointAccessMode, MountpointRecord } from './types';

type JsonObject = Record<string, unknown>;

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function readMessage(payload: unknown): string | null {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload)
    ) {
        return null;
    }

    const message = (payload as JsonObject).message;

    return typeof message === 'string' ? message : null;
}

function readAccessMode(payload: unknown): MountpointAccessMode | null {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload)
    ) {
        return null;
    }

    const data = (payload as JsonObject).data;

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return null;
    }

    const accessMode = (data as JsonObject).access_mode;

    return accessMode === 'public' || accessMode === 'authenticated'
        ? accessMode
        : null;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
        signal,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
        throw new Error(
            readMessage(payload) ??
                `Request failed with HTTP ${response.status}.`,
        );
    }

    return payload;
}

async function updateMountpointAccessMode(
    mountpointId: string,
    accessMode: MountpointAccessMode,
): Promise<MountpointAccessMode> {
    const response = await fetch(`/api/v1/mountpoints/${mountpointId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: createApiHeaders(true),
        body: JSON.stringify({ access_mode: accessMode }),
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
        throw new Error(
            readMessage(payload) ??
                `Unable to update Anonymous access. HTTP ${response.status}.`,
        );
    }

    const savedAccessMode = readAccessMode(payload);

    if (savedAccessMode === null) {
        throw new Error('Server did not return the saved access_mode.');
    }

    return savedAccessMode;
}

export default function MountpointsIndex() {
    const {
        stations: realtimeStations,
        activeSessionItems,
        error: dashboardError,
        realtimeConnectionState,
    } = useMapDashboard();
    const isMobile = useIsMobile();
    const roverAccounts = useRoverAccounts();
    const { accounts: roverAccountItems, loadAccount: loadRoverAccount } =
        roverAccounts;

    const [mountpoints, setMountpoints] = useState<MountpointRecord[]>([]);
    const [hydratedRoverAccounts, setHydratedRoverAccounts] = useState<
        RoverAccount[]
    >([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<MountpointWorkbenchStatusFilter>('all');
    const [selectedEntity, setSelectedEntity] =
        useState<SelectedTopologyEntity>(null);
    const [operationsCollapsed, setOperationsCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mountpointError, setMountpointError] = useState<string | null>(null);
    const [roverAccountTopologyError, setRoverAccountTopologyError] = useState<
        string | null
    >(null);
    const [accessModeError, setAccessModeError] = useState<string | null>(null);
    const [updatingAccessModeIds, setUpdatingAccessModeIds] = useState<
        Set<string>
    >(() => new Set());

    const loadData = useCallback(
        async (signal?: AbortSignal): Promise<void> => {
            try {
                const payload = await fetchJson('/api/v1/mountpoints', signal);

                if (!signal?.aborted) {
                    setMountpoints(normalizeMountpoints(payload));
                    setMountpointError(null);
                }
            } catch (requestError) {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setMountpointError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to load mountpoint topology.',
                );
            } finally {
                if (!signal?.aborted) {
                    setLoading(false);
                }
            }
        },
        [],
    );

    const handleAnonymousAccessChange = useCallback(
        async (
            mountpointId: string,
            anonymousEnabled: boolean,
        ): Promise<void> => {
            setAccessModeError(null);
            setUpdatingAccessModeIds((current) =>
                new Set(current).add(mountpointId),
            );

            try {
                const savedAccessMode = await updateMountpointAccessMode(
                    mountpointId,
                    anonymousEnabled ? 'public' : 'authenticated',
                );

                setMountpoints((current) =>
                    current.map((mountpoint) =>
                        mountpoint.id === mountpointId
                            ? { ...mountpoint, accessMode: savedAccessMode }
                            : mountpoint,
                    ),
                );
            } catch (reason) {
                setAccessModeError(
                    reason instanceof Error
                        ? reason.message
                        : 'Unable to update Anonymous access.',
                );
            } finally {
                setUpdatingAccessModeIds((current) => {
                    const next = new Set(current);
                    next.delete(mountpointId);

                    return next;
                });
            }
        },
        [],
    );

    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            void loadData(controller.signal);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [loadData]);

    useEffect(() => {
        if (isMobile) {
            setOperationsCollapsed(true);
        }
    }, [isMobile]);

    useEffect(() => {
        let cancelled = false;

        const loadRoverAccountAccess = async (): Promise<void> => {
            const accountsNeedingDetails = roverAccountItems.filter(
                (account) =>
                    account.mountpointCount > 0 &&
                    account.mountpoints.length === 0,
            );

            if (accountsNeedingDetails.length === 0) {
                return;
            }

            try {
                const detailedAccounts = await Promise.all(
                    accountsNeedingDetails.map((account) =>
                        loadRoverAccount(account.id),
                    ),
                );

                if (!cancelled) {
                    setHydratedRoverAccounts(detailedAccounts);
                    setRoverAccountTopologyError(null);
                }
            } catch (reason) {
                if (!cancelled) {
                    setRoverAccountTopologyError(
                        reason instanceof Error
                            ? reason.message
                            : 'Unable to load Rover Account access.',
                    );
                }
            }
        };

        void loadRoverAccountAccess();

        return () => {
            cancelled = true;
        };
    }, [loadRoverAccount, roverAccountItems]);

    const topologyRoverAccounts = useMemo(() => {
        const hydratedById = new Map(
            hydratedRoverAccounts.map((account) => [account.id, account]),
        );

        return roverAccountItems.map((account) =>
            account.mountpointCount === 0 || account.mountpoints.length > 0
                ? account
                : (hydratedById.get(account.id) ?? account),
        );
    }, [hydratedRoverAccounts, roverAccountItems]);

    const roverAccountsByMountpointId = useMemo(() => {
        const result = new Map<string, RoverAccount[]>();

        for (const account of topologyRoverAccounts) {
            for (const mountpoint of account.mountpoints) {
                const id = String(mountpoint.id);
                result.set(id, [...(result.get(id) ?? []), account]);
            }
        }

        return result;
    }, [topologyRoverAccounts]);

    const realtimeSessions = useMemo(
        () => mapDashboardSessionsToActiveSessions(activeSessionItems),
        [activeSessionItems],
    );
    const realtimeMountpoints = useMemo(
        () =>
            mergeRealtimeStationsIntoMountpoints(mountpoints, realtimeStations),
        [mountpoints, realtimeStations],
    );
    const enrichedMountpoints = useMemo(
        () => attachSessions(realtimeMountpoints, realtimeSessions),
        [realtimeMountpoints, realtimeSessions],
    );

    const unassignedAutoSessions = useMemo(
        () =>
            realtimeSessions.filter(
                (session) =>
                    session.connectionType.toLowerCase() === 'rover' &&
                    session.autoMountpoint &&
                    session.mountpointId === null,
            ),
        [realtimeSessions],
    );

    const filteredAutoSessions = useMemo(() => {
        if (statusFilter !== 'all' && statusFilter !== 'waiting-source') {
            return [];
        }

        const query = searchQuery.trim().toLowerCase();

        if (query === '') {
            return unassignedAutoSessions;
        }

        return unassignedAutoSessions.filter((session) =>
            [
                session.username ?? '',
                session.remoteIp ?? '',
                session.requestedMountpoint ?? '',
                session.autoState ?? '',
            ].some((value) => value.toLowerCase().includes(query)),
        );
    }, [searchQuery, statusFilter, unassignedAutoSessions]);

    const filteredMountpoints = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return enrichedMountpoints.filter((mountpoint) => {
            if (statusFilter !== 'all' && mountpoint.status !== statusFilter) {
                return false;
            }

            if (query === '') {
                return true;
            }

            return [
                mountpoint.name,
                mountpoint.identifier ?? '',
                mountpoint.format ?? '',
                mountpoint.navSystem ?? '',
                mountpoint.station?.name ?? '',
                mountpoint.station?.deviceId ?? '',
                ...mountpoint.sessions.map(
                    (session) =>
                        `${session.username ?? ''} ${session.remoteIp ?? ''}`,
                ),
                ...(roverAccountsByMountpointId.get(mountpoint.id) ?? []).map(
                    (account) =>
                        `${account.username} ${account.displayName ?? ''}`,
                ),
            ].some((value) => value.toLowerCase().includes(query));
        });
    }, [
        enrichedMountpoints,
        roverAccountsByMountpointId,
        searchQuery,
        statusFilter,
    ]);

    const statistics = useMemo(
        () => ({
            total: enrichedMountpoints.length,
            online: enrichedMountpoints.filter(
                (mountpoint) => mountpoint.status === 'online',
            ).length,
            waiting: enrichedMountpoints.filter(
                (mountpoint) => mountpoint.status === 'waiting-source',
            ).length,
            accounts: topologyRoverAccounts.length,
        }),
        [enrichedMountpoints, topologyRoverAccounts.length],
    );

    const hasUnhydratedRoverAccounts = topologyRoverAccounts.some(
        (account) =>
            account.mountpointCount > 0 && account.mountpoints.length === 0,
    );
    const visibleError =
        accessModeError ??
        mountpointError ??
        roverAccounts.error ??
        (hasUnhydratedRoverAccounts ? roverAccountTopologyError : null) ??
        dashboardError;
    const realtimeActive = realtimeConnectionState === 'connected';

    const handleSelectEntity = useCallback(
        (entity: SelectedTopologyEntity): void => {
            setSelectedEntity(entity);

            if (isMobile && entity !== null) {
                setOperationsCollapsed(true);
            }
        },
        [isMobile],
    );

    const handleOperationsCollapsedChange = useCallback(
        (collapsed: boolean): void => {
            setOperationsCollapsed(collapsed);

            if (isMobile && !collapsed) {
                setSelectedEntity(null);
            }
        },
        [isMobile],
    );

    return (
        <>
            <Head title="Mountpoints" />

            <div className="pointer-events-none absolute inset-0 min-h-0 min-w-0">
                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className="pointer-events-auto absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/24 bg-ntrip-ink shadow-ntrip-panel"
                >
                    {loading ? (
                        <div className="grid h-full place-items-center bg-ntrip-ink text-ntrip-cloud">
                            <div className="text-center">
                                <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />
                                <p className="mt-3 text-xs font-semibold">
                                    Loading topology
                                </p>
                            </div>
                        </div>
                    ) : (
                        <MountpointTopologyPanel
                            mountpoints={filteredMountpoints}
                            roverAccounts={topologyRoverAccounts}
                            autoSessions={filteredAutoSessions}
                            selectedEntity={selectedEntity}
                            onSelectEntity={handleSelectEntity}
                        />
                    )}
                </section>

                <MountpointOperationsPanel
                    collapsed={operationsCollapsed}
                    onCollapsedChange={handleOperationsCollapsedChange}
                    mountpoints={enrichedMountpoints}
                    visibleMountpoints={filteredMountpoints}
                    autoSessions={filteredAutoSessions}
                    accounts={topologyRoverAccounts}
                    roverAccounts={roverAccounts}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    selectedEntity={selectedEntity}
                    onSelectEntity={handleSelectEntity}
                    updatingAccessModeIds={updatingAccessModeIds}
                    onAnonymousAccessChange={handleAnonymousAccessChange}
                />

                <NetworkStatusBar
                    realtimeActive={realtimeActive}
                    statistics={statistics}
                    autoWaiting={unassignedAutoSessions.length}
                />

                {visibleError ? (
                    <div className="pointer-events-auto absolute top-4 left-1/2 z-50 max-w-[min(34rem,calc(100%-7rem))] -translate-x-1/2 rounded-full border border-ntrip-coral/24 bg-ntrip-ink/88 px-4 py-2 text-center text-micro font-medium text-ntrip-coral shadow-ntrip-panel backdrop-blur-2xl">
                        {visibleError}
                    </div>
                ) : null}

                {selectedEntity ? (
                    <TopologyInspector
                        entity={selectedEntity}
                        onClose={() => setSelectedEntity(null)}
                    />
                ) : null}
            </div>
        </>
    );
}

function NetworkStatusBar({
    realtimeActive,
    statistics,
    autoWaiting,
}: {
    realtimeActive: boolean;
    statistics: {
        total: number;
        online: number;
        waiting: number;
        accounts: number;
    };
    autoWaiting: number;
}) {
    return (
        <div className="pointer-events-auto absolute top-4 right-4 z-20 flex h-10 items-center gap-2 rounded-full border border-ntrip-cloud/10 bg-ntrip-ink/76 px-3 text-2xs font-medium text-ntrip-cloud/66 shadow-ntrip-panel-soft backdrop-blur-2xl">
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    realtimeActive ? 'bg-ntrip-teal' : 'bg-ntrip-amber',
                )}
            />
            <span>{realtimeActive ? 'Realtime' : 'Snapshot'}</span>

            <span className="hidden h-3 w-px bg-ntrip-cloud/12 sm:block" />
            <span className="hidden sm:inline">
                {statistics.online}/{statistics.total} online
            </span>

            {statistics.waiting > 0 ? (
                <>
                    <span className="hidden h-3 w-px bg-ntrip-cloud/12 sm:block" />
                    <span className="text-ntrip-amber">
                        {statistics.waiting} waiting
                    </span>
                </>
            ) : null}

            {autoWaiting > 0 ? (
                <span className="hidden rounded-full bg-ntrip-amber/12 px-2 py-1 text-ntrip-amber md:inline">
                    {autoWaiting} AUTO
                </span>
            ) : null}
        </div>
    );
}

type InspectorRow = {
    label: string;
    value: string;
};

function inspectorRows(
    entity: Exclude<SelectedTopologyEntity, null>,
): InspectorRow[] {
    if (entity.kind === 'station') {
        return [
            {
                label: 'Status',
                value: entity.online ? 'Source online' : 'Source offline',
            },
            { label: 'Device', value: entity.deviceId },
            {
                label: 'Mountpoints',
                value: String(entity.mountpointCount),
            },
        ];
    }

    if (entity.kind === 'mountpoint') {
        return [
            {
                label: 'Status',
                value: entity.status.replaceAll('-', ' '),
            },
            {
                label: 'Rovers',
                value: String(entity.connectedRoverCount),
            },
            {
                label: 'Registered',
                value: String(entity.registeredRoverCount),
            },
            { label: 'Bitrate', value: entity.bitrate },
        ];
    }

    return [
        {
            label: 'Status',
            value: entity.autoMountpoint
                ? (entity.autoState?.replaceAll('_', ' ') ?? 'AUTO')
                : entity.connected
                  ? 'Connected'
                  : 'Offline',
        },
        {
            label: 'Username',
            value: entity.username ?? 'Unregistered',
        },
        {
            label: 'Sessions',
            value: String(entity.sessionCount),
        },
        {
            label: 'Transferred',
            value: entity.bytesTransferred,
        },
    ];
}

function TopologyInspector({
    entity,
    onClose,
}: {
    entity: Exclude<SelectedTopologyEntity, null>;
    onClose: () => void;
}) {
    const Icon =
        entity.kind === 'station'
            ? Server
            : entity.kind === 'mountpoint'
              ? RadioTower
              : Wifi;
    const rows = inspectorRows(entity);

    return (
        <aside className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 max-h-[42dvh] overflow-y-auto rounded-[1.5rem] border border-ntrip-cloud/12 bg-ntrip-ink/92 p-4 text-ntrip-cloud shadow-ntrip-topology-panel backdrop-blur-2xl sm:right-4 sm:bottom-4 sm:left-auto sm:w-[17rem]">
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ntrip-teal/13 text-ntrip-teal">
                    <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-3xs font-semibold tracking-[0.12em] text-ntrip-cloud/36 uppercase">
                        {entity.kind}
                    </p>
                    <h2 className="mt-0.5 truncate text-sm font-semibold">
                        {'name' in entity ? entity.name : entity.label}
                    </h2>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="size-10 rounded-xl text-ntrip-cloud/42 hover:bg-ntrip-cloud/8 hover:text-ntrip-cloud"
                    aria-label="Close details"
                >
                    <X className="size-4" />
                </Button>
            </div>

            <dl className="mt-4 divide-y divide-ntrip-cloud/8 border-t border-ntrip-cloud/8 text-2xs">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 py-2.5"
                    >
                        <dt className="text-ntrip-cloud/40">{row.label}</dt>
                        <dd className="max-w-[62%] truncate text-right font-medium text-ntrip-cloud/76 capitalize">
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </aside>
    );
}
