import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    RadioTower,
    RefreshCw,
    Save,
    Server,
    ShieldCheck,
} from 'lucide-react';
import {
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
    type SyntheticEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';
import type { DashboardStation } from '@/types/ntrip-dashboard';

type JsonObject = Record<string, unknown>;

type StationEditPageProps = {
    stationId: string | number;
};

type StationEditForm = {
    deviceId: string;
    name: string;
    enabled: boolean;

    casterHost: string;
    casterPort: string;
    uartBaud: string;
    telemetryIntervalMs: string;
    configPollIntervalMs: string;
    maxRtcmAgeMs: string;
};

type ValidationErrors = Record<string, string>;

const EMPTY_FORM: StationEditForm = {
    deviceId: '',
    name: '',
    enabled: true,

    casterHost: '',
    casterPort: '2101',
    uartBaud: '115200',
    telemetryIntervalMs: '1000',
    configPollIntervalMs: '10000',
    maxRtcmAgeMs: '3000',
};

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

        if (typeof value === 'string') {
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
            const parsedValue = Number(value);

            if (Number.isFinite(parsedValue)) {
                return parsedValue;
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

function unwrapStation(payload: unknown): JsonObject {
    const root = asObject(payload);

    if (!root) {
        return {};
    }

    const data = asObject(root.data);

    if (data) {
        return asObject(data.station) ?? data;
    }

    return asObject(root.station) ?? root;
}

function normalizeErrors(payload: unknown): ValidationErrors {
    const root = asObject(payload);
    const errors = asObject(root?.errors);

    if (!errors) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(errors).map(([field, value]) => {
            if (Array.isArray(value)) {
                return [field, String(value[0] ?? 'Invalid value.')];
            }

            return [field, String(value)];
        }),
    );
}

function responseMessage(payload: unknown, fallback: string): string {
    const root = asObject(payload);

    return readString(root, 'message') ?? fallback;
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
                onChange={(event) => {
                    onChange(event.target.checked);
                }}
                className="mt-1 size-4 accent-ntrip-teal"
            />
        </label>
    );
}

export default function EditStation({ stationId }: StationEditPageProps) {
    const { selectedStationId, setSelectedStationId, mapRef } =
        useMapDashboard();

    const [form, setForm] = useState<StationEditForm>(EMPTY_FORM);

    const [errors, setErrors] = useState<ValidationErrors>({});

    const [loading, setLoading] = useState(true);

    const [submitting, setSubmitting] = useState(false);

    const [loadError, setLoadError] = useState<string | null>(null);

    const [submitError, setSubmitError] = useState<string | null>(null);

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

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function loadStation(): Promise<void> {
            setLoading(true);
            setLoadError(null);

            try {
                const response = await fetch(
                    `/api/v1/stations/${encodeURIComponent(String(stationId))}`,
                    {
                        signal: controller.signal,

                        credentials: 'same-origin',

                        headers: {
                            Accept: 'application/json',

                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                const payload = (await response
                    .json()
                    .catch(() => null)) as unknown;

                if (!response.ok) {
                    throw new Error(
                        responseMessage(
                            payload,
                            `Unable to load station. HTTP ${response.status}.`,
                        ),
                    );
                }

                if (cancelled) {
                    return;
                }

                const station = unwrapStation(payload);

                const configuration =
                    asObject(station.config) ??
                    asObject(station.station_config) ??
                    asObject(station.stationConfig);

                setForm({
                    deviceId:
                        readString(station, 'device_id', 'deviceId') ?? '',

                    name: readString(station, 'name') ?? '',

                    enabled: readBoolean(station, 'enabled') ?? true,

                    casterHost:
                        readString(
                            configuration,
                            'caster_host',
                            'casterHost',
                        ) ?? '',

                    casterPort: String(
                        readNumber(
                            configuration,
                            'caster_port',
                            'casterPort',
                        ) ?? 2101,
                    ),

                    uartBaud: String(
                        readNumber(configuration, 'uart_baud', 'uartBaud') ??
                            115200,
                    ),

                    telemetryIntervalMs: String(
                        readNumber(
                            configuration,
                            'telemetry_interval_ms',
                            'telemetryIntervalMs',
                        ) ?? 1000,
                    ),

                    configPollIntervalMs: String(
                        readNumber(
                            configuration,
                            'config_poll_interval_ms',
                            'configPollIntervalMs',
                        ) ?? 10000,
                    ),

                    maxRtcmAgeMs: String(
                        readNumber(
                            configuration,
                            'max_rtcm_age_ms',
                            'maxRtcmAgeMs',
                        ) ?? 3000,
                    ),
                });
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === 'AbortError'
                ) {
                    return;
                }

                if (!cancelled) {
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load station.',
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadStation();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [stationId]);

    function updateForm<Key extends keyof StationEditForm>(
        key: Key,
        value: StationEditForm[Key],
    ): void {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));

        setErrors((current) => {
            const nextErrors = {
                ...current,
            };

            delete nextErrors[key];

            return nextErrors;
        });

        setSubmitError(null);
    }

    function validateForm(): ValidationErrors {
        const nextErrors: ValidationErrors = {};

        if (!form.name.trim()) {
            nextErrors.name = 'Station name is required.';
        }

        if (!form.casterHost.trim()) {
            nextErrors.caster_host = 'Caster host is required.';
        }

        const casterPort = Number(form.casterPort);

        if (
            !Number.isInteger(casterPort) ||
            casterPort < 1 ||
            casterPort > 65535
        ) {
            nextErrors.caster_port = 'Caster port must be between 1 and 65535.';
        }

        const uartBaud = Number(form.uartBaud);

        if (!Number.isInteger(uartBaud) || uartBaud <= 0) {
            nextErrors.uart_baud = 'UART baud must be a positive integer.';
        }

        const telemetryInterval = Number(form.telemetryIntervalMs);

        if (!Number.isInteger(telemetryInterval) || telemetryInterval < 100) {
            nextErrors.telemetry_interval_ms =
                'Telemetry interval must be at least 100 ms.';
        }

        const configPollInterval = Number(form.configPollIntervalMs);

        if (
            !Number.isInteger(configPollInterval) ||
            configPollInterval < 1000
        ) {
            nextErrors.config_poll_interval_ms =
                'Config poll interval must be at least 1000 ms.';
        }

        const maximumRtcmAge = Number(form.maxRtcmAgeMs);

        if (!Number.isInteger(maximumRtcmAge) || maximumRtcmAge < 0) {
            nextErrors.max_rtcm_age_ms = 'Maximum RTCM age cannot be negative.';
        }

        return nextErrors;
    }

    async function requestJson(
        url: string,
        method: 'PATCH' | 'PUT',
        body: JsonObject,
    ): Promise<unknown> {
        const response = await fetch(url, {
            method,

            credentials: 'same-origin',

            headers: {
                Accept: 'application/json',

                'Content-Type': 'application/json',

                'X-Requested-With': 'XMLHttpRequest',
            },

            body: JSON.stringify(body),
        });

        const payload = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
            const requestErrors = normalizeErrors(payload);

            setErrors((current) => ({
                ...current,
                ...requestErrors,
            }));

            throw new Error(
                responseMessage(
                    payload,
                    `Update failed. HTTP ${response.status}.`,
                ),
            );
        }

        return payload;
    }

    async function submitForm(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const validationErrors = validateForm();

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setSubmitError('Please review the highlighted fields.');

            return;
        }

        setSubmitting(true);
        setErrors({});
        setSubmitError(null);

        try {
            await requestJson(
                `/api/v1/stations/${encodeURIComponent(String(stationId))}`,
                'PATCH',
                {
                    name: form.name.trim(),
                    enabled: form.enabled,
                },
            );

            await requestJson(
                `/api/v1/stations/${encodeURIComponent(String(stationId))}/config`,
                'PUT',
                {
                    caster_host: form.casterHost.trim(),

                    caster_port: Number(form.casterPort),

                    uart_baud: Number(form.uartBaud),

                    telemetry_interval_ms: Number(form.telemetryIntervalMs),

                    config_poll_interval_ms: Number(form.configPollIntervalMs),

                    max_rtcm_age_ms: Number(form.maxRtcmAgeMs),
                },
            );

            router.visit(`/stations/${stationId}`);
        } catch (error) {
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : 'Unable to update station.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <Head title="Edit Station" />

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
                            <Link href={`/stations/${stationId}`}>
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-ntrip-teal">
                                Station management
                            </p>

                            <h1 className="truncate text-[clamp(1.25rem,2vw,1.75rem)] font-semibold tracking-[-0.04em]">
                                Edit Station
                            </h1>

                            <p className="mt-1 hidden truncate text-xs text-ntrip-ink/48 sm:block">
                                {form.deviceId || `Station ${stationId}`}
                            </p>
                        </div>
                    </div>

                    <span className="hidden items-center gap-2 text-xs font-semibold text-ntrip-ink/48 md:flex">
                        <ShieldCheck className="size-4 text-ntrip-teal" />
                        Identity and runtime
                    </span>
                </section>

                <div className="flex min-h-0 justify-end">
                    <form
                        onSubmit={(event) => {
                            void submitForm(event);
                        }}
                        onPointerDown={stopMapEvent}
                        onDoubleClick={stopMapEvent}
                        onWheel={stopMapEvent}
                        className={cn('ntrip-glass-panel-dense', [
                            'pointer-events-auto',
                            'grid',
                            'h-full',
                            'min-h-0',
                            'w-full',
                            'grid-rows-[auto_minmax(0,1fr)_auto]',
                            'overflow-hidden',
                            'rounded-2xl',
                            'lg:max-w-184',
                        ])}
                    >
                        <div className="border-b border-ntrip-ink/8 px-4 py-4 sm:px-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs text-ntrip-ink/48">
                                        Existing base station
                                    </p>

                                    <h2 className="mt-1 text-title font-semibold tracking-[-0.035em]">
                                        {form.name || 'Station configuration'}
                                    </h2>
                                </div>

                                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ntrip-teal/13 text-ntrip-teal">
                                    <RadioTower className="size-5" />
                                </span>
                            </div>

                            {loadError ? (
                                <div className="ntrip-alert-critical mt-4 rounded-2xl border px-4 py-3 text-xs font-medium text-ntrip-coral">
                                    {loadError}
                                </div>
                            ) : null}

                            {submitError ? (
                                <div className="ntrip-alert-critical mt-4 rounded-2xl border px-4 py-3 text-xs font-medium text-ntrip-coral">
                                    {submitError}
                                </div>
                            ) : null}
                        </div>

                        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
                            {loading ? (
                                <div className="grid min-h-72 place-items-center">
                                    <div className="text-center">
                                        <RefreshCw className="mx-auto size-5 animate-spin text-ntrip-teal" />

                                        <p className="mt-3 text-caption font-semibold">
                                            Loading station
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <section className="ntrip-section rounded-3xl p-4 sm:p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-micro font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                                                    Identity
                                                </p>

                                                <h3 className="mt-1 text-lg font-semibold">
                                                    Station information
                                                </h3>
                                            </div>

                                            <RadioTower className="size-4 text-ntrip-teal" />
                                        </div>

                                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                            <Field
                                                label="Device ID"
                                                hint="Device ID cannot be changed from this page."
                                            >
                                                <Input
                                                    readOnly
                                                    value={form.deviceId}
                                                    className="h-10 rounded-xl border-ntrip-ink/9 bg-ntrip-ink/4 font-mono text-xs"
                                                />
                                            </Field>

                                            <Field
                                                label="Station name"
                                                required
                                                error={errors.name}
                                            >
                                                <Input
                                                    value={form.name}
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'name',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <div className="sm:col-span-2">
                                                <ToggleField
                                                    checked={form.enabled}
                                                    onChange={(checked) => {
                                                        updateForm(
                                                            'enabled',
                                                            checked,
                                                        );
                                                    }}
                                                    label="Station enabled"
                                                    description="Allow telemetry, configuration polling and NTRIP Source connections."
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="ntrip-section rounded-3xl p-4 sm:p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-micro font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                                                    Runtime
                                                </p>

                                                <h3 className="mt-1 text-lg font-semibold">
                                                    Station configuration
                                                </h3>

                                                <p className="mt-1 text-xs text-ntrip-ink/46">
                                                    Settings downloaded by the
                                                    base station.
                                                </p>
                                            </div>

                                            <Server className="size-4 text-ntrip-teal" />
                                        </div>

                                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                            <Field
                                                label="Caster host"
                                                required
                                                error={errors.caster_host}
                                            >
                                                <Input
                                                    value={form.casterHost}
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'casterHost',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <Field
                                                label="Caster port"
                                                required
                                                error={errors.caster_port}
                                            >
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={65535}
                                                    value={form.casterPort}
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'casterPort',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <Field
                                                label="UART baud"
                                                error={errors.uart_baud}
                                            >
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={form.uartBaud}
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'uartBaud',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <Field
                                                label="Telemetry interval"
                                                hint="Milliseconds"
                                                error={
                                                    errors.telemetry_interval_ms
                                                }
                                            >
                                                <Input
                                                    type="number"
                                                    min={100}
                                                    value={
                                                        form.telemetryIntervalMs
                                                    }
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'telemetryIntervalMs',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <Field
                                                label="Config poll interval"
                                                hint="Milliseconds"
                                                error={
                                                    errors.config_poll_interval_ms
                                                }
                                            >
                                                <Input
                                                    type="number"
                                                    min={1000}
                                                    value={
                                                        form.configPollIntervalMs
                                                    }
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'configPollIntervalMs',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>

                                            <Field
                                                label="Maximum RTCM age"
                                                hint="Milliseconds"
                                                error={errors.max_rtcm_age_ms}
                                            >
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={form.maxRtcmAgeMs}
                                                    onChange={(event) => {
                                                        updateForm(
                                                            'maxRtcmAgeMs',
                                                            event.target.value,
                                                        );
                                                    }}
                                                    className="ntrip-input h-10 rounded-xl"
                                                />
                                            </Field>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>

                        <footer className="flex flex-col-reverse gap-2 border-t border-ntrip-ink/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <p className="text-micro text-ntrip-ink/44">
                                Mountpoint settings are not changed in this
                                step.
                            </p>

                            <div className="flex gap-2">
                                <Button
                                    asChild
                                    type="button"
                                    variant="outline"
                                    className="h-10 flex-1 rounded-xl sm:flex-none"
                                >
                                    <Link href={`/stations/${stationId}`}>
                                        Cancel
                                    </Link>
                                </Button>

                                <Button
                                    type="submit"
                                    disabled={
                                        loading ||
                                        submitting ||
                                        Boolean(loadError)
                                    }
                                    className="h-10 flex-1 rounded-xl bg-ntrip-ink text-ntrip-cloud sm:min-w-36 sm:flex-none"
                                >
                                    {submitting ? (
                                        <RefreshCw className="size-4 animate-spin" />
                                    ) : (
                                        <Save className="size-4" />
                                    )}

                                    {submitting ? 'Saving...' : 'Save changes'}
                                </Button>
                            </div>
                        </footer>
                    </form>
                </div>
            </div>
        </>
    );
}
