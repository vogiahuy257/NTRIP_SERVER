import {
    CheckCircle2,
    Cpu,
    LoaderCircle,
    RadioTower,
    Server,
    ShieldAlert,
    Wifi,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
    ApprovePendingDeviceInput,
    PendingDeviceItem,
} from '@/features/pending-devices/types';
import { usePendingDevices } from '@/features/pending-devices/use-pending-devices';
import { cn } from '@/lib/utils';

type ReviewMode = 'details' | 'reject';

type ApprovalForm = {
    deviceId: string;
    name: string;
    mountpoint: string;

    casterHost: string;
    casterPort: string;
    uartBaud: string;
    telemetryIntervalMs: string;
    configPollIntervalMs: string;
    maxRtcmAgeMs: string;
};

type ValidationErrors = Partial<Record<keyof ApprovalForm, string>>;

type PendingDeviceReviewDialogProps = {
    device: PendingDeviceItem;
    onClose: () => void;
};

function createInitialForm(device: PendingDeviceItem): ApprovalForm {
    const reportedDeviceId = device.reportedDeviceId ?? '';

    return {
        deviceId: reportedDeviceId,

        name: reportedDeviceId === '' ? '' : `RTK Base ${reportedDeviceId}`,

        mountpoint: device.reportedMountpoint ?? reportedDeviceId,

        /*
         * Caster host để trống nhằm dùng giá trị
         * NTRIP_PUBLIC_HOST từ backend.
         */
        casterHost: '',

        casterPort: '2101',
        uartBaud: '115200',
        telemetryIntervalMs: '1000',
        configPollIntervalMs: '10000',
        maxRtcmAgeMs: '3000',
    };
}

