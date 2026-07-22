import {
    CheckCircle2,
    KeyRound,
    RadioTower,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { RoverAccountApiError } from '@/features/rover-accounts/rover-account-api';

import type {
    RoverAccount,
    RoverAccountCreateInput,
    RoverAccountFieldErrors,
    RoverAccountMountpointGrantInput,
    RoverAccountUpdateInput,
} from '@/features/rover-accounts/types';
import { cn } from '@/lib/utils';

import type { MountpointWithSessions } from '../types';

type EditorMode = 'create' | 'edit';

type GrantDraft = {
    selected: boolean;
    enabled: boolean;
    maxConnections: string;
    startsAt: string;
    expiresAt: string;
};

type FormState = {
    username: string;
    displayName: string;
    password: string;
    passwordConfirmation: string;
    enabled: boolean;
    maxConnections: string;
    expiresAt: string;
    notes: string;
    grants: Record<string, GrantDraft>;
};

type RoverAccountFormDialogProps = {
    mode: EditorMode;
    account: RoverAccount | null;
    mountpoints: MountpointWithSessions[];
    onClose: () => void;
    onCreate: (
        input: RoverAccountCreateInput,
        grants: RoverAccountMountpointGrantInput[],
    ) => Promise<void>;
    onUpdate: (
        accountId: number,
        input: RoverAccountUpdateInput,
        grants: RoverAccountMountpointGrantInput[],
    ) => Promise<void>;
};

function toLocalDateTime(value: string | null): string {
    if (value === null) {
        return '';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return '';
    }

    const offset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
    if (value.trim() === '') {
        return null;
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function buildInitialState(
    account: RoverAccount | null,
    mountpoints: MountpointWithSessions[],
): FormState {
    const currentAccess = new Map(
        (account?.mountpoints ?? []).map((mountpoint) => [
            String(mountpoint.id),
            mountpoint.access,
        ]),
    );

    const grants: Record<string, GrantDraft> = {};

    for (const mountpoint of mountpoints) {
        const access = currentAccess.get(mountpoint.id) ?? null;

        grants[mountpoint.id] = {
            selected: currentAccess.has(mountpoint.id),
            enabled: access?.enabled ?? true,
            maxConnections:
                access?.maxConnections === null ||
                access?.maxConnections === undefined
                    ? ''
                    : String(access.maxConnections),
            startsAt: toLocalDateTime(access?.startsAt ?? null),
            expiresAt: toLocalDateTime(access?.expiresAt ?? null),
        };
    }

    return {
        username: account?.username ?? '',
        displayName: account?.displayName ?? '',
        password: '',
        passwordConfirmation: '',
        enabled: account?.enabled ?? true,
        maxConnections: String(account?.maxConnections ?? 1),
        expiresAt: toLocalDateTime(account?.expiresAt ?? null),
        notes: account?.notes ?? '',
        grants,
    };
}

function firstError(
    errors: RoverAccountFieldErrors,
    field: string,
): string | undefined {
    return errors[field]?.[0];
}

function validateForm(
    mode: EditorMode,
    state: FormState,
): RoverAccountFieldErrors {
    const errors: RoverAccountFieldErrors = {};
    const username = state.username.trim().toLowerCase();
    const maxConnections = Number(state.maxConnections);

    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) {
        errors.username = [
            'Use 3–80 characters: lowercase letters, numbers, dots, underscores, or hyphens.',
        ];
    }

    if (state.displayName.trim().length > 120) {
        errors.display_name = ['Display name must not exceed 120 characters.'];
    }

    if (mode === 'create' && state.password.length < 6) {
        errors.password = ['Password must be at least 6 characters.'];
    }

    if (state.password !== '' && state.password.length < 6) {
        errors.password = ['Password must be at least 6 characters.'];
    }

    if (state.password !== state.passwordConfirmation) {
        errors.password_confirmation = [
            'Password confirmation does not match.',
        ];
    }

    if (
        !Number.isInteger(maxConnections) ||
        maxConnections < 1 ||
        maxConnections > 1000
    ) {
        errors.max_connections = [
            'Connection limit must be between 1 and 1000.',
        ];
    }

    if (state.notes.length > 5000) {
        errors.notes = ['Notes must not exceed 5000 characters.'];
    }

    for (const [mountpointId, grant] of Object.entries(state.grants)) {
        if (!grant.selected) {
            continue;
        }

        if (grant.maxConnections !== '') {
            const grantLimit = Number(grant.maxConnections);

            if (
                !Number.isInteger(grantLimit) ||
                grantLimit < 1 ||
                grantLimit > maxConnections
            ) {
                errors[`grant.${mountpointId}.max_connections`] = [
                    `Limit must be between 1 and ${maxConnections}.`,
                ];
            }
        }

        if (
            grant.startsAt !== '' &&
            grant.expiresAt !== '' &&
            new Date(grant.expiresAt).getTime() <=
                new Date(grant.startsAt).getTime()
        ) {
            errors[`grant.${mountpointId}.expires_at`] = [
                'End time must be later than start time.',
            ];
        }
    }

    return errors;
}

function buildGrants(state: FormState): RoverAccountMountpointGrantInput[] {
    return Object.entries(state.grants)
        .filter(([, grant]) => grant.selected)
        .map(([mountpointId, grant]) => ({
            id: Number(mountpointId),
            enabled: grant.enabled,
            maxConnections:
                grant.maxConnections === ''
                    ? null
                    : Number(grant.maxConnections),
            startsAt: toIsoDateTime(grant.startsAt),
            expiresAt: toIsoDateTime(grant.expiresAt),
        }));
}

export function RoverAccountFormDialog({
    mode,
    account,
    mountpoints,
    onClose,
    onCreate,
    onUpdate,
}: RoverAccountFormDialogProps) {
    const [form, setForm] = useState<FormState>(() =>
        buildInitialState(account, mountpoints),
    );
    const [fieldErrors, setFieldErrors] = useState<RoverAccountFieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const assignedCount = useMemo(
        () =>
            Object.values(form.grants).filter((grant) => grant.selected).length,
        [form.grants],
    );

    const updateGrant = (
        mountpointId: string,
        updates: Partial<GrantDraft>,
    ): void => {
        setForm((current) => ({
            ...current,
            grants: {
                ...current.grants,
                [mountpointId]: {
                    ...current.grants[mountpointId],
                    ...updates,
                },
            },
        }));
    };

    const handleSubmit = async (): Promise<void> => {
        const errors = validateForm(mode, form);

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setSubmitError('Please review the highlighted fields.');

            return;
        }

        setSubmitting(true);
        setFieldErrors({});
        setSubmitError(null);

        const commonInput = {
            username: form.username.trim().toLowerCase(),
            displayName: form.displayName.trim() || null,
            enabled: form.enabled,
            maxConnections: Number(form.maxConnections),
            expiresAt: toIsoDateTime(form.expiresAt),
            notes: form.notes.trim() || null,
        };

        try {
            if (mode === 'create') {
                await onCreate(
                    {
                        ...commonInput,
                        password: form.password,
                        passwordConfirmation: form.passwordConfirmation,
                    },
                    buildGrants(form),
                );
            } else if (account !== null) {
                const updateInput: RoverAccountUpdateInput = commonInput;

                if (form.password !== '') {
                    updateInput.password = form.password;
                    updateInput.passwordConfirmation =
                        form.passwordConfirmation;
                }

                await onUpdate(account.id, updateInput, buildGrants(form));
            }

            onClose();
        } catch (reason) {
            if (reason instanceof RoverAccountApiError) {
                setFieldErrors(reason.errors);
            }

            setSubmitError(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to save the Rover Account.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                surface="default"
                className="max-h-[calc(100dvh-1.5rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-5xl"
                overlayClassName="bg-black/45 backdrop-blur-sm"
            >
                <DialogHeader className="border-b border-slate-200 bg-white px-5 py-4 pr-14 sm:px-6">
                    <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ntrip-teal/10 text-ntrip-teal shadow-ntrip-inset">
                            <UserRound className="size-5" />
                        </span>

                        <div className="min-w-0">
                            <DialogTitle>
                                {mode === 'create'
                                    ? 'Create Rover Account'
                                    : `Edit ${account?.username ?? ''}`}
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-slate-500">
                                NTRIP clients use this account through Basic
                                Authentication to access authorized Mountpoints.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
                    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2">
                                <KeyRound className="size-4 text-ntrip-teal" />
                                <h3 className="text-sm font-semibold">
                                    Authentication
                                </h3>
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                <Field
                                    label="Username"
                                    htmlFor="rover-username"
                                    error={firstError(fieldErrors, 'username')}
                                >
                                    <Input
                                        id="rover-username"
                                        value={form.username}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                username: event.target.value,
                                            }))
                                        }
                                        autoComplete="off"
                                        placeholder="rover-001"
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                        aria-invalid={
                                            firstError(fieldErrors, 'username')
                                                ? true
                                                : undefined
                                        }
                                    />
                                </Field>

                                <Field
                                    label="Display name"
                                    htmlFor="rover-display-name"
                                    error={firstError(
                                        fieldErrors,
                                        'display_name',
                                    )}
                                >
                                    <Input
                                        id="rover-display-name"
                                        value={form.displayName}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                displayName: event.target.value,
                                            }))
                                        }
                                        placeholder="Survey UAV 01"
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                    />
                                </Field>

                                <Field
                                    label={
                                        mode === 'create'
                                            ? 'Password'
                                            : 'New password (optional)'
                                    }
                                    htmlFor="rover-password"
                                    error={firstError(fieldErrors, 'password')}
                                >
                                    <PasswordInput
                                        id="rover-password"
                                        value={form.password}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                password: event.target.value,
                                            }))
                                        }
                                        autoComplete="new-password"
                                        placeholder="At least 6 characters"
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                    />
                                </Field>

                                <Field
                                    label="Confirm password"
                                    htmlFor="rover-password-confirmation"
                                    error={firstError(
                                        fieldErrors,
                                        'password_confirmation',
                                    )}
                                >
                                    <PasswordInput
                                        id="rover-password-confirmation"
                                        value={form.passwordConfirmation}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                passwordConfirmation:
                                                    event.target.value,
                                            }))
                                        }
                                        autoComplete="new-password"
                                        placeholder="Re-enter the password"
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                    />
                                </Field>

                                <Field
                                    label="Connection limit"
                                    htmlFor="rover-max-connections"
                                    error={firstError(
                                        fieldErrors,
                                        'max_connections',
                                    )}
                                >
                                    <Input
                                        id="rover-max-connections"
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={form.maxConnections}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                maxConnections:
                                                    event.target.value,
                                            }))
                                        }
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                    />
                                </Field>

                                <Field
                                    label="Account expiry"
                                    htmlFor="rover-expires-at"
                                    error={firstError(
                                        fieldErrors,
                                        'expires_at',
                                    )}
                                >
                                    <Input
                                        id="rover-expires-at"
                                        type="datetime-local"
                                        value={form.expiresAt}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                expiresAt: event.target.value,
                                            }))
                                        }
                                        className="h-11 rounded-xl border-slate-200 bg-white"
                                    />
                                </Field>
                            </div>

                            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
                                <Checkbox
                                    checked={form.enabled}
                                    onCheckedChange={(checked) =>
                                        setForm((current) => ({
                                            ...current,
                                            enabled: checked === true,
                                        }))
                                    }
                                    className="border-ntrip-ink/20 data-[state=checked]:border-ntrip-teal data-[state=checked]:bg-ntrip-teal"
                                />
                                <span className="min-w-0">
                                    <span className="block text-micro font-semibold text-ntrip-ink/76">
                                        Allow NTRIP sign-in
                                    </span>
                                    <span className="block text-2xs text-ntrip-ink/48">
                                        Turn this off to disable the account
                                        immediately.
                                    </span>
                                </span>
                            </label>

                            <Field
                                label="Internal notes"
                                htmlFor="rover-notes"
                                error={firstError(fieldErrors, 'notes')}
                                className="mt-4"
                            >
                                <textarea
                                    id="rover-notes"
                                    value={form.notes}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            notes: event.target.value,
                                        }))
                                    }
                                    rows={4}
                                    maxLength={5000}
                                    placeholder="Purpose, operating team, related device..."
                                    className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs transition outline-none focus-visible:border-ntrip-teal/50 focus-visible:ring-3 focus-visible:ring-ntrip-teal/15"
                                />
                            </Field>
                        </section>

                        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                    <ShieldCheck className="mt-0.5 size-4 text-ntrip-teal" />
                                    <div>
                                        <h3 className="text-sm font-semibold">
                                            Mountpoint access
                                        </h3>
                                        <p className="mt-1 text-micro text-ntrip-ink/52">
                                            Select the RTCM streams this Rover
                                            account is allowed to use.
                                        </p>
                                    </div>
                                </div>

                                <span className="rounded-full bg-ntrip-teal/10 px-2.5 py-1 text-micro font-semibold text-ntrip-teal">
                                    {assignedCount} assigned
                                </span>
                            </div>

                            {mountpoints.length === 0 ? (
                                <div className="mt-4 grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                                    <div>
                                        <RadioTower className="mx-auto size-5 text-ntrip-ink/38" />
                                        <p className="mt-2 text-sm font-semibold">
                                            No Mountpoints available
                                        </p>
                                        <p className="mt-1 text-micro text-ntrip-ink/48">
                                            Create a Mountpoint before assigning
                                            access to a Rover Account.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-3">
                                    {mountpoints.map((mountpoint) => {
                                        const grant =
                                            form.grants[mountpoint.id];
                                        const maxError = firstError(
                                            fieldErrors,
                                            `grant.${mountpoint.id}.max_connections`,
                                        );
                                        const expiryError = firstError(
                                            fieldErrors,
                                            `grant.${mountpoint.id}.expires_at`,
                                        );

                                        return (
                                            <article
                                                key={mountpoint.id}
                                                className={cn(
                                                    'rounded-2xl border p-3 transition',
                                                    grant?.selected
                                                        ? 'border-ntrip-teal/24 bg-ntrip-teal/[5%]'
                                                        : 'border-slate-200 bg-white',
                                                )}
                                            >
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <Checkbox
                                                        checked={
                                                            grant?.selected ??
                                                            false
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            updateGrant(
                                                                mountpoint.id,
                                                                {
                                                                    selected:
                                                                        checked ===
                                                                        true,
                                                                },
                                                            )
                                                        }
                                                        className="mt-0.5 border-ntrip-ink/20 data-[state=checked]:border-ntrip-teal data-[state=checked]:bg-ntrip-teal"
                                                        aria-label={`Grant access to ${mountpoint.name}`}
                                                    />

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <h4 className="truncate font-mono text-sm font-semibold">
                                                                {
                                                                    mountpoint.name
                                                                }
                                                            </h4>
                                                            <span
                                                                className={cn(
                                                                    'rounded-full px-2 py-0.5 text-3xs font-semibold uppercase',
                                                                    mountpoint.enabled
                                                                        ? 'bg-ntrip-teal/10 text-ntrip-teal'
                                                                        : 'bg-ntrip-ink/7 text-ntrip-ink/48',
                                                                )}
                                                            >
                                                                {mountpoint.enabled
                                                                    ? 'Enabled'
                                                                    : 'Disabled'}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 truncate text-micro text-ntrip-ink/48">
                                                            {mountpoint.station
                                                                ?.name ??
                                                                'Unknown station'}
                                                            {' · '}
                                                            {mountpoint.format ??
                                                                'RTCM'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {grant?.selected ? (
                                                    <div className="mt-3 grid gap-3 border-t border-ntrip-ink/8 pt-3 sm:grid-cols-2">
                                                        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:col-span-2">
                                                            <Checkbox
                                                                checked={
                                                                    grant.enabled
                                                                }
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) =>
                                                                    updateGrant(
                                                                        mountpoint.id,
                                                                        {
                                                                            enabled:
                                                                                checked ===
                                                                                true,
                                                                        },
                                                                    )
                                                                }
                                                                className="border-ntrip-ink/20 data-[state=checked]:border-ntrip-teal data-[state=checked]:bg-ntrip-teal"
                                                            />
                                                            <span className="text-micro font-semibold text-ntrip-ink/68">
                                                                Access enabled
                                                            </span>
                                                        </label>

                                                        <Field
                                                            label="Per-Mountpoint limit"
                                                            htmlFor={`grant-${mountpoint.id}-max`}
                                                            error={maxError}
                                                        >
                                                            <Input
                                                                id={`grant-${mountpoint.id}-max`}
                                                                type="number"
                                                                min={1}
                                                                max={Number(
                                                                    form.maxConnections,
                                                                )}
                                                                value={
                                                                    grant.maxConnections
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateGrant(
                                                                        mountpoint.id,
                                                                        {
                                                                            maxConnections:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                                placeholder="Use account limit"
                                                                className="h-10 rounded-xl border-slate-200 bg-white"
                                                            />
                                                        </Field>

                                                        <div className="hidden sm:block" />

                                                        <Field
                                                            label="Starts at"
                                                            htmlFor={`grant-${mountpoint.id}-starts`}
                                                        >
                                                            <Input
                                                                id={`grant-${mountpoint.id}-starts`}
                                                                type="datetime-local"
                                                                value={
                                                                    grant.startsAt
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateGrant(
                                                                        mountpoint.id,
                                                                        {
                                                                            startsAt:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                                className="h-10 rounded-xl border-slate-200 bg-white"
                                                            />
                                                        </Field>

                                                        <Field
                                                            label="Expires at"
                                                            htmlFor={`grant-${mountpoint.id}-expires`}
                                                            error={expiryError}
                                                        >
                                                            <Input
                                                                id={`grant-${mountpoint.id}-expires`}
                                                                type="datetime-local"
                                                                value={
                                                                    grant.expiresAt
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateGrant(
                                                                        mountpoint.id,
                                                                        {
                                                                            expiresAt:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                                className="h-10 rounded-xl border-slate-200 bg-white"
                                                            />
                                                        </Field>
                                                    </div>
                                                ) : null}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {submitError ? (
                        <div className="mt-4 rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2 text-micro font-medium text-ntrip-coral">
                            {submitError}
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={submitting}
                        className="h-11 rounded-xl border-slate-200 bg-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className="h-11 rounded-xl bg-ntrip-ink px-5 text-ntrip-cloud hover:bg-ntrip-ink/88"
                    >
                        {submitting ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <CheckCircle2 className="size-4" />
                        )}
                        {mode === 'create' ? 'Create account' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    htmlFor,
    error,
    children,
    className,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('grid min-w-0 gap-1.5', className)}>
            <Label
                htmlFor={htmlFor}
                className="text-micro font-semibold text-slate-700"
            >
                {label}
            </Label>
            {children}
            <InputError message={error} className="text-micro" />
        </div>
    );
}
