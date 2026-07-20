import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Trash2,
    Activity,
    ArrowLeft,
    Clock3,
    Cpu,
    Database,
    ExternalLink,
    Gauge,
    KeyRound,
    MapPin,
    RadioTower,
    RefreshCw,
    Router,
    Satellite,
    Server,
    ShieldCheck,
    Thermometer,
    Users,
    Wifi,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type SyntheticEvent,
} from 'react';

import { StatusPill } from '@/components/map-dashboard/status-pill';
import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';
import type { DashboardStation, StationHealth } from '@/types/ntrip-dashboard';

type JsonObject = Record<string, unknown>;

type StationTab = 'overview' | 'telemetry' | 'configuration' | 'mountpoint';

type StationDetail = {
    id: string | number;
    name: string;
    deviceId: string;
    enabled: boolean;
    sourceConnected: boolean;
    lastSeenAt: string | null;
    lastIp: string | null;
    firmwareVersion: string | null;
    health: StationHealth;

    configuration: {
        revision: number | null;
        casterHost: string | null;
        casterPort: number | null;
        uartBaud: number | null;
        telemetryIntervalMs: number | null;
        configPollIntervalMs: number | null;
        maxRtcmAgeMs: number | null;
    };

    mountpoint: {
        id: string | number | null;
        name: string | null;
        identifier: string | null;
        format: string | null;
        formatDetails: string | null;
        navSystem: string | null;
        latitude: number | null;
        longitude: number | null;
        country: string | null;
        enabled: boolean | null;
        roverUsername: string | null;
    };

    telemetry: {
        networkType: string | null;
        ipAddress: string | null;
        temperatureC: number | null;
        freeHeapBytes: number | null;
        uploadBps: number | null;
        rtcmAgeMs: number | null;
        validRtcmFrames: number | null;
        rtcmCrcErrors: number | null;
        queueDrops: number | null;
        staleDrops: number | null;
        reconnectCount: number | null;
        uptimeSeconds: number | null;
        surveyActive: boolean | null;
        surveyValid: boolean | null;
    };
};

type StationDetailPageProps = {
    stationId: string | number;
};

const TABS: Array<{
    value: StationTab;
    label: string;
}> = [
    {
        value: 'overview',
        label: 'Overview',
    },
    {
        value: 'telemetry',
        label: 'Telemetry',
    },
    {
        value: 'configuration',
        label: 'Configuration',
    },
    {
        value: 'mountpoint',
        label: 'Mountpoint',
    },
];

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function asObject(value: unknown): JsonObject | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as JsonObject;
    }

    return null;
}

function readString(
    source: JsonObject | null,
    ...keys: string[]
): string | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }

        if (typeof value === 'number') {
            return String(value);
        }
    }

    return null;
}

function readNumber(
    source: JsonObject | null,
    ...keys: string[]
): number | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = Number(value);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return null;
}

function readBoolean(
    source: JsonObject | null,
    ...keys: string[]
): boolean | null {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        const value = source[key];

        if (typeof value === 'boolean') {
            return value;
        }

        if (value === 1 || value === '1') {
            return true;
        }

        if (value === 0 || value === '0') {
            return false;
        }
    }

    return null;
}

function unwrapResponse(payload: unknown): JsonObject {
    const envelope = asObject(payload);

    if (!envelope) {
        return {};
    }

    const data = asObject(envelope.data);
    const station = asObject(envelope.station);

    if (data) {
        return asObject(data.station) ?? data;
    }

    return station ?? envelope;
}

function deriveHealth(
    enabled: boolean,
    sourceConnected: boolean,
    fallback?: DashboardStation,
): StationHealth {
    if (!enabled) {
        return 'offline';
    }

    if (fallback) {
        return fallback.health;
    }

    return sourceConnected ? 'healthy' : 'warning';
}