function formatTimestamp(value: string | null): string {
    if (value === null) {
        return 'Not available';
    }

    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        return 'Unknown';
    }

    const date = new Date(timestamp);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    const day = String(date.getUTCDate()).padStart(2, '0');

    const hour = String(date.getUTCHours()).padStart(2, '0');

    const minute = String(date.getUTCMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hour}:${minute} UTC`;
}

function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <label className="block min-w-0">
            <span className="text-xs font-semibold text-ntrip-ink/72">
                {label}
            </span>

            <span className="mt-2 block">{children}</span>

            {error ? (
                <span className="mt-1.5 block text-micro font-medium text-ntrip-coral">
                    {error}
                </span>
            ) : hint ? (
                <span className="mt-1.5 block text-micro leading-4 text-ntrip-ink/48">
                    {hint}
                </span>
            ) : null}
        </label>
    );
}

function DeviceDetail({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="ntrip-section flex min-w-0 items-start gap-3 rounded-2xl px-3.5 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ntrip-teal/10 text-ntrip-teal">
                {icon}
            </span>

            <div className="min-w-0">
                <p className="text-micro font-semibold tracking-[0.06em] text-ntrip-ink/38 uppercase">
                    {label}
                </p>

                <p className="mt-1 text-xs font-semibold break-all text-ntrip-ink">
                    {value}
                </p>
            </div>
        </div>
    );
}

function validateApprovalForm(form: ApprovalForm): ValidationErrors {
    const errors: ValidationErrors = {};

    const identifierPattern = /^[A-Za-z0-9_-]+$/;

    if (
        form.deviceId.trim() !== '' &&
        !identifierPattern.test(form.deviceId.trim())
    ) {
        errors.deviceId = 'Use only letters, numbers, hyphens and underscores.';
    }

    if (
        form.mountpoint.trim() !== '' &&
        !identifierPattern.test(form.mountpoint.trim())
    ) {
        errors.mountpoint =
            'Use only letters, numbers, hyphens and underscores.';
    }

    const numericFields: Array<{
        key: keyof Pick<
            ApprovalForm,
            | 'casterPort'
            | 'uartBaud'
            | 'telemetryIntervalMs'
            | 'configPollIntervalMs'
            | 'maxRtcmAgeMs'
        >;
        label: string;
        maximum?: number;
    }> = [
        {
            key: 'casterPort',
            label: 'Caster port',
            maximum: 65535,
        },
        {
            key: 'uartBaud',
            label: 'UART baud',
        },
        {
            key: 'telemetryIntervalMs',
            label: 'Telemetry interval',
        },
        {
            key: 'configPollIntervalMs',
            label: 'Config polling interval',
        },
        {
            key: 'maxRtcmAgeMs',
            label: 'Maximum RTCM age',
        },
    ];

    for (const field of numericFields) {
        const rawValue = form[field.key].trim();

        if (rawValue === '') {
            continue;
        }

        const value = Number(rawValue);

        if (
            !Number.isInteger(value) ||
            value < 1 ||
            (field.maximum !== undefined && value > field.maximum)
        ) {
            errors[field.key] =
                field.maximum === undefined
                    ? `${field.label} must be a positive integer.`
                    : `${field.label} must be between 1 and ${field.maximum}.`;
        }
    }

    return errors;
}

function optionalString(value: string): string | undefined {
    const normalized = value.trim();

    return normalized === '' ? undefined : normalized;
}

function optionalNumber(value: string): number | undefined {
    const normalized = value.trim();

    return normalized === '' ? undefined : Number(normalized);
}

function createApprovalInput(form: ApprovalForm): ApprovePendingDeviceInput {
    return {
        deviceId: optionalString(form.deviceId),

        name: optionalString(form.name),

        mountpoint: optionalString(form.mountpoint),

        casterHost: optionalString(form.casterHost),

        casterPort: optionalNumber(form.casterPort),

        uartBaud: optionalNumber(form.uartBaud),

        telemetryIntervalMs: optionalNumber(form.telemetryIntervalMs),

        configPollIntervalMs: optionalNumber(form.configPollIntervalMs),

        maxRtcmAgeMs: optionalNumber(form.maxRtcmAgeMs),
    };
}

function statusMessage(device: PendingDeviceItem): {
    title: string;
    description: string;
} {
    switch (device.status) {
        case 'approved':
            return {
                title: 'Approved',
                description:
                    'Waiting for the ESP32 to download its runtime configuration.',
            };

        case 'provisioned':
            return {
                title: 'Provisioning complete',
                description:
                    'The device authenticated successfully and is ready to stream RTCM.',
            };

        case 'rejected':
            return {
                title: 'Device rejected',
                description:
                    device.rejectionReason ??
                    'This device is not permitted to connect to the caster.',
            };

        default:
            return {
                title: 'Unknown device status',
                description:
                    'The current provisioning state could not be determined.',
            };
    }
}

export function PendingDeviceReviewDialog({
    device,
    onClose,
}: PendingDeviceReviewDialogProps) {
    const {
        approve,
        reject,
        approvingDeviceIds,
        rejectingDeviceIds,
        actionError,
    } = usePendingDevices();

    const [mode, setMode] = useState<ReviewMode>('details');

    const [form, setForm] = useState<ApprovalForm>(() =>
        createInitialForm(device),
    );

    const [errors, setErrors] = useState<ValidationErrors>({});

    const [rejectionReason, setRejectionReason] = useState('');

    const isApproving = approvingDeviceIds.has(device.id);

    const isRejecting = rejectingDeviceIds.has(device.id);

    const busy = isApproving || isRejecting;

    function updateForm(key: keyof ApprovalForm, value: string): void {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));

        setErrors((current) => {
            const next = {
                ...current,
            };

            delete next[key];

            return next;
        });
    }

    async function handleApprove(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const nextErrors = validateApprovalForm(form);

        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        await approve(device.id, createApprovalInput(form));
    }

    async function handleReject(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const rejected = await reject(
            device.id,
            optionalString(rejectionReason),
        );

        if (rejected !== null) {
            setMode('details');
        }
    }

    const status = statusMessage(device);

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) {
                    onClose();
                }
            }}
        >
            <DialogContent
                surface="glass"
                overlayClassName={cn(
                    'z-[80]',
                    'bg-ntrip-ink/24',
                    'backdrop-blur-[3px]',
                )}
                className={cn(
                    'z-[90]',
                    'max-h-[min(92dvh,820px)]',
                    'max-w-4xl',
                    'grid-rows-[auto_minmax(0,1fr)]',
                    'gap-0',
                )}
                onPointerDown={(event) => {
                    event.stopPropagation();
                }}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                }}
                onWheel={(event) => {
                    event.stopPropagation();
                }}
            >
                <DialogHeader
                    className={cn(
                        'border-b',
                        'border-ntrip-ink/8',
                        'px-5',
                        'py-5',
                        'pr-14',
                        'sm:px-6',
                    )}
                >
                    <div className="flex items-start gap-3">
                        <span
                            className={cn(
                                'grid',
                                'size-11',
                                'shrink-0',
                                'place-items-center',
                                'rounded-2xl',

                                device.status === 'rejected'
                                    ? ['bg-ntrip-coral/12', 'text-ntrip-coral']
                                    : ['bg-ntrip-amber/15', 'text-ntrip-ink'],
                            )}
                        >
                            <Cpu className="size-5" />
                        </span>

                        <div className="min-w-0">
                            <p className="text-micro font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                                Device provisioning
                            </p>

                            <DialogTitle className="mt-1 truncate text-xl tracking-[-0.035em] text-ntrip-ink">
                                {device.reportedDeviceId ?? device.hardwareId}
                            </DialogTitle>

                            <DialogDescription className="mt-1 font-mono text-xs text-ntrip-ink/48">
                                {device.hardwareId}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto">
                    {device.status !== 'pending' ? (
                        <div className="p-5 sm:p-6">
                            <div
                                className={cn(
                                    'rounded-3xl',
                                    'border',
                                    'px-5',
                                    'py-6',
                                    'text-center',

                                    device.status === 'rejected'
                                        ? [
                                              'border-ntrip-coral/22',
                                              'bg-ntrip-coral/8',
                                          ]
                                        : [
                                              'border-ntrip-teal/22',
                                              'bg-ntrip-teal/8',
                                          ],
                                )}
                            >
                                <span
                                    className={cn(
                                        'mx-auto',
                                        'grid',
                                        'size-12',
                                        'place-items-center',
                                        'rounded-2xl',

                                        device.status === 'rejected'
                                            ? [
                                                  'bg-ntrip-coral/14',
                                                  'text-ntrip-coral',
                                              ]
                                            : [
                                                  'bg-ntrip-teal/14',
                                                  'text-ntrip-teal',
                                              ],
                                    )}
                                >
                                    {device.status === 'rejected' ? (
                                        <XCircle className="size-6" />
                                    ) : (
                                        <CheckCircle2 className="size-6" />
                                    )}
                                </span>

                                <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em] text-ntrip-ink">
                                    {status.title}
                                </h3>

                                <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-ntrip-ink/52">
                                    {status.description}
                                </p>
                            </div>

                            {device.station ? (
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <DeviceDetail
                                        icon={<RadioTower className="size-4" />}
                                        label="Station"
                                        value={device.station.name}
                                    />

                                    <DeviceDetail
                                        icon={<Server className="size-4" />}
                                        label="Mountpoint"
                                        value={
                                            device.station.mountpoint?.name ??
                                            'Not available'
                                        }
                                    />
                                </div>
                            ) : null}

                            <DialogFooter className="mt-6">
                                <Button
                                    type="button"
                                    onClick={onClose}
                                    className="h-10 rounded-xl bg-ntrip-ink px-5 text-ntrip-cloud"
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : mode === 'reject' ? (
                        <form onSubmit={handleReject} className="p-5 sm:p-6">
                            <div className="ntrip-section rounded-3xl p-5">
                                <span className="grid size-11 place-items-center rounded-2xl bg-ntrip-coral/12 text-ntrip-coral">
                                    <ShieldAlert className="size-5" />
                                </span>

                                <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em] text-ntrip-ink">
                                    Reject this device?
                                </h3>

                                <p className="mt-2 text-xs leading-5 text-ntrip-ink/50">
                                    The ESP32 will be denied when it reconnects.
                                    A reason is optional.
                                </p>

                                <label className="mt-5 block">
                                    <span className="text-xs font-semibold text-ntrip-ink/72">
                                        Rejection reason
                                    </span>

                                    <textarea
                                        value={rejectionReason}
                                        onChange={(event) => {
                                            setRejectionReason(
                                                event.target.value,
                                            );
                                        }}
                                        maxLength={500}
                                        placeholder="Optional reason"
                                        className={cn(
                                            'ntrip-input',
                                            'mt-2',
                                            'min-h-28',
                                            'w-full',
                                            'resize-none',
                                            'rounded-2xl',
                                            'border',
                                            'px-3',
                                            'py-3',
                                            'text-sm',
                                            'text-ntrip-ink',
                                            'placeholder:text-ntrip-ink/30',
                                        )}
                                    />
                                </label>
                            </div>

                            {actionError ? (
                                <p className="mt-4 rounded-xl border border-ntrip-coral/20 bg-ntrip-coral/8 px-3 py-2 text-xs font-medium text-ntrip-coral">
                                    {actionError}
                                </p>
                            ) : null}

                            <DialogFooter className="mt-5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => {
                                        setMode('details');
                                    }}
                                    className="h-10 rounded-xl bg-ntrip-cloud/62 px-4 text-ntrip-ink"
                                >
                                    Cancel
                                </Button>

                                <Button
                                    type="submit"
                                    disabled={busy}
                                    className="h-10 rounded-xl bg-ntrip-coral px-5 text-white hover:bg-ntrip-coral/90"
                                >
                                    {isRejecting ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <XCircle className="size-4" />
                                    )}
                                    Reject device
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : (
                        <form
                            onSubmit={handleApprove}
                            className="grid min-h-0 lg:grid-cols-[17rem_minmax(0,1fr)]"
                        >
                            <aside
                                className={cn(
                                    'border-b',
                                    'border-ntrip-ink/8',
                                    'p-5',
                                    'lg:border-r',
                                    'lg:border-b-0',
                                    'sm:p-6',
                                )}
                            >
                                <p className="text-xs font-semibold text-ntrip-teal">
                                    Reported identity
                                </p>

                                <div className="mt-4 grid gap-2.5">
                                    <DeviceDetail
                                        icon={<Cpu className="size-4" />}
                                        label="Hardware ID"
                                        value={device.hardwareId}
                                    />

                                    <DeviceDetail
                                        icon={<Server className="size-4" />}
                                        label="Mountpoint"
                                        value={
                                            device.reportedMountpoint ??
                                            'Not reported'
                                        }
                                    />

                                    <DeviceDetail
                                        icon={<Wifi className="size-4" />}
                                        label="Remote IP"
                                        value={device.remoteIp ?? 'Unavailable'}
                                    />

                                    <DeviceDetail
                                        icon={<RadioTower className="size-4" />}
                                        label="Firmware"
                                        value={
                                            device.firmwareVersion ??
                                            'Not reported'
                                        }
                                    />
                                </div>

                                <div className="mt-4 text-micro leading-5 text-ntrip-ink/42">
                                    <p>
                                        First seen:{' '}
                                        {formatTimestamp(device.firstSeenAt)}
                                    </p>

                                    <p>
                                        Last seen:{' '}
                                        {formatTimestamp(device.lastSeenAt)}
                                    </p>

                                    <p>Attempts: {device.connectionAttempts}</p>
                                </div>
                            </aside>

                            <div className="min-w-0 p-5 sm:p-6">
                                <div>
                                    <p className="text-xs font-semibold text-ntrip-teal">
                                        Runtime configuration
                                    </p>

                                    <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-ntrip-ink">
                                        Approve device
                                    </h3>

                                    <p className="mt-1 text-xs leading-5 text-ntrip-ink/48">
                                        Empty fields use the defaults configured
                                        by the backend.
                                    </p>
                                </div>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Device ID"
                                        error={errors.deviceId}
                                        hint="Leave empty for automatic generation."
                                    >
                                        <Input
                                            value={form.deviceId}
                                            onChange={(event) => {
                                                updateForm(
                                                    'deviceId',
                                                    event.target.value,
                                                );
                                            }}
                                            className="ntrip-input h-10 rounded-xl"
                                        />
                                    </Field>

                                    <Field
                                        label="Station name"
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

                                    <Field
                                        label="Mountpoint"
                                        error={errors.mountpoint}
                                    >
                                        <Input
                                            value={form.mountpoint}
                                            onChange={(event) => {
                                                updateForm(
                                                    'mountpoint',
                                                    event.target.value,
                                                );
                                            }}
                                            className="ntrip-input h-10 rounded-xl font-mono"
                                        />
                                    </Field>

                                    <Field
                                        label="Caster host"
                                        error={errors.casterHost}
                                        hint="Empty uses NTRIP_PUBLIC_HOST."
                                    >
                                        <Input
                                            value={form.casterHost}
                                            onChange={(event) => {
                                                updateForm(
                                                    'casterHost',
                                                    event.target.value,
                                                );
                                            }}
                                            placeholder="Backend default"
                                            className="ntrip-input h-10 rounded-xl"
                                        />
                                    </Field>

                                    <Field
                                        label="Caster port"
                                        error={errors.casterPort}
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
                                        error={errors.uartBaud}
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
                                        error={errors.telemetryIntervalMs}
                                        hint="Milliseconds"
                                    >
                                        <Input
                                            type="number"
                                            min={1}
                                            value={form.telemetryIntervalMs}
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
                                        error={errors.configPollIntervalMs}
                                        hint="Milliseconds"
                                    >
                                        <Input
                                            type="number"
                                            min={1}
                                            value={form.configPollIntervalMs}
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
                                        error={errors.maxRtcmAgeMs}
                                        hint="Milliseconds"
                                    >
                                        <Input
                                            type="number"
                                            min={1}
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

                                {actionError ? (
                                    <p className="mt-4 rounded-xl border border-ntrip-coral/20 bg-ntrip-coral/8 px-3 py-2 text-xs font-medium text-ntrip-coral">
                                        {actionError}
                                    </p>
                                ) : null}

                                <DialogFooter className="mt-6 border-t border-ntrip-ink/8 pt-5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={busy}
                                        onClick={() => {
                                            setMode('reject');
                                        }}
                                        className="h-10 rounded-xl bg-ntrip-coral/9 px-4 text-ntrip-coral hover:bg-ntrip-coral/14"
                                    >
                                        <XCircle className="size-4" />
                                        Reject
                                    </Button>

                                    <Button
                                        type="submit"
                                        disabled={busy}
                                        className="h-10 rounded-xl bg-ntrip-ink px-5 text-ntrip-cloud hover:bg-ntrip-ink/90"
                                    >
                                        {isApproving ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="size-4" />
                                        )}
                                        Approve device
                                    </Button>
                                </DialogFooter>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
