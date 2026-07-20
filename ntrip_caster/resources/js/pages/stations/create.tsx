import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Copy,
    KeyRound,
    MapPin,
    RadioTower,
    RefreshCw,
    Save,
    Server,
    ShieldCheck,
    Wifi,
} from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
    type SyntheticEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';

type StationFormState = {
    deviceId: string;
    name: string;
    stationEnabled: boolean;
    sourceToken: string;

    casterHost: string;
    casterPort: string;
    uartBaud: string;
    telemetryIntervalMs: string;
    configPollIntervalMs: string;
    maxRtcmAgeMs: string;

    mountpointName: string;
    identifier: string;
    format: string;
    formatDetails: string;
    navSystem: string;
    latitude: string;
    longitude: string;
    country: string;
    mountpointEnabled: boolean;

    roverAuthEnabled: boolean;
    roverUsername: string;
    roverPassword: string;
};

type ValidationErrors = Record<string, string>;

type CreatedStation = {
    id: string | number | null;
    deviceId: string;
    name: string;
    sourceToken: string;
};

type ApiStation = {
    id?: string | number;
    device_id?: string;
    name?: string;
};

type CreateStationResponse = {
    id?: string | number;
    source_token?: string;
    token?: string;

    station?: ApiStation;

    data?: {
        id?: string | number;
        source_token?: string;
        token?: string;
        station?: ApiStation;
    };

    message?: string;
    errors?: Record<string, string[] | string>;
};

const INITIAL_FORM: StationFormState = {
    deviceId: '',
    name: '',
    stationEnabled: true,
    sourceToken: '',

    casterHost: '',
    casterPort: '2101',
    uartBaud: '115200',
    telemetryIntervalMs: '1000',
    configPollIntervalMs: '10000',
    maxRtcmAgeMs: '3000',

    mountpointName: '',
    identifier: '',
    format: 'RTCM 3.2',
    formatDetails: '1005(10),1074(1),1084(1),1094(1),1124(1),1230(10)',
    navSystem: 'GPS+GLO+GAL+BDS',
    latitude: '',
    longitude: '',
    country: 'VNM',
    mountpointEnabled: true,

    roverAuthEnabled: false,
    roverUsername: '',
    roverPassword: '',
};

function stopMapEvent(event: SyntheticEvent): void {
    event.stopPropagation();
}

function generateSourceToken(): string {
    if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
        return '';
    }

    const bytes = new Uint8Array(32);

    window.crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
}

function toNumber(value: string): number {
    return Number(value.trim());
}

function normalizeValidationErrors(
    errors: Record<string, string[] | string> | undefined,
): ValidationErrors {
    if (!errors) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [
            field,
            Array.isArray(messages)
                ? String(messages[0] ?? 'Invalid value.')
                : String(messages),
        ]),
    );
}

function Field({
    label,
    error,
    hint,
    required = false,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <label className="block min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-ntrip-ink/72">
                {label}

                {required ? <span className="text-ntrip-coral">*</span> : null}
            </span>

            <span className="mt-2 block">{children}</span>

            {error ? (
                <span className="mt-1.5 block text-micro font-medium text-ntrip-coral">
                    {error}
                </span>
            ) : hint ? (
                <span className="mt-1.5 block text-micro leading-4 text-ntrip-ink/62">
                    {hint}
                </span>
            ) : null}
        </label>
    );
}

function SectionHeader({
    icon,
    eyebrow,
    title,
    description,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-micro font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                    {eyebrow}
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
                    {title}
                </h2>

                <p className="mt-1 text-xs leading-5 text-ntrip-ink/48">
                    {description}
                </p>
            </div>

            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ntrip-teal/13 text-ntrip-teal">
                {icon}
            </span>
        </div>
    );
}

