import '@xyflow/react/dist/style.css';

import { Head } from '@inertiajs/react';
import {
    CircleUserRound,
    ListFilter,
    Network,
    RadioTower,
    RefreshCw,
    Search,
    Server,
    Wifi,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type SyntheticEvent,
} from 'react';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { MountpointDirectoryPanel } from './components/mountpoint-directory-panel';

import {
    MountpointTopologyPanel,
    type SelectedTopologyEntity,
} from './components/mountpoint-topology-panel';
import { MountpointUsersPanel } from './components/mountpoint-users-panel';

import {
    attachSessions,
    buildRoverAccounts,
    normalizeMountpoints,
} from './lib/mountpoint-data';

import {
    mapDashboardSessionsToActiveSessions,
    mergeRealtimeStationsIntoMountpoints,
} from './lib/mountpoint-realtime';

import type { MountpointRecord, MountpointStatus } from './types';

type PageTab = 'topology' | 'mountpoints' | 'users';
type StatusFilter = 'all' | MountpointStatus;
type JsonObject = Record<string, unknown>;

const TAB_ITEMS: Array<{
    id: PageTab;
    label: string;
    icon: LucideIcon;
}> = [
    { id: 'topology', label: 'Topology', icon: Network },
    { id: 'mountpoints', label: 'Mountpoints', icon: RadioTower },
    { id: 'users', label: 'Users', icon: CircleUserRound },
];

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

