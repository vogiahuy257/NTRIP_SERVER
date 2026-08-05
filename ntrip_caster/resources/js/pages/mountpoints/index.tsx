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

    return (
        <>
            <Head title="Mountpoints" />

            <div className="pointer-events-none absolute inset-0 min-h-0 min-w-0">
                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className="pointer-events-auto absolute inset-0 overflow-hidden rounded-2xl border border-white/26 bg-ntrip-ink shadow-ntrip-panel"
                >
                    {loading ? (
                        <div className="grid h-full place-items-center bg-ntrip-ink text-ntrip-cloud">
                            <div className="text-center">
                                <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />
                                <p className="mt-3 text-xs font-semibold">
                                    Loading mountpoint topology
                                </p>
                            </div>
                        </div>
                    ) : (
                        <MountpointTopologyPanel
                            mountpoints={filteredMountpoints}
                            roverAccounts={topologyRoverAccounts}
                            autoSessions={filteredAutoSessions}
                            selectedEntity={selectedEntity}
                            onSelectEntity={setSelectedEntity}
                        />
                    )}
                </section>

                <MountpointOperationsPanel
                    collapsed={operationsCollapsed}
                    onCollapsedChange={setOperationsCollapsed}
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
                    onSelectEntity={setSelectedEntity}
                    updatingAccessModeIds={updatingAccessModeIds}
                    onAnonymousAccessChange={handleAnonymousAccessChange}
                />

                <div className="pointer-events-auto absolute top-3 right-3 z-20 inline-flex h-8 items-center gap-2 rounded-full border border-ntrip-cloud/10 bg-ntrip-ink/78 px-3 text-2xs font-medium text-ntrip-cloud/64 backdrop-blur-xl">
                    <span
                        className={cn(
                            'size-1.5 rounded-full',
                            realtimeActive ? 'bg-ntrip-teal' : 'bg-ntrip-amber',
                        )}
                    />
                    {realtimeActive ? 'Realtime' : 'Latest snapshot'}
                    {unassignedAutoSessions.length > 0 ? (
                        <>
                            <span className="h-3 w-px bg-ntrip-cloud/12" />
                            <span className="text-ntrip-amber">
                                {unassignedAutoSessions.length} AUTO waiting
                            </span>
                        </>
                    ) : null}
                </div>

                {visibleError ? (
                    <div className="pointer-events-auto absolute top-3 left-1/2 z-40 max-w-[min(32rem,calc(100%-7rem))] -translate-x-1/2 rounded-xl border border-ntrip-coral/25 bg-ntrip-ink/88 px-3 py-2 text-center text-micro font-medium text-ntrip-coral shadow-ntrip-panel backdrop-blur-xl">
                        {visibleError}
                    </div>
                ) : null}

                <StatisticsDock
                    statistics={statistics}
                    operationsCollapsed={operationsCollapsed}
                />

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

function StatisticsDock({
    statistics,
    operationsCollapsed,
}: {
    statistics: {
        total: number;
        online: number;
        waiting: number;
        accounts: number;
    };
    operationsCollapsed: boolean;
}) {
    return (
        <div
            className={cn(
                'pointer-events-auto absolute bottom-3 z-20 hidden grid-cols-4 gap-1.5 transition-[left] duration-200 sm:grid',
                operationsCollapsed ? 'left-[4.75rem]' : 'left-[21.75rem]',
            )}
        >
            <Metric label="Total" value={statistics.total} />
            <Metric label="Online" value={statistics.online} tone="teal" />
            <Metric label="Waiting" value={statistics.waiting} tone="amber" />
            <Metric label="Accounts" value={statistics.accounts} />
        </div>
    );
}

function Metric({
    label,
    value,
    tone = 'ink',
}: {
    label: string;
    value: number;
    tone?: 'ink' | 'teal' | 'amber';
}) {
    return (
        <div className="min-w-16 rounded-xl border border-white/42 bg-ntrip-cloud/78 px-2.5 py-2 shadow-ntrip-panel-soft backdrop-blur-xl">
            <p className="text-[8px] font-semibold tracking-[0.12em] text-ntrip-ink/36 uppercase">
                {label}
            </p>
            <p
                className={cn(
                    'mt-0.5 text-sm font-semibold tabular-nums',
                    tone === 'teal' && 'text-ntrip-teal',
                    tone === 'amber' && 'text-ntrip-amber',
                )}
            >
                {value}
            </p>
        </div>
    );
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

    return (
        <aside className="pointer-events-auto absolute right-3 bottom-14 z-30 max-h-[42vh] w-[min(18rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-ntrip-cloud/12 bg-ntrip-ink/90 p-3 text-ntrip-cloud shadow-ntrip-topology-panel backdrop-blur-2xl">
            <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ntrip-teal/13 text-ntrip-teal">
                    <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-semibold tracking-[0.12em] text-ntrip-cloud/36 uppercase">
                        {entity.kind}
                    </p>
                    <h2 className="mt-0.5 truncate text-xs font-semibold">
                        {'name' in entity ? entity.name : entity.label}
                    </h2>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="size-7 rounded-lg text-ntrip-cloud/42 hover:bg-ntrip-cloud/8 hover:text-ntrip-cloud"
                    aria-label="Close topology details"
                >
                    <X className="size-3.5" />
                </Button>
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-ntrip-cloud/8 pt-3 text-2xs">
                {Object.entries(entity)
                    .filter(
                        ([key]) =>
                            !['kind', 'entityId', 'name', 'label'].includes(
                                key,
                            ),
                    )
                    .map(([key, value]) => (
                        <div
                            key={key}
                            className="flex items-start justify-between gap-3"
                        >
                            <dt className="text-ntrip-cloud/38 capitalize">
                                {key.replace(/([A-Z])/g, ' $1')}
                            </dt>
                            <dd className="max-w-[58%] text-right font-medium text-ntrip-cloud/72">
                                {typeof value === 'boolean'
                                    ? value
                                        ? 'Yes'
                                        : 'No'
                                    : String(value ?? '—')}
                            </dd>
                        </div>
                    ))}
            </dl>
        </aside>
    );
}