function ToggleField({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description: string;
}) {
    return (
        <label className="ntrip-section flex cursor-pointer items-start justify-between gap-4 rounded-2xl px-4 py-3">
            <span>
                <span className="block text-caption font-semibold">
                    {label}
                </span>

                <span className="mt-1 block text-micro leading-4 text-ntrip-ink/45">
                    {description}
                </span>
            </span>

            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-1 size-4 accent-ntrip-teal"
            />
        </label>
    );
}

export default function CreateStation() {
    const { stations } = useMapDashboard();

    const [form, setForm] = useState<StationFormState>(INITIAL_FORM);

    const [errors, setErrors] = useState<ValidationErrors>({});

    const [submitError, setSubmitError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const [copied, setCopied] = useState(false);

    const [createdStation, setCreatedStation] = useState<CreatedStation | null>(
        null,
    );
    const copyResetTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setForm((current) => ({
            ...current,

            casterHost: current.casterHost || window.location.hostname,

            sourceToken: current.sourceToken || generateSourceToken(),
        }));
    }, []);

    useEffect(() => {
        return () => {
            if (copyResetTimerRef.current !== null) {
                window.clearTimeout(copyResetTimerRef.current);
            }
        };
    }, []);

    function updateForm<Key extends keyof StationFormState>(
        key: Key,
        value: StationFormState[Key],
    ): void {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));

        setErrors((current) => {
            const next = { ...current };

            delete next[key];

            return next;
        });
    }

    function validateClient(): ValidationErrors {
        const nextErrors: ValidationErrors = {};

        if (!form.deviceId.trim()) {
            nextErrors.device_id = 'Device ID is required.';
        }

        if (
            stations.some(
                (station) =>
                    station.deviceId.toLowerCase() ===
                    form.deviceId.trim().toLowerCase(),
            )
        ) {
            nextErrors.device_id = 'This Device ID already exists.';
        }

        if (!form.name.trim()) {
            nextErrors.name = 'Station name is required.';
        }

        if (!form.sourceToken.trim()) {
            nextErrors.source_token = 'Source token is required.';
        }

        if (!form.casterHost.trim()) {
            nextErrors['config.caster_host'] = 'Caster host is required.';
        }

        if (
            !Number.isInteger(toNumber(form.casterPort)) ||
            toNumber(form.casterPort) < 1 ||
            toNumber(form.casterPort) > 65535
        ) {
            nextErrors['config.caster_port'] =
                'Caster port must be between 1 and 65535.';
        }

        if (!form.mountpointName.trim()) {
            nextErrors['mountpoint.name'] = 'Mountpoint name is required.';
        }

        if (
            stations.some(
                (station) =>
                    station.mountpoint.toLowerCase() ===
                    form.mountpointName.trim().toLowerCase(),
            )
        ) {
            nextErrors['mountpoint.name'] = 'This mountpoint already exists.';
        }

        const latitude = toNumber(form.latitude);

        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            nextErrors['mountpoint.lat'] =
                'Latitude must be between -90 and 90.';
        }

        const longitude = toNumber(form.longitude);

        if (
            !Number.isFinite(longitude) ||
            longitude < -180 ||
            longitude > 180
        ) {
            nextErrors['mountpoint.lon'] =
                'Longitude must be between -180 and 180.';
        }

        if (form.roverAuthEnabled && !form.roverUsername.trim()) {
            nextErrors['mountpoint.rover_username'] =
                'Rover username is required.';
        }

        if (form.roverAuthEnabled && form.roverPassword.length < 8) {
            nextErrors['mountpoint.rover_password'] =
                'Rover password must contain at least 8 characters.';
        }

        return nextErrors;
    }

    async function submitForm(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const clientErrors = validateClient();

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            setSubmitError('Please review the highlighted fields.');

            return;
        }

        setSubmitting(true);
        setErrors({});
        setSubmitError(null);

        const payload = {
            device_id: form.deviceId.trim(),

            name: form.name.trim(),

            enabled: form.stationEnabled,

            source_token: form.sourceToken.trim(),

            config: {
                caster_host: form.casterHost.trim(),

                caster_port: toNumber(form.casterPort),

                uart_baud: toNumber(form.uartBaud),

                telemetry_interval_ms: toNumber(form.telemetryIntervalMs),

                config_poll_interval_ms: toNumber(form.configPollIntervalMs),

                max_rtcm_age_ms: toNumber(form.maxRtcmAgeMs),
            },

            mountpoint: {
                name: form.mountpointName.trim().toUpperCase(),

                identifier: form.identifier.trim() || form.name.trim(),

                format: form.format.trim(),

                format_details: form.formatDetails.trim(),

                nav_system: form.navSystem.trim(),

                lat: toNumber(form.latitude),

                lon: toNumber(form.longitude),

                country: form.country.trim().toUpperCase(),

                enabled: form.mountpointEnabled,

                rover_username: form.roverAuthEnabled
                    ? form.roverUsername.trim()
                    : null,

                rover_password: form.roverAuthEnabled
                    ? form.roverPassword
                    : null,
            },
        };

        try {
            const response = await fetch('/api/v1/stations', {
                method: 'POST',

                credentials: 'same-origin',

                headers: {
                    Accept: 'application/json',

                    'Content-Type': 'application/json',

                    'X-Requested-With': 'XMLHttpRequest',
                },

                body: JSON.stringify(payload),
            });

            const responseBody = (await response
                .json()
                .catch(() => null)) as CreateStationResponse | null;

            if (!response.ok) {
                if (response.status === 422) {
                    setErrors(normalizeValidationErrors(responseBody?.errors));
                }

                setSubmitError(
                    responseBody?.message ??
                        `Unable to create station. HTTP ${response.status}.`,
                );

                return;
            }

            const station =
                responseBody?.station ?? responseBody?.data?.station;

            const stationId =
                station?.id ??
                responseBody?.data?.id ??
                responseBody?.id ??
                null;

            const returnedToken =
                responseBody?.source_token ??
                responseBody?.token ??
                responseBody?.data?.source_token ??
                responseBody?.data?.token ??
                form.sourceToken;

            setCreatedStation({
                id: stationId,
                deviceId: station?.device_id ?? form.deviceId.trim(),

                name: station?.name ?? form.name.trim(),

                sourceToken: returnedToken,
            });
        } catch (error) {
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : 'Unable to connect to the station API.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function copyToken(): Promise<void> {
        if (!createdStation) {
            return;
        }

        try {
            await navigator.clipboard.writeText(createdStation.sourceToken);

            setCopied(true);

            if (copyResetTimerRef.current !== null) {
                window.clearTimeout(copyResetTimerRef.current);
            }

            copyResetTimerRef.current = window.setTimeout(() => {
                setCopied(false);
                copyResetTimerRef.current = null;
            }, 1800);
        } catch {
            setCopied(false);
        }
    }

    if (createdStation) {
        return (
            <>
                <Head title="Station Created" />

                <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 sm:gap-3 lg:gap-4">
                    <section
                        onPointerDown={stopMapEvent}
                        className={cn(
                            'ntrip-glass-panel-dense',
                            'pointer-events-auto flex min-h-16 items-center justify-between rounded-3xl px-4 py-3 sm:px-5',
                        )}
                    >
                        <div>
                            <p className="text-xs font-semibold text-ntrip-teal">
                                Station created
                            </p>

                            <h1 className="mt-0.5 text-[clamp(1.25rem,2vw,1.75rem)] font-semibold tracking-[-0.04em]">
                                {createdStation.name}
                            </h1>
                        </div>

                        <span className="grid size-10 place-items-center rounded-2xl bg-ntrip-teal/13 text-ntrip-teal">
                            <Check className="size-5" />
                        </span>
                    </section>

                    <div className="flex min-h-0 items-center justify-center">
                        <section
                            onPointerDown={stopMapEvent}
                            onDoubleClick={stopMapEvent}
                            onWheel={stopMapEvent}
                            className={cn(
                                'ntrip-glass-panel-dense',
                                'pointer-events-auto w-full max-w-2xl rounded-2xl p-5 sm:p-6',
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ntrip-teal/13 text-ntrip-teal">
                                    <ShieldCheck className="size-5" />
                                </span>

                                <div>
                                    <h2 className="text-title font-semibold tracking-[-0.035em]">
                                        Save the Source Token
                                    </h2>

                                    <p className="mt-2 text-caption leading-5 text-ntrip-ink/52">
                                        The database only stores its hash. Copy
                                        this token now and configure it on the
                                        base station.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-2xl bg-ntrip-ink p-4 text-ntrip-cloud">
                                <p className="text-micro tracking-[0.08em] uppercase opacity-60">
                                    Source Token
                                </p>

                                <code className="mt-2 block text-caption leading-6 break-all">
                                    {createdStation.sourceToken}
                                </code>
                            </div>

                            <dl className="ntrip-section mt-5 grid gap-3 rounded-2xl p-4 text-caption sm:grid-cols-2">
                                <div>
                                    <dt className="text-micro text-ntrip-ink/45">
                                        Device ID
                                    </dt>

                                    <dd className="mt-1 font-semibold">
                                        {createdStation.deviceId}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-micro text-ntrip-ink/45">
                                        Station ID
                                    </dt>

                                    <dd className="mt-1 font-semibold">
                                        {createdStation.id ?? 'Created'}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    onClick={() => void copyToken()}
                                    className="h-10 flex-1 rounded-xl bg-ntrip-ink text-ntrip-cloud"
                                >
                                    {copied ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <Copy className="size-4" />
                                    )}

                                    {copied ? 'Copied' : 'Copy token'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.visit('/stations')}
                                    className="h-10 flex-1 rounded-xl border-ntrip-ink/12 bg-ntrip-cloud/72"
                                >
                                    Open Stations
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Create Station" />

            <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 sm:gap-3 lg:gap-4">
                <section
                    onPointerDown={stopMapEvent}
                    onDoubleClick={stopMapEvent}
                    onWheel={stopMapEvent}
                    className={cn(
                        'ntrip-glass-panel-dense',
                        'pointer-events-auto flex min-h-16 items-center justify-between gap-4 rounded-3xl px-4 py-3 sm:px-5',
                    )}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <Button
                            asChild
                            type="button"
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
                                Station management
                            </p>

                            <h1 className="truncate text-[clamp(1.25rem,2vw,1.75rem)] font-semibold tracking-[-0.04em]">
                                Create Station
                            </h1>
                        </div>
                    </div>

                    <div className="hidden items-center gap-2 text-xs font-semibold text-ntrip-ink/52 md:flex">
                        <RadioTower className="size-4 text-ntrip-teal" />
                        Station + Config + Mountpoint
                    </div>
                </section>

                <div className="flex min-h-0 justify-end">
                    <form
                        onSubmit={(event) => void submitForm(event)}
                        onPointerDown={stopMapEvent}
                        onDoubleClick={stopMapEvent}
                        onWheel={stopMapEvent}
                        className={cn(
                            'ntrip-glass-panel-dense',
                            'pointer-events-auto grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl xl:max-w-6xl',
                        )}
                    >
                        <div className="flex items-center justify-between border-b border-ntrip-ink/8 px-4 py-4 sm:px-5">
                            <div>
                                <p className="text-xs text-ntrip-ink/48">
                                    New NTRIP base station
                                </p>

                                <h2 className="mt-1 text-lg font-semibold">
                                    Configuration
                                </h2>
                            </div>

                            <span className="rounded-xl bg-ntrip-amber/20 px-3 py-2 text-micro font-semibold">
                                Required fields marked *
                            </span>
                        </div>

                        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
                            {submitError ? (
                                <div className="ntrip-alert-critical mb-4 rounded-2xl border px-4 py-3 text-xs font-medium text-ntrip-coral">
                                    {submitError}
                                </div>
                            ) : null}

                            <div className="grid gap-4 lg:grid-cols-2">
                                <section className="ntrip-section rounded-3xl p-4 sm:p-5 lg:col-span-2">
                                    <SectionHeader
                                        icon={<RadioTower className="size-4" />}
                                        eyebrow="Identity"
                                        title="Station information"
                                        description="Basic identity, runtime state and secure Source authentication."
                                    />

                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                        <Field
                                            label="Device ID"
                                            required
                                            error={errors.device_id}
                                            hint="Unique identifier used by the ESP32."
                                        >
                                            <Input
                                                value={form.deviceId}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'deviceId',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="CTUAV-BASE-004"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Station name"
                                            required
                                            error={errors.name}
                                        >
                                            <Input
                                                value={form.name}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'name',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="CTUAV Base Station 004"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Source Token"
                                            required
                                            error={errors.source_token}
                                            hint="Stored as a hash by Laravel."
                                        >
                                            <div className="flex gap-2">
                                                <Input
                                                    readOnly
                                                    value={form.sourceToken}
                                                    className="ntrip-input h-10 min-w-0 rounded-xl font-mono text-micro"
                                                />

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    title="Generate another token"
                                                    onClick={() =>
                                                        updateForm(
                                                            'sourceToken',
                                                            generateSourceToken(),
                                                        )
                                                    }
                                                    className="size-10 shrink-0 rounded-xl"
                                                >
                                                    <RefreshCw className="size-4" />
                                                </Button>
                                            </div>
                                        </Field>

                                        <ToggleField
                                            checked={form.stationEnabled}
                                            onChange={(checked) =>
                                                updateForm(
                                                    'stationEnabled',
                                                    checked,
                                                )
                                            }
                                            label="Station enabled"
                                            description="Allow config, telemetry and Source connections."
                                        />
                                    </div>
                                </section>

                                <section className="ntrip-section rounded-3xl p-4 sm:p-5">
                                    <SectionHeader
                                        icon={<Server className="size-4" />}
                                        eyebrow="Runtime"
                                        title="Station configuration"
                                        description="Caster connection and device update intervals."
                                    />

                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label="Caster host"
                                            required
                                            error={errors['config.caster_host']}
                                        >
                                            <Input
                                                value={form.casterHost}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'casterHost',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="192.168.1.10"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Caster port"
                                            required
                                            error={errors['config.caster_port']}
                                        >
                                            <Input
                                                type="number"
                                                value={form.casterPort}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'casterPort',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="UART baud">
                                            <Input
                                                type="number"
                                                value={form.uartBaud}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'uartBaud',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Telemetry interval">
                                            <Input
                                                type="number"
                                                value={form.telemetryIntervalMs}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'telemetryIntervalMs',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Config poll interval">
                                            <Input
                                                type="number"
                                                value={
                                                    form.configPollIntervalMs
                                                }
                                                onChange={(event) =>
                                                    updateForm(
                                                        'configPollIntervalMs',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Maximum RTCM age">
                                            <Input
                                                type="number"
                                                value={form.maxRtcmAgeMs}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'maxRtcmAgeMs',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>
                                    </div>
                                </section>

                                <section className="ntrip-section rounded-3xl p-4 sm:p-5">
                                    <SectionHeader
                                        icon={<MapPin className="size-4" />}
                                        eyebrow="NTRIP"
                                        title="Mountpoint"
                                        description="Published correction stream and geographic reference."
                                    />

                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label="Mountpoint name"
                                            required
                                            error={errors['mountpoint.name']}
                                        >
                                            <Input
                                                value={form.mountpointName}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'mountpointName',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="CTUAV-RTCM-004"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Identifier">
                                            <Input
                                                value={form.identifier}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'identifier',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="CTUAV GNSS Base 004"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="RTCM format">
                                            <Input
                                                value={form.format}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'format',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Navigation systems">
                                            <Input
                                                value={form.navSystem}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'navSystem',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Latitude"
                                            required
                                            error={errors['mountpoint.lat']}
                                        >
                                            <Input
                                                type="number"
                                                step="any"
                                                value={form.latitude}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'latitude',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="10.980123"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Longitude"
                                            required
                                            error={errors['mountpoint.lon']}
                                        >
                                            <Input
                                                type="number"
                                                step="any"
                                                value={form.longitude}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'longitude',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="106.674568"
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field label="Country">
                                            <Input
                                                maxLength={3}
                                                value={form.country}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'country',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl uppercase"
                                            />
                                        </Field>

                                        <ToggleField
                                            checked={form.mountpointEnabled}
                                            onChange={(checked) =>
                                                updateForm(
                                                    'mountpointEnabled',
                                                    checked,
                                                )
                                            }
                                            label="Mountpoint enabled"
                                            description="Publish this mountpoint in the sourcetable."
                                        />

                                        <div className="sm:col-span-2">
                                            <Field label="RTCM format details">
                                                <textarea
                                                    rows={3}
                                                    value={form.formatDetails}
                                                    onChange={(event) =>
                                                        updateForm(
                                                            'formatDetails',
                                                            event.target.value,
                                                        )
                                                    }
                                                    className="ntrip-input w-full resize-none rounded-xl border px-3 py-2 text-caption outline-none focus:border-ntrip-teal/35"
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </section>

                                <section className="ntrip-section rounded-3xl p-4 sm:p-5 lg:col-span-2">
                                    <SectionHeader
                                        icon={<KeyRound className="size-4" />}
                                        eyebrow="Access"
                                        title="Rover authentication"
                                        description="Optional Basic authentication for Rover clients."
                                    />

                                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                                        <ToggleField
                                            checked={form.roverAuthEnabled}
                                            onChange={(checked) =>
                                                updateForm(
                                                    'roverAuthEnabled',
                                                    checked,
                                                )
                                            }
                                            label="Require credentials"
                                            description="Rovers must provide username and password."
                                        />

                                        <Field
                                            label="Rover username"
                                            error={
                                                errors[
                                                    'mountpoint.rover_username'
                                                ]
                                            }
                                        >
                                            <Input
                                                disabled={
                                                    !form.roverAuthEnabled
                                                }
                                                value={form.roverUsername}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'roverUsername',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>

                                        <Field
                                            label="Rover password"
                                            error={
                                                errors[
                                                    'mountpoint.rover_password'
                                                ]
                                            }
                                        >
                                            <Input
                                                type="password"
                                                disabled={
                                                    !form.roverAuthEnabled
                                                }
                                                value={form.roverPassword}
                                                onChange={(event) =>
                                                    updateForm(
                                                        'roverPassword',
                                                        event.target.value,
                                                    )
                                                }
                                                className="ntrip-input h-10 rounded-xl"
                                            />
                                        </Field>
                                    </div>
                                </section>
                            </div>
                        </div>

                        <footer className="flex flex-col-reverse gap-2 border-t border-ntrip-ink/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex items-center gap-2 text-micro text-ntrip-ink/45">
                                <Wifi className="size-3.5" />
                                Data will be sent to the Laravel API.
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    asChild
                                    type="button"
                                    variant="outline"
                                    className="h-10 flex-1 rounded-xl sm:flex-none"
                                >
                                    <Link href="/stations">Cancel</Link>
                                </Button>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="h-10 flex-1 rounded-xl bg-ntrip-ink text-ntrip-cloud sm:min-w-40 sm:flex-none"
                                >
                                    {submitting ? (
                                        <RefreshCw className="size-4 animate-spin" />
                                    ) : (
                                        <Save className="size-4" />
                                    )}

                                    {submitting
                                        ? 'Creating...'
                                        : 'Create station'}
                                </Button>
                            </div>
                        </footer>
                    </form>
                </div>
            </div>
        </>
    );
}