function normalizeStation(
    payload: unknown,
    fallback?: DashboardStation,
): StationDetail {
    const station = unwrapResponse(payload);

    const configuration =
        asObject(station.config) ??
        asObject(station.station_config) ??
        asObject(station.stationConfig);

    const mountpoint = asObject(station.mountpoint);

    const telemetryContainer = asObject(station.telemetry);

    const telemetry =
        asObject(telemetryContainer?.payload) ?? telemetryContainer ?? {};

    const id = readString(station, 'id') ?? fallback?.id ?? '';

    const enabled = readBoolean(station, 'enabled') ?? true;

    const sourceConnected =
        readBoolean(station, 'source_connected', 'sourceConnected') ?? false;

    return {
        id,
        name:
            readString(station, 'name') ?? fallback?.name ?? 'Unknown station',

        deviceId:
            readString(station, 'device_id', 'deviceId') ??
            fallback?.deviceId ??
            'Unknown',

        enabled,
        sourceConnected,

        lastSeenAt:
            readString(station, 'last_seen_at', 'lastSeenAt') ??
            fallback?.lastSeenAt ??
            null,

        lastIp:
            readString(station, 'last_ip', 'lastIp') ??
            fallback?.ipAddress ??
            null,

        firmwareVersion: readString(
            station,
            'firmware_version',
            'firmwareVersion',
        ),

        health: deriveHealth(enabled, sourceConnected, fallback),

        configuration: {
            revision: readNumber(configuration, 'revision'),

            casterHost: readString(configuration, 'caster_host', 'casterHost'),

            casterPort: readNumber(configuration, 'caster_port', 'casterPort'),

            uartBaud: readNumber(configuration, 'uart_baud', 'uartBaud'),

            telemetryIntervalMs: readNumber(
                configuration,
                'telemetry_interval_ms',
                'telemetryIntervalMs',
            ),

            configPollIntervalMs: readNumber(
                configuration,
                'config_poll_interval_ms',
                'configPollIntervalMs',
            ),

            maxRtcmAgeMs: readNumber(
                configuration,
                'max_rtcm_age_ms',
                'maxRtcmAgeMs',
            ),
        },

        mountpoint: {
            id: readString(mountpoint, 'id'),

            name:
                readString(mountpoint, 'name') ?? fallback?.mountpoint ?? null,

            identifier: readString(mountpoint, 'identifier'),

            format: readString(mountpoint, 'format'),

            formatDetails: readString(
                mountpoint,
                'format_details',
                'formatDetails',
            ),

            navSystem: readString(mountpoint, 'nav_system', 'navSystem'),

            latitude:
                readNumber(mountpoint, 'lat', 'latitude') ??
                fallback?.latitude ??
                null,

            longitude:
                readNumber(mountpoint, 'lon', 'longitude') ??
                fallback?.longitude ??
                null,

            country: readString(mountpoint, 'country'),

            enabled: readBoolean(mountpoint, 'enabled'),

            roverUsername: readString(
                mountpoint,
                'rover_username',
                'roverUsername',
            ),
        },

        telemetry: {
            networkType:
                readString(telemetry, 'network_type', 'networkType') ??
                fallback?.networkType ??
                null,

            ipAddress:
                readString(telemetry, 'ip_address', 'ipAddress', 'ip') ??
                fallback?.ipAddress ??
                null,

            temperatureC:
                readNumber(
                    telemetry,
                    'temperature_c',
                    'temperatureC',
                    'temperature',
                ) ??
                fallback?.temperatureC ??
                null,

            freeHeapBytes:
                readNumber(
                    telemetry,
                    'free_heap_bytes',
                    'freeHeapBytes',
                    'free_heap',
                ) ??
                fallback?.freeHeapBytes ??
                null,

            uploadBps:
                readNumber(telemetry, 'upload_bps', 'uploadBps', 'rtcm_bps') ??
                fallback?.uploadBps ??
                null,

            rtcmAgeMs:
                readNumber(telemetry, 'rtcm_age_ms', 'rtcmAgeMs') ??
                fallback?.rtcmAgeMs ??
                null,

            validRtcmFrames: readNumber(
                telemetry,
                'valid_rtcm_frames',
                'validRtcmFrames',
            ),

            rtcmCrcErrors: readNumber(
                telemetry,
                'rtcm_crc_errors',
                'rtcmCrcErrors',
                'crc_errors',
            ),

            queueDrops: readNumber(telemetry, 'queue_drops', 'queueDrops'),

            staleDrops: readNumber(telemetry, 'stale_drops', 'staleDrops'),

            reconnectCount: readNumber(
                telemetry,
                'reconnect_count',
                'reconnectCount',
            ),

            uptimeSeconds: readNumber(
                telemetry,
                'uptime_seconds',
                'uptimeSeconds',
                'uptime',
            ),

            surveyActive: readBoolean(
                telemetry,
                'survey_active',
                'survey_in_active',
                'surveyActive',
            ),

            surveyValid: readBoolean(
                telemetry,
                'survey_valid',
                'survey_in_valid',
                'surveyValid',
            ),
        },
    };
}