export default function MountpointsIndex() {
    const {
        stations: realtimeStations,
        activeSessionItems,
        refresh: refreshDashboard,
        isRefreshing: dashboardRefreshing,
        error: dashboardError,
        realtimeConnectionState,
    } = useMapDashboard();

    const [activeTab, setActiveTab] = useState<PageTab>('topology');
    const [mountpoints, setMountpoints] = useState<MountpointRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedEntity, setSelectedEntity] =
        useState<SelectedTopologyEntity>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [mountpointError, setMountpointError] = useState<string | null>(null);

    const loadData = useCallback(
        async (background = false, signal?: AbortSignal): Promise<void> => {
            if (background) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setMountpointError(null);

            try {
                /*
                 * Chỉ tải metadata Mountpoint.
                 *
                 * Active session và Station runtime
                 * đã được quản lý bởi MapDashboardContext.
                 */
                const payload = await fetchJson('/api/v1/mountpoints', signal);

                if (signal?.aborted) {
                    return;
                }

                setMountpoints(normalizeMountpoints(payload));
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
                    setRefreshing(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        const controller = new AbortController();

        void loadData(false, controller.signal);

        return () => {
            controller.abort();
        };
    }, [loadData]);

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

    const filteredMountpoints = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return enrichedMountpoints.filter((mountpoint) => {
            if (statusFilter !== 'all' && mountpoint.status !== statusFilter) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                mountpoint.name,
                mountpoint.identifier ?? '',
                mountpoint.format ?? '',
                mountpoint.navSystem ?? '',
                mountpoint.station?.name ?? '',
                mountpoint.station?.deviceId ?? '',
                mountpoint.roverUsername ?? '',
                ...mountpoint.sessions.map(
                    (session) =>
                        `${session.username ?? ''} ${session.remoteIp ?? ''}`,
                ),
            ].some((value) => value.toLowerCase().includes(query));
        });
    }, [enrichedMountpoints, searchQuery, statusFilter]);

    const accounts = useMemo(
        () => buildRoverAccounts(filteredMountpoints),
        [filteredMountpoints],
    );
    const realtimeActive = realtimeConnectionState === 'connected';
    const visibleError = mountpointError ?? dashboardError;

    const statistics = useMemo(
        () => ({
            total: enrichedMountpoints.length,
            online: enrichedMountpoints.filter(
                (mountpoint) => mountpoint.status === 'online',
            ).length,
            waiting: enrichedMountpoints.filter(
                (mountpoint) => mountpoint.status === 'waiting-source',
            ).length,
            rovers: enrichedMountpoints.reduce(
                (total, mountpoint) => total + mountpoint.roverCount,
                0,
            ),
        }),
        [enrichedMountpoints],
    );

    return (
        <>
            <Head title="Mountpoints" />

            <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:gap-4">
                <header
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className={cn(
                        'ntrip-glass-panel-strong',
                        'pointer-events-auto rounded-3xl px-4 py-3 sm:px-5',
                    )}
                >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-micro font-semibold text-ntrip-teal">
                                NTRIP network
                            </p>
                            <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.04em]">
                                Mountpoints
                            </h1>
                            <p className="mt-1 flex items-center gap-1.5 text-micro text-ntrip-ink/62">
                                <span className={cn('size-1.5 rounded-full',realtimeActive ? 'bg-ntrip-teal' : 'bg-ntrip-amber')}/>
                                {realtimeActive ? 'Topology updates in realtime' : 'Topology is using the latest snapshot'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="hidden items-center gap-1.5 lg:flex">
                                <Metric
                                    label="Total"
                                    value={statistics.total}
                                />
                                <Metric
                                    label="Online"
                                    value={statistics.online}
                                    tone="teal"
                                />
                                <Metric
                                    label="Waiting"
                                    value={statistics.waiting}
                                    tone="amber"
                                />
                                <Metric
                                    label="Rovers"
                                    value={statistics.rovers}
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className={cn(
                        'ntrip-glass-panel-strong',
                        'pointer-events-auto grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl',
                    )}
                >
                    <div className="border-b border-ntrip-ink/8 p-3 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <nav className="flex items-center gap-1 rounded-control border border-ntrip-ink/8 bg-ntrip-ink/[4.5%] p-1">
                                {TAB_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    const active = activeTab === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setActiveTab(item.id);
                                                setSelectedEntity(null);
                                            }}
                                            className={cn(
                                                'inline-flex h-9 items-center gap-2 rounded-control-xs px-3 text-sm font-semibold transition',
                                                active
                                                    ? 'bg-ntrip-cloud text-ntrip-ink shadow-ntrip-tab'
                                                    : 'text-ntrip-ink/44 hover:text-ntrip-ink',
                                            )}
                                        >
                                            <Icon className="size-3.5" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>

                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
                                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(event) => {
                                            setSearchQuery(event.target.value);
                                        }}
                                        placeholder="Search mountpoints, stations, rovers"
                                        className="h-9 rounded-control-sm border-ntrip-ink/9 bg-ntrip-cloud/72 pl-9 text-micro"
                                    />
                                </div>

                                <div className="relative">
                                    <ListFilter className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/34" />
                                    <select
                                        value={statusFilter}
                                        onChange={(event) => {
                                            setStatusFilter(
                                                event.target
                                                    .value as StatusFilter,
                                            );
                                        }}
                                        className="h-9 rounded-control-sm border border-ntrip-ink/9 bg-ntrip-cloud/72 pr-8 pl-9 text-micro font-semibold outline-none"
                                    >
                                        <option value="all">
                                            All statuses
                                        </option>
                                        <option value="online">Online</option>
                                        <option value="waiting-source">
                                            Waiting source
                                        </option>
                                        <option value="degraded">
                                            Degraded
                                        </option>
                                        <option value="disabled">
                                            Disabled
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {visibleError ? (
                            <div className="mt-3 rounded-xl border border-ntrip-coral/25 bg-ntrip-coral/10 px-3 py-2 text-micro font-medium text-ntrip-coral">
                                {visibleError}
                            </div>
                        ) : null}
                    </div>

                    <div className="relative min-h-0 overflow-auto p-3 sm:p-4">
                        {loading ? (
                            <div className="grid h-full min-h-72 place-items-center">
                                <div className="text-center">
                                    <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />
                                    <p className="mt-3 text-xs font-semibold">
                                        Loading mountpoint topology
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        {!loading ? (
                            <>
                                <div
                                    className={cn(
                                        'relative h-full min-h-136',
                                        activeTab !== 'topology' && 'hidden',
                                    )}
                                >
                                    <MountpointTopologyPanel
                                        mountpoints={filteredMountpoints}
                                        selectedEntity={selectedEntity}
                                        onSelectEntity={setSelectedEntity}
                                    />

                                    {selectedEntity ? (
                                        <TopologyInspector
                                            entity={selectedEntity}
                                            onClose={() => {
                                                setSelectedEntity(null);
                                            }}
                                        />
                                    ) : null}
                                </div>

                                <div
                                    className={cn(
                                        activeTab !== 'mountpoints' && 'hidden',
                                    )}
                                >
                                    <MountpointDirectoryPanel
                                        mountpoints={filteredMountpoints}
                                    />
                                </div>

                                <div
                                    className={cn(
                                        activeTab !== 'users' && 'hidden',
                                    )}
                                >
                                    <MountpointUsersPanel accounts={accounts} />
                                </div>
                            </>
                        ) : null}
                    </div>
                </section>
            </div>
        </>
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
        <div className="min-w-18 rounded-xl border border-ntrip-ink/7 bg-ntrip-cloud/68 px-3 py-2">
            <p className="text-3xs font-semibold tracking-[0.12em] text-ntrip-ink/36 uppercase">
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
        <aside className="absolute top-4 right-4 z-20 w-[min(21rem,calc(100%-2rem))] rounded-control-lg border border-ntrip-cloud/12 bg-ntrip-ink/92 p-4 text-ntrip-cloud shadow-ntrip-topology-panel backdrop-blur-2xl">
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-control-xs bg-ntrip-teal/13 text-ntrip-teal">
                    <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold tracking-[0.12em] text-ntrip-cloud/36 uppercase">
                        {entity.kind}
                    </p>
                    <h2 className="mt-1 truncate text-caption font-semibold">
                        {'name' in entity ? entity.name : entity.label}
                    </h2>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="size-8 rounded-control-2xs text-ntrip-cloud/42 hover:bg-ntrip-cloud/8 hover:text-ntrip-cloud"
                    aria-label="Close topology details"
                >
                    <X className="size-4" />
                </Button>
            </div>

            <dl className="mt-4 space-y-2 border-t border-ntrip-cloud/8 pt-4 text-micro">
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
                            className="flex items-start justify-between gap-4"
                        >
                            <dt className="text-ntrip-cloud/40 capitalize">
                                {key.replace(/([A-Z])/g, ' $1')}
                            </dt>
                            <dd className="max-w-[60%] text-right font-medium text-ntrip-cloud/76">
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
