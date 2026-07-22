import {
    CalendarClock,
    CircleUserRound,
    Copy,
    KeyRound,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldOff,
    Trash2,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type {
    RoverAccount,
    RoverAccountCreateInput,
    RoverAccountMountpointGrantInput,
    RoverAccountStatus,
    RoverAccountUpdateInput,
} from '@/features/rover-accounts/types';
import type { useRoverAccounts } from '@/features/rover-accounts/use-rover-accounts';
import { cn } from '@/lib/utils';

import type { MountpointWithSessions } from '../types';
import { MountpointEmptyState } from './mountpoint-empty-state';
import { RoverAccountDeleteDialog } from './rover-account-delete-dialog';
import { RoverAccountFormDialog } from './rover-account-form-dialog';
import { RoverAccountPasswordDialog } from './rover-account-password-dialog';

type AccountFilter = 'all' | RoverAccountStatus;

type EditorState =
    | {
          mode: 'create';
          account: null;
      }
    | {
          mode: 'edit';
          account: RoverAccount;
      };

const statusLabel: Record<RoverAccountStatus, string> = {
    active: 'Active',
    disabled: 'Disabled',
    expired: 'Expired',
};

const statusClass: Record<RoverAccountStatus, string> = {
    active: 'bg-ntrip-teal/10 text-ntrip-teal',
    disabled: 'bg-ntrip-ink/7 text-ntrip-ink/52',
    expired: 'bg-ntrip-amber/10 text-ntrip-amber',
};

function formatDateTime(value: string | null): string {
    if (value === null) {
        return 'Never';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function formatExpiry(value: string | null): string {
    return value === null ? 'No expiry' : formatDateTime(value);
}

type RoverAccountsStore = ReturnType<typeof useRoverAccounts>;

export function MountpointUsersPanel({
    mountpoints,
    accounts,
    roverAccounts,
}: {
    mountpoints: MountpointWithSessions[];
    accounts: RoverAccount[];
    roverAccounts: RoverAccountsStore;
}) {
    const {
        isLoading,
        isRefreshing,
        error,
        refresh,
        loadAccount,
        createAccount,
        updateAccount,
        removeAccount,
    } = roverAccounts;

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<AccountFilter>('all');
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [passwordAccount, setPasswordAccount] = useState<RoverAccount | null>(
        null,
    );
    const [deleteAccount, setDeleteAccount] = useState<RoverAccount | null>(
        null,
    );
    const [loadingAccountId, setLoadingAccountId] = useState<number | null>(
        null,
    );

    const activeConnectionsByUsername = useMemo(() => {
        const counts = new Map<string, number>();

        for (const mountpoint of mountpoints) {
            for (const session of mountpoint.sessions) {
                const username = session.username?.trim().toLowerCase();

                if (!username) {
                    continue;
                }

                counts.set(username, (counts.get(username) ?? 0) + 1);
            }
        }

        return counts;
    }, [mountpoints]);

    const filteredAccounts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return accounts.filter((account) => {
            if (statusFilter !== 'all' && account.status !== statusFilter) {
                return false;
            }

            if (query === '') {
                return true;
            }

            return [
                account.username,
                account.displayName ?? '',
                account.notes ?? '',
            ].some((value) => value.toLowerCase().includes(query));
        });
    }, [accounts, searchQuery, statusFilter]);

    const statistics = useMemo(
        () => ({
            total: accounts.length,
            active: accounts.filter((account) => account.status === 'active')
                .length,
            disabled: accounts.filter(
                (account) => account.status === 'disabled',
            ).length,
            sessions: accounts.reduce(
                (total, account) =>
                    total +
                    (activeConnectionsByUsername.get(
                        account.username.toLowerCase(),
                    ) ?? account.activeSessionCount),
                0,
            ),
        }),
        [accounts, activeConnectionsByUsername],
    );

    const handleEdit = async (account: RoverAccount): Promise<void> => {
        setLoadingAccountId(account.id);

        try {
            const completeAccount = await loadAccount(account.id);
            setEditor({
                mode: 'edit',
                account: completeAccount,
            });
        } catch (reason) {
            toast.error(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to load Rover Account details.',
            );
        } finally {
            setLoadingAccountId(null);
        }
    };

    const handleCreate = async (
        input: RoverAccountCreateInput,
        grants: RoverAccountMountpointGrantInput[],
    ): Promise<void> => {
        const account = await createAccount(input, grants);
        toast.success(`Created Rover Account ${account.username}.`);
    };

    const handleUpdate = async (
        accountId: number,
        input: RoverAccountUpdateInput,
        grants: RoverAccountMountpointGrantInput[],
    ): Promise<void> => {
        const account = await updateAccount(accountId, input, grants);
        toast.success(`Updated ${account.username}.`);
    };

    const handlePasswordUpdate = async (
        accountId: number,
        password: string,
        passwordConfirmation: string,
    ): Promise<void> => {
        const account = await updateAccount(accountId, {
            password,
            passwordConfirmation,
        });

        toast.success(`Changed the password for ${account.username}.`);
    };

    const handleToggleEnabled = async (
        account: RoverAccount,
    ): Promise<void> => {
        const updated = await updateAccount(account.id, {
            enabled: !account.enabled,
        });

        toast.success(
            updated.enabled
                ? `Enabled ${updated.username}.`
                : `Disabled ${updated.username}.`,
        );
    };

    const handleDelete = async (accountId: number): Promise<void> => {
        await removeAccount(accountId);
        toast.success('Deleted the Rover Account.');
    };

    const handleCopyUsername = async (username: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(username);
            toast.success('Username copied.');
        } catch {
            toast.error('Unable to copy the username.');
        }
    };

    return (
        <div className="grid min-w-0 gap-4">
            <section className="ntrip-section rounded-2xl p-3 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-teal/10 text-ntrip-teal shadow-ntrip-inset">
                                <UsersRound className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold">
                                    Rover Accounts
                                </h2>
                                <p className="mt-0.5 text-micro text-ntrip-ink/52">
                                    Manage NTRIP client credentials and
                                    Mountpoint access.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />
                            <Input
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search username or display name"
                                className="h-11 rounded-xl border-white/42 bg-ntrip-cloud/48 pl-9 text-micro"
                            />
                        </div>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) =>
                                setStatusFilter(value as AccountFilter)
                            }
                        >
                            <SelectTrigger className="h-11 w-full rounded-xl border-white/42 bg-ntrip-cloud/48 sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl">
                                <SelectItem value="all">
                                    All statuses
                                </SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="disabled">
                                    Disabled
                                </SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                void refresh().catch((reason: unknown) =>
                                    toast.error(
                                        reason instanceof Error
                                            ? reason.message
                                            : 'Unable to refresh Rover Accounts.',
                                    ),
                                )
                            }
                            disabled={isRefreshing}
                            className="h-11 rounded-xl border-white/42 bg-ntrip-cloud/48"
                            aria-label="Refresh Rover Accounts"
                        >
                            <RefreshCw
                                className={cn(
                                    'size-4',
                                    isRefreshing && 'animate-spin',
                                )}
                            />
                            <span className="sm:hidden 2xl:inline">
                                Refresh
                            </span>
                        </Button>

                        <Button
                            type="button"
                            onClick={() =>
                                setEditor({
                                    mode: 'create',
                                    account: null,
                                })
                            }
                            className="h-11 rounded-xl bg-ntrip-ink px-4 text-ntrip-cloud hover:bg-ntrip-ink/88"
                        >
                            <Plus className="size-4" />
                            Add Rover
                        </Button>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SummaryMetric
                        label="Total accounts"
                        value={statistics.total}
                    />
                    <SummaryMetric
                        label="Active"
                        value={statistics.active}
                        tone="teal"
                    />
                    <SummaryMetric
                        label="Disabled"
                        value={statistics.disabled}
                        tone="amber"
                    />
                    <SummaryMetric
                        label="Active sessions"
                        value={statistics.sessions}
                    />
                </div>

                {error ? (
                    <div className="mt-3 rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2 text-micro font-medium text-ntrip-coral">
                        {error}
                    </div>
                ) : null}
            </section>

            {isLoading ? (
                <AccountLoadingGrid />
            ) : filteredAccounts.length === 0 ? (
                <MountpointEmptyState
                    icon={CircleUserRound}
                    title={
                        accounts.length === 0
                            ? 'No Rover Accounts yet'
                            : 'No matching accounts'
                    }
                    description={
                        accounts.length === 0
                            ? 'Select “Add Rover” to create credentials and assign Mountpoint access.'
                            : 'Try changing the search term or status filter.'
                    }
                />
            ) : (
                <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredAccounts.map((account) => {
                        const activeSessionCount =
                            activeConnectionsByUsername.get(
                                account.username.toLowerCase(),
                            ) ?? account.activeSessionCount;

                        return (
                            <RoverAccountCard
                                key={account.id}
                                account={account}
                                activeSessionCount={activeSessionCount}
                                loading={loadingAccountId === account.id}
                                onEdit={() => void handleEdit(account)}
                                onPassword={() => setPasswordAccount(account)}
                                onToggleEnabled={() =>
                                    void handleToggleEnabled(account).catch(
                                        (reason: unknown) =>
                                            toast.error(
                                                reason instanceof Error
                                                    ? reason.message
                                                    : 'Unable to update the account.',
                                            ),
                                    )
                                }
                                onDelete={() => setDeleteAccount(account)}
                                onCopyUsername={() =>
                                    void handleCopyUsername(account.username)
                                }
                            />
                        );
                    })}
                </div>
            )}

            {editor ? (
                <RoverAccountFormDialog
                    key={`${editor.mode}-${editor.account?.id ?? 'new'}`}
                    mode={editor.mode}
                    account={editor.account}
                    mountpoints={mountpoints}
                    onClose={() => setEditor(null)}
                    onCreate={handleCreate}
                    onUpdate={handleUpdate}
                />
            ) : null}

            {passwordAccount ? (
                <RoverAccountPasswordDialog
                    key={passwordAccount.id}
                    account={passwordAccount}
                    onClose={() => setPasswordAccount(null)}
                    onSubmit={handlePasswordUpdate}
                />
            ) : null}

            {deleteAccount ? (
                <RoverAccountDeleteDialog
                    key={deleteAccount.id}
                    account={deleteAccount}
                    activeSessionCount={
                        activeConnectionsByUsername.get(
                            deleteAccount.username.toLowerCase(),
                        ) ?? deleteAccount.activeSessionCount
                    }
                    onClose={() => setDeleteAccount(null)}
                    onDelete={handleDelete}
                    onDisable={async (account) => {
                        await handleToggleEnabled(account);
                    }}
                />
            ) : null}
        </div>
    );
}