function formatDate(value: string | null): string {
    if (!value) {
        return 'No telemetry';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
}

function formatNumber(value: number | null, unit = ''): string {
    if (value === null) {
        return '—';
    }

    return `${new Intl.NumberFormat('en-US').format(value)}${unit}`;
}

function formatBytes(value: number | null): string {
    if (value === null) {
        return '—';
    }

    if (value >= 1_048_576) {
        return `${(value / 1_048_576).toFixed(1)} MB`;
    }

    if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${value} B`;
}

function formatDuration(seconds: number | null): string {
    if (seconds === null) {
        return '—';
    }

    const days = Math.floor(seconds / 86_400);

    const hours = Math.floor((seconds % 86_400) / 3600);

    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function surveyStatus(active: boolean | null, valid: boolean | null): string {
    if (active === true) {
        return 'Surveying';
    }

    if (valid === true) {
        return 'Valid';
    }

    if (valid === false) {
        return 'Invalid';
    }

    return 'Unknown';
}

function DataRow({
    label,
    value,
    icon,
}: {
    label: string;
    value: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-ntrip-ink/7 py-3 last:border-b-0">
            <dt className="flex min-w-0 items-center gap-2 text-xs text-ntrip-ink/50">
                {icon}
                {label}
            </dt>

            <dd className="max-w-[65%] text-right text-caption font-semibold break-words text-ntrip-ink">
                {value}
            </dd>
        </div>
    );
}

function MetricCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: ReactNode;
    hint: string;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-ntrip-cloud/60 p-4 shadow-ntrip-inset">
            <div className="flex items-start justify-between gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-ntrip-teal/13 text-ntrip-teal">
                    {icon}
                </span>

                <span className="text-micro text-ntrip-ink/62">{hint}</span>
            </div>

            <p className="mt-4 text-xs text-ntrip-ink/48">{label}</p>

            <p className="mt-1 text-title font-semibold tracking-[-0.035em] tabular-nums">
                {value}
            </p>
        </div>
    );
}

export default function StationShow({ stationId }: StationDetailPageProps) {
    const { stations, selectedStationId, setSelectedStationId, mapRef } =
        useMapDashboard();

    const [activeTab, setActiveTab] = useState<StationTab>('overview');

    const [detail, setDetail] = useState<StationDetail | null>(null);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const [deleting, setDeleting] = useState(false);

    const [deleteError, setDeleteError] = useState<string | null>(null);

    const routeStation = useMemo(
        () =>
            stations.find(
                (station) => String(station.id) === String(stationId),
            ),
        [stationId, stations],
    );
    const routeStationRef = useRef(routeStation);

    useEffect(() => {
        routeStationRef.current = routeStation;
    }, [routeStation]);

    useEffect(() => {
        if (String(selectedStationId) === String(stationId)) {
            return;
        }

        setSelectedStationId(stationId as DashboardStation['id']);

        const animationFrameId = window.requestAnimationFrame(() => {
            mapRef.current?.focusSelected();
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [mapRef, selectedStationId, setSelectedStationId, stationId]);

    const loadStation = useCallback(
        async (background = false, signal?: AbortSignal): Promise<void> => {
            if (background) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError(null);

            try {
                const response = await fetch(
                    `/api/v1/stations/${encodeURIComponent(String(stationId))}`,
                    {
                        signal,

                        credentials: 'same-origin',

                        headers: {
                            Accept: 'application/json',

                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                const body = (await response
                    .json()
                    .catch(() => null)) as unknown;

                if (!response.ok) {
                    const bodyObject = asObject(body);

                    throw new Error(
                        readString(bodyObject, 'message') ??
                            `Unable to load station. HTTP ${response.status}.`,
                    );
                }

                setDetail(normalizeStation(body, routeStationRef.current));
            } catch (requestError) {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Unable to load station.',
                );

                if (routeStationRef.current) {
                    setDetail(normalizeStation({}, routeStationRef.current));
                }
            } finally {
                if (!signal?.aborted) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [stationId],
    );

    async function deleteStation(): Promise<void> {
        if (!detail || deleting) {
            return;
        }

        setDeleting(true);
        setDeleteError(null);

        try {
            const response = await fetch(
                `/api/v1/stations/${encodeURIComponent(String(stationId))}`,
                {
                    method: 'DELETE',

                    credentials: 'same-origin',

                    headers: {
                        Accept: 'application/json',

                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            const responseBody = (await response
                .json()
                .catch(() => null)) as unknown;

            if (!response.ok) {
                const bodyObject = asObject(responseBody);

                throw new Error(
                    readString(bodyObject, 'message') ??
                        `Unable to delete station. HTTP ${response.status}.`,
                );
            }

            setSelectedStationId(null);
            setDeleteDialogOpen(false);

            router.visit('/stations', {
                replace: true,
            });
        } catch (requestError) {
            setDeleteError(
                requestError instanceof Error
                    ? requestError.message
                    : 'Unable to delete station.',
            );
        } finally {
            setDeleting(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();

        void loadStation(false, controller.signal);

        return () => {
            controller.abort();
        };
    }, [loadStation]);

    return (
        <>
            <Head title={detail?.name ?? 'Station Detail'} />

            <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 sm:gap-3 lg:gap-4">
                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className={cn('ntrip-glass-panel-dense', [
                        'pointer-events-auto',
                        'flex',
                        'min-h-16',
                        'items-center',
                        'justify-between',
                        'gap-4',
                        'rounded-3xl',
                        'px-4',
                        'py-3',
                        'sm:px-5',
                    ])}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="size-10 shrink-0 rounded-xl bg-ntrip-cloud/68"
                        >
                            <Link href="/stations">
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-ntrip-teal">
                                Station detail
                            </p>

                            <div className="flex min-w-0 items-center gap-2">
                                <h1 className="truncate text-[clamp(1.25rem,2vw,1.75rem)] font-semibold tracking-[-0.04em]">
                                    {detail?.name ??
                                        routeStation?.name ??
                                        'Loading station'}
                                </h1>

                                {detail ? (
                                    <StatusPill status={detail.health} />
                                ) : null}
                            </div>

                            <p className="mt-1 hidden truncate text-xs text-ntrip-ink/48 sm:block">
                                {detail?.deviceId ??
                                    routeStation?.deviceId ??
                                    `Station ${stationId}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Delete station"
                            title="Delete station"
                            disabled={!detail}
                            onClick={() => {
                                setDeleteError(null);
                                setDeleteDialogOpen(true);
                            }}
                            className={cn(
                                'size-10',
                                'rounded-xl',
                                'border-ntrip-coral/22',
                                'bg-ntrip-coral/8',
                                'text-ntrip-coral',
                                'hover:bg-ntrip-coral/14',
                                'hover:text-ntrip-coral',
                            )}
                        >
                            <Trash2 className="size-4" />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Refresh station"
                            title="Refresh station"
                            disabled={refreshing}
                            onClick={() => void loadStation(true)}
                            className="size-10 rounded-xl border-ntrip-ink/10 bg-ntrip-cloud/68"
                        >
                            <RefreshCw
                                className={cn(
                                    'size-4',
                                    refreshing && 'animate-spin',
                                )}
                            />
                        </Button>

                        <Button
                            asChild
                            className="h-10 rounded-xl bg-ntrip-ink px-4 text-caption text-ntrip-cloud"
                        >
                            <Link href={`/stations/${stationId}/edit`}>
                                Edit station
                            </Link>
                        </Button>
                    </div>
                </section>

                <div className="flex min-h-0 justify-end">
                    <section
                        onPointerDown={stopMapEvent}
                        onDoubleClick={stopMapEvent}
                        onWheel={stopMapEvent}
                        className={cn('ntrip-glass-panel-dense', [
                            'pointer-events-auto',
                            'grid',
                            'h-full',
                            'min-h-0',
                            'w-full',
                            'grid-rows-[auto_auto_minmax(0,1fr)]',
                            'overflow-hidden',
                            'rounded-2xl',
                            'lg:max-w-184',
                        ])}
                    >
                        <div className="border-b border-ntrip-ink/8 px-4 py-4 sm:px-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs text-ntrip-ink/48">
                                        Base station
                                    </p>

                                    <h2 className="mt-1 truncate text-title font-semibold tracking-[-0.035em]">
                                        {detail?.name ??
                                            routeStation?.name ??
                                            'Station'}
                                    </h2>

                                    <p className="mt-1 truncate text-xs text-ntrip-ink/48">
                                        {detail?.deviceId ??
                                            routeStation?.deviceId ??
                                            'Unknown device'}
                                        {' · '}
                                        {detail?.mountpoint.name ??
                                            routeStation?.mountpoint ??
                                            'No mountpoint'}
                                    </p>
                                </div>

                                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ntrip-teal/13 text-ntrip-teal">
                                    <RadioTower className="size-5" />
                                </span>
                            </div>

                            {error ? (
                                <div className="ntrip-alert-critical mt-4 rounded-2xl border px-4 py-3 text-xs font-medium text-ntrip-coral">
                                    {error}
                                </div>
                            ) : null}
                        </div>

                        <nav className="flex gap-1 overflow-x-auto border-b border-ntrip-ink/8 px-3 py-2">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setActiveTab(tab.value)}
                                    className={cn(
                                        [
                                            'h-9',
                                            'shrink-0',
                                            'rounded-xl',
                                            'px-3',
                                            'text-xs',
                                            'font-semibold',
                                            'transition',
                                        ],
                                        activeTab === tab.value
                                            ? 'bg-ntrip-cloud/94 shadow-ntrip-inset-control'
                                            : 'text-ntrip-ink/48 hover:bg-ntrip-cloud/58',
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>

                        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
                            {loading && !detail ? (
                                <div className="grid min-h-72 place-items-center">
                                    <div className="text-center">
                                        <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />

                                        <p className="mt-3 text-caption font-semibold">
                                            Loading station
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {detail && activeTab === 'overview' ? (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <MetricCard
                                            label="Source"
                                            value={
                                                detail.sourceConnected
                                                    ? 'Connected'
                                                    : 'Offline'
                                            }
                                            hint="Caster state"
                                            icon={
                                                <Activity className="size-4" />
                                            }
                                        />

                                        <MetricCard
                                            label="RTCM traffic"
                                            value={formatNumber(
                                                detail.telemetry.uploadBps,
                                                ' bps',
                                            )}
                                            hint="Current upload"
                                            icon={
                                                <Satellite className="size-4" />
                                            }
                                        />

                                        <MetricCard
                                            label="Connected Rovers"
                                            value={
                                                routeStation?.activeRovers ?? 0
                                            }
                                            hint="Active clients"
                                            icon={<Users className="size-4" />}
                                        />

                                        <MetricCard
                                            label="Survey"
                                            value={surveyStatus(
                                                detail.telemetry.surveyActive,
                                                detail.telemetry.surveyValid,
                                            )}
                                            hint="GNSS reference"
                                            icon={
                                                <ShieldCheck className="size-4" />
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <section className="ntrip-section rounded-card p-4">
                                            <h3 className="text-sm font-semibold">
                                                Station
                                            </h3>

                                            <dl className="mt-2">
                                                <DataRow
                                                    label="Device ID"
                                                    value={detail.deviceId}
                                                    icon={
                                                        <Cpu className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="Enabled"
                                                    value={
                                                        detail.enabled
                                                            ? 'Yes'
                                                            : 'No'
                                                    }
                                                    icon={
                                                        <ShieldCheck className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="Firmware"
                                                    value={
                                                        detail.firmwareVersion ??
                                                        'Unknown'
                                                    }
                                                    icon={
                                                        <Database className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="Last seen"
                                                    value={formatDate(
                                                        detail.lastSeenAt,
                                                    )}
                                                    icon={
                                                        <Clock3 className="size-3.5" />
                                                    }
                                                />
                                            </dl>
                                        </section>

                                        <section className="ntrip-section rounded-card p-4">
                                            <h3 className="text-sm font-semibold">
                                                Network
                                            </h3>

                                            <dl className="mt-2">
                                                <DataRow
                                                    label="Connection"
                                                    value={
                                                        detail.telemetry
                                                            .networkType ??
                                                        'Unknown'
                                                    }
                                                    icon={
                                                        <Wifi className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="IP address"
                                                    value={
                                                        detail.telemetry
                                                            .ipAddress ??
                                                        detail.lastIp ??
                                                        'Unknown'
                                                    }
                                                    icon={
                                                        <Router className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="Temperature"
                                                    value={formatNumber(
                                                        detail.telemetry
                                                            .temperatureC,
                                                        ' °C',
                                                    )}
                                                    icon={
                                                        <Thermometer className="size-3.5" />
                                                    }
                                                />

                                                <DataRow
                                                    label="Free heap"
                                                    value={formatBytes(
                                                        detail.telemetry
                                                            .freeHeapBytes,
                                                    )}
                                                    icon={
                                                        <Database className="size-3.5" />
                                                    }
                                                />
                                            </dl>
                                        </section>
                                    </div>
                                </div>
                            ) : null}

                            {detail && activeTab === 'telemetry' ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <section className="ntrip-section rounded-card p-4">
                                        <h3 className="text-sm font-semibold">
                                            RTCM stream
                                        </h3>

                                        <dl className="mt-2">
                                            <DataRow
                                                label="Upload rate"
                                                value={formatNumber(
                                                    detail.telemetry.uploadBps,
                                                    ' bps',
                                                )}
                                            />

                                            <DataRow
                                                label="RTCM age"
                                                value={formatNumber(
                                                    detail.telemetry.rtcmAgeMs,
                                                    ' ms',
                                                )}
                                            />

                                            <DataRow
                                                label="Valid frames"
                                                value={formatNumber(
                                                    detail.telemetry
                                                        .validRtcmFrames,
                                                )}
                                            />

                                            <DataRow
                                                label="CRC errors"
                                                value={formatNumber(
                                                    detail.telemetry
                                                        .rtcmCrcErrors,
                                                )}
                                            />
                                        </dl>
                                    </section>

                                    <section className="ntrip-section rounded-card p-4">
                                        <h3 className="text-sm font-semibold">
                                            Runtime
                                        </h3>

                                        <dl className="mt-2">
                                            <DataRow
                                                label="Queue drops"
                                                value={formatNumber(
                                                    detail.telemetry.queueDrops,
                                                )}
                                            />

                                            <DataRow
                                                label="Stale drops"
                                                value={formatNumber(
                                                    detail.telemetry.staleDrops,
                                                )}
                                            />

                                            <DataRow
                                                label="Reconnects"
                                                value={formatNumber(
                                                    detail.telemetry
                                                        .reconnectCount,
                                                )}
                                            />

                                            <DataRow
                                                label="Uptime"
                                                value={formatDuration(
                                                    detail.telemetry
                                                        .uptimeSeconds,
                                                )}
                                            />
                                        </dl>
                                    </section>
                                </div>
                            ) : null}

                            {detail && activeTab === 'configuration' ? (
                                <section className="ntrip-section rounded-card p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="text-sm font-semibold">
                                            Runtime configuration
                                        </h3>

                                        <Server className="size-4 text-ntrip-teal" />
                                    </div>

                                    <dl className="mt-2">
                                        <DataRow
                                            label="Revision"
                                            value={formatNumber(
                                                detail.configuration.revision,
                                            )}
                                        />

                                        <DataRow
                                            label="Caster host"
                                            value={
                                                detail.configuration
                                                    .casterHost ?? '—'
                                            }
                                        />

                                        <DataRow
                                            label="Caster port"
                                            value={formatNumber(
                                                detail.configuration.casterPort,
                                            )}
                                        />

                                        <DataRow
                                            label="UART baud"
                                            value={formatNumber(
                                                detail.configuration.uartBaud,
                                            )}
                                        />

                                        <DataRow
                                            label="Telemetry interval"
                                            value={formatNumber(
                                                detail.configuration
                                                    .telemetryIntervalMs,
                                                ' ms',
                                            )}
                                        />

                                        <DataRow
                                            label="Config poll interval"
                                            value={formatNumber(
                                                detail.configuration
                                                    .configPollIntervalMs,
                                                ' ms',
                                            )}
                                        />

                                        <DataRow
                                            label="Maximum RTCM age"
                                            value={formatNumber(
                                                detail.configuration
                                                    .maxRtcmAgeMs,
                                                ' ms',
                                            )}
                                        />
                                    </dl>
                                </section>
                            ) : null}

                            {detail && activeTab === 'mountpoint' ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <section className="ntrip-section rounded-card p-4">
                                        <h3 className="text-sm font-semibold">
                                            Stream
                                        </h3>

                                        <dl className="mt-2">
                                            <DataRow
                                                label="Mountpoint"
                                                value={
                                                    detail.mountpoint.name ??
                                                    '—'
                                                }
                                                icon={
                                                    <RadioTower className="size-3.5" />
                                                }
                                            />

                                            <DataRow
                                                label="Identifier"
                                                value={
                                                    detail.mountpoint
                                                        .identifier ?? '—'
                                                }
                                            />

                                            <DataRow
                                                label="Format"
                                                value={
                                                    detail.mountpoint.format ??
                                                    '—'
                                                }
                                            />

                                            <DataRow
                                                label="Navigation"
                                                value={
                                                    detail.mountpoint
                                                        .navSystem ?? '—'
                                                }
                                            />

                                            <DataRow
                                                label="Enabled"
                                                value={
                                                    detail.mountpoint
                                                        .enabled === true
                                                        ? 'Yes'
                                                        : detail.mountpoint
                                                                .enabled ===
                                                            false
                                                          ? 'No'
                                                          : 'Unknown'
                                                }
                                            />
                                        </dl>
                                    </section>

                                    <section className="ntrip-section rounded-card p-4">
                                        <h3 className="text-sm font-semibold">
                                            Reference position
                                        </h3>

                                        <dl className="mt-2">
                                            <DataRow
                                                label="Latitude"
                                                value={formatNumber(
                                                    detail.mountpoint.latitude,
                                                )}
                                                icon={
                                                    <MapPin className="size-3.5" />
                                                }
                                            />

                                            <DataRow
                                                label="Longitude"
                                                value={formatNumber(
                                                    detail.mountpoint.longitude,
                                                )}
                                                icon={
                                                    <MapPin className="size-3.5" />
                                                }
                                            />

                                            <DataRow
                                                label="Country"
                                                value={
                                                    detail.mountpoint.country ??
                                                    '—'
                                                }
                                            />

                                            <DataRow
                                                label="Rover username"
                                                value={
                                                    detail.mountpoint
                                                        .roverUsername ??
                                                    'No authentication'
                                                }
                                                icon={
                                                    <KeyRound className="size-3.5" />
                                                }
                                            />
                                        </dl>

                                        {detail.mountpoint.name ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="mt-4 h-10 w-full rounded-xl border-ntrip-ink/10 bg-ntrip-cloud/66"
                                                onClick={() => {
                                                    void navigator.clipboard.writeText(
                                                        `${window.location.hostname}:2101/${detail.mountpoint.name}`,
                                                    );
                                                }}
                                            >
                                                <ExternalLink className="size-4" />
                                                Copy connection
                                            </Button>
                                        ) : null}
                                    </section>

                                    {detail.mountpoint.formatDetails ? (
                                        <section className="ntrip-section rounded-card p-4 md:col-span-2">
                                            <h3 className="text-sm font-semibold">
                                                RTCM format details
                                            </h3>

                                            <p className="mt-3 font-mono text-xs leading-5 break-words text-ntrip-ink/62">
                                                {
                                                    detail.mountpoint
                                                        .formatDetails
                                                }
                                            </p>
                                        </section>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </section>
                </div>
            </div>

            {deleteDialogOpen && detail ? (
                <div
                    role="presentation"
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setDeleteDialogOpen(false);
                            setDeleteError(null);
                        }
                    }}
                    className={cn(
                        'pointer-events-auto',
                        'fixed',
                        'inset-0',
                        'z-[100]',
                        'grid',
                        'place-items-center',
                        'bg-ntrip-ink/30',
                        'p-4',
                        'backdrop-blur-sm',
                    )}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-station-title"
                        aria-describedby="delete-station-description"
                        className={cn(
                            'ntrip-glass-panel-dense',
                            'w-full',
                            'max-w-md',
                            'rounded-3xl',
                            'p-5',
                            'sm:p-6',
                        )}
                    >
                        <div className="flex items-start gap-4">
                            <span
                                className={cn(
                                    'grid',
                                    'size-11',
                                    'shrink-0',
                                    'place-items-center',
                                    'rounded-2xl',
                                    'bg-ntrip-coral/12',
                                    'text-ntrip-coral',
                                )}
                            >
                                <AlertTriangle className="size-5" />
                            </span>

                            <div className="min-w-0">
                                <p
                                    className={cn(
                                        'text-micro',
                                        'font-semibold',
                                        'uppercase',
                                        'tracking-[0.08em]',
                                        'text-ntrip-coral',
                                    )}
                                >
                                    Destructive action
                                </p>

                                <h2
                                    id="delete-station-title"
                                    className={cn(
                                        'mt-1',
                                        'text-title',
                                        'font-semibold',
                                        'tracking-[-0.035em]',
                                        'text-ntrip-ink',
                                    )}
                                >
                                    Delete station?
                                </h2>

                                <p
                                    id="delete-station-description"
                                    className={cn(
                                        'mt-2',
                                        'text-caption',
                                        'leading-5',
                                        'text-ntrip-ink/52',
                                    )}
                                >
                                    This action will permanently delete the
                                    station and its associated configuration.
                                </p>
                            </div>
                        </div>

                        <div
                            className={cn(
                                'mt-5',
                                'rounded-2xl',
                                'bg-ntrip-cloud/62',
                                'p-4',
                                'shadow-ntrip-inset',
                            )}
                        >
                            <p
                                className={cn(
                                    'truncate',
                                    'text-sm',
                                    'font-semibold',
                                    'text-ntrip-ink',
                                )}
                            >
                                {detail.name}
                            </p>

                            <p
                                className={cn(
                                    'mt-1',
                                    'truncate',
                                    'font-mono',
                                    'text-micro',
                                    'text-ntrip-ink/46',
                                )}
                            >
                                {detail.deviceId}
                            </p>

                            {detail.mountpoint.name ? (
                                <p
                                    className={cn(
                                        'mt-1',
                                        'truncate',
                                        'text-micro',
                                        'text-ntrip-ink/46',
                                    )}
                                >
                                    Mountpoint: {detail.mountpoint.name}
                                </p>
                            ) : null}
                        </div>

                        <div
                            className={cn(
                                'mt-4',
                                'rounded-xl',
                                'bg-ntrip-amber/14',
                                'px-3',
                                'py-2.5',
                                'text-micro',
                                'leading-4',
                                'text-ntrip-ink/68',
                            )}
                        >
                            Connected devices using this station will no longer
                            be able to obtain configuration or publish RTCM
                            data.
                        </div>

                        {deleteError ? (
                            <div
                                className={cn(
                                    'mt-4',
                                    'rounded-xl',
                                    'border',
                                    'border-ntrip-coral/26',
                                    'bg-ntrip-coral/10',
                                    'px-3',
                                    'py-2.5',
                                    'text-xs',
                                    'font-medium',
                                    'text-ntrip-coral',
                                )}
                            >
                                {deleteError}
                            </div>
                        ) : null}

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={deleting}
                                onClick={() => {
                                    setDeleteDialogOpen(false);
                                    setDeleteError(null);
                                }}
                                className={cn(
                                    'h-10',
                                    'flex-1',
                                    'rounded-xl',
                                    'border-ntrip-ink/10',
                                    'bg-ntrip-cloud/70',
                                )}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                disabled={deleting}
                                onClick={() => {
                                    void deleteStation();
                                }}
                                className={cn(
                                    'h-10',
                                    'flex-1',
                                    'rounded-xl',
                                    'bg-ntrip-coral',
                                    'text-ntrip-cloud',
                                    'hover:bg-ntrip-coral/90',
                                )}
                            >
                                {deleting ? (
                                    <RefreshCw className="size-4 animate-spin" />
                                ) : (
                                    <Trash2 className="size-4" />
                                )}

                                {deleting ? 'Deleting...' : 'Delete station'}
                            </Button>
                        </div>
                    </section>
                </div>
            ) : null}
        </>
    );
}