function RoverAccountCard({
    account,
    activeSessionCount,
    loading,
    onEdit,
    onPassword,
    onToggleEnabled,
    onDelete,
    onCopyUsername,
}: {
    account: RoverAccount;
    activeSessionCount: number;
    loading: boolean;
    onEdit: () => void;
    onPassword: () => void;
    onToggleEnabled: () => void;
    onDelete: () => void;
    onCopyUsername: () => void;
}) {
    return (
        <article className="ntrip-card min-w-0 rounded-2xl p-4">
            <header className="flex min-w-0 items-start gap-3">
                <span
                    className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl shadow-ntrip-inset',
                        account.status === 'active'
                            ? 'bg-ntrip-teal/10 text-ntrip-teal'
                            : account.status === 'expired'
                              ? 'bg-ntrip-amber/10 text-ntrip-amber'
                              : 'bg-ntrip-ink/7 text-ntrip-ink/48',
                    )}
                >
                    <CircleUserRound className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate font-mono text-sm font-semibold">
                            {account.username}
                        </h3>
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-2xs font-semibold',
                                statusClass[account.status],
                            )}
                        >
                            {statusLabel[account.status]}
                        </span>
                    </div>
                    <p className="mt-1 truncate text-micro text-ntrip-ink/52">
                        {account.displayName ?? 'No display name'}
                    </p>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={loading}
                            className="size-9 rounded-xl text-ntrip-ink/48 hover:bg-ntrip-cloud/62 hover:text-ntrip-ink"
                            aria-label={`Actions for ${account.username}`}
                        >
                            {loading ? (
                                <RefreshCw className="size-4 animate-spin" />
                            ) : (
                                <MoreHorizontal className="size-4" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="z-[120] min-w-52 border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl"
                    >
                        <DropdownMenuItem onSelect={onEdit}>
                            <ShieldCheck className="size-4" />
                            Edit account and access
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={onPassword}>
                            <KeyRound className="size-4" />
                            Change password
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={onCopyUsername}>
                            <Copy className="size-4" />
                            Copy username
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={onToggleEnabled}>
                            {account.enabled ? (
                                <ShieldOff className="size-4" />
                            ) : (
                                <ShieldCheck className="size-4" />
                            )}
                            {account.enabled
                                ? 'Disable account'
                                : 'Enable account'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={onDelete}
                        >
                            <Trash2 className="size-4" />
                            Delete account
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <CardMetric
                    label="Mountpoints"
                    value={String(account.mountpointCount)}
                    icon={ShieldCheck}
                />
                <CardMetric
                    label="Active sessions"
                    value={String(activeSessionCount)}
                    icon={UsersRound}
                    tone={activeSessionCount > 0 ? 'teal' : 'ink'}
                />
                <CardMetric
                    label="Connection limit"
                    value={String(account.maxConnections)}
                    icon={ShieldCheck}
                />
                <CardMetric
                    label="Expiry"
                    value={account.expiresAt === null ? 'None' : 'Scheduled'}
                    icon={CalendarClock}
                    tone={account.status === 'expired' ? 'amber' : 'ink'}
                />
            </div>

            <dl className="mt-4 grid gap-2 border-t border-ntrip-ink/8 pt-3 text-micro">
                <div className="flex items-start justify-between gap-3">
                    <dt className="text-ntrip-ink/44">Expiry</dt>
                    <dd className="max-w-[65%] text-right font-medium text-ntrip-ink/68">
                        {formatExpiry(account.expiresAt)}
                    </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                    <dt className="text-ntrip-ink/44">Last authenticated</dt>
                    <dd className="max-w-[65%] text-right font-medium text-ntrip-ink/68">
                        {formatDateTime(account.lastAuthenticatedAt)}
                    </dd>
                </div>
            </dl>

            {account.notes ? (
                <p className="mt-3 line-clamp-2 rounded-xl bg-ntrip-cloud/24 px-3 py-2 text-micro leading-relaxed text-ntrip-ink/54">
                    {account.notes}
                </p>
            ) : null}
        </article>
    );
}

function CardMetric({
    label,
    value,
    icon: Icon,
    tone = 'ink',
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    tone?: 'ink' | 'teal' | 'amber';
}) {
    return (
        <div className="min-w-0 rounded-xl border border-white/34 bg-ntrip-cloud/18 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-ntrip-ink/44">
                <Icon className="size-3.5" />
                <p className="truncate text-3xs font-semibold tracking-[0.08em] uppercase">
                    {label}
                </p>
            </div>
            <p
                className={cn(
                    'mt-1 truncate text-sm font-semibold tabular-nums',
                    tone === 'teal' && 'text-ntrip-teal',
                    tone === 'amber' && 'text-ntrip-amber',
                )}
            >
                {value}
            </p>
        </div>
    );
}

function SummaryMetric({
    label,
    value,
    tone = 'ink',
}: {
    label: string;
    value: number;
    tone?: 'ink' | 'teal' | 'amber';
}) {
    return (
        <div className="rounded-xl border border-white/34 bg-ntrip-cloud/24 px-3 py-2.5">
            <p className="text-3xs font-semibold tracking-[0.1em] text-ntrip-ink/40 uppercase">
                {label}
            </p>
            <p
                className={cn(
                    'mt-1 text-base font-semibold tabular-nums',
                    tone === 'teal' && 'text-ntrip-teal',
                    tone === 'amber' && 'text-ntrip-amber',
                )}
            >
                {value}
            </p>
        </div>
    );
}

function AccountLoadingGrid() {
    return (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
                <div
                    key={index}
                    className="ntrip-card rounded-2xl p-4"
                    aria-hidden="true"
                >
                    <div className="flex gap-3">
                        <Skeleton className="size-11 rounded-xl bg-ntrip-ink/7" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-28 rounded bg-ntrip-ink/7" />
                            <Skeleton className="mt-2 h-3 w-36 rounded bg-ntrip-ink/6" />
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        {Array.from({ length: 4 }, (_, metricIndex) => (
                            <Skeleton
                                key={metricIndex}
                                className="h-16 rounded-xl bg-ntrip-ink/6"
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
