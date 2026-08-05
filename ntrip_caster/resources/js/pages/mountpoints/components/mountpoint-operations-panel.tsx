import {
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    Copy,
    Globe2,
    KeyRound,
    LockKeyhole,
    MoreHorizontal,
    Plus,
    RadioTower,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldOff,
    Trash2,
} from 'lucide-react';
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
import type {
    RoverAccount,
    RoverAccountCreateInput,
    RoverAccountMountpointGrantInput,
    RoverAccountUpdateInput,
} from '@/features/rover-accounts/types';
import type { useRoverAccounts } from '@/features/rover-accounts/use-rover-accounts';
import { cn } from '@/lib/utils';

import { formatBitrate } from '../lib/mountpoint-data';
import type {
    ActiveSession,
    MountpointStatus,
    MountpointWithSessions,
} from '../types';
import type { SelectedTopologyEntity } from './mountpoint-topology-panel';
import { RoverAccountDeleteDialog } from './rover-account-delete-dialog';
import { RoverAccountFormDialog } from './rover-account-form-dialog';
import { RoverAccountPasswordDialog } from './rover-account-password-dialog';

export type MountpointWorkbenchStatusFilter = 'all' | MountpointStatus;

type RoverAccountsStore = ReturnType<typeof useRoverAccounts>;

type EditorState =
    { mode: 'create'; account: null } | { mode: 'edit'; account: RoverAccount };

type MountpointOperationsPanelProps = {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    mountpoints: MountpointWithSessions[];
    visibleMountpoints: MountpointWithSessions[];
    autoSessions: ActiveSession[];
    accounts: RoverAccount[];
    roverAccounts: RoverAccountsStore;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    statusFilter: MountpointWorkbenchStatusFilter;
    onStatusFilterChange: (filter: MountpointWorkbenchStatusFilter) => void;
    selectedEntity: SelectedTopologyEntity;
    onSelectEntity: (entity: SelectedTopologyEntity) => void;
    updatingAccessModeIds: ReadonlySet<string>;
    onAnonymousAccessChange: (
        mountpointId: string,
        anonymousEnabled: boolean,
    ) => void | Promise<void>;
};

const statusLabels: Record<MountpointStatus, string> = {
    online: 'Online',
    'waiting-source': 'Waiting',
    degraded: 'Degraded',
    disabled: 'Disabled',
};

const accountStatusClass: Record<RoverAccount['status'], string> = {
    active: 'bg-ntrip-teal/12 text-ntrip-teal',
    disabled: 'bg-ntrip-ink/7 text-ntrip-ink/48',
    expired: 'bg-ntrip-amber/12 text-ntrip-amber',
};

function normalize(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? '';
}

export function MountpointOperationsPanel({
    collapsed,
    onCollapsedChange,
    mountpoints,
    visibleMountpoints,
    autoSessions,
    accounts,
    roverAccounts,
    searchQuery,
    onSearchQueryChange,
    statusFilter,
    onStatusFilterChange,
    selectedEntity,
    onSelectEntity,
    updatingAccessModeIds,
    onAnonymousAccessChange,
}: MountpointOperationsPanelProps) {
    const {
        isLoading,
        isRefreshing,
        refresh,
        loadAccount,
        createAccount,
        updateAccount,
        removeAccount,
    } = roverAccounts;

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
        const result = new Map<string, number>();
        const sessions = [
            ...mountpoints.flatMap((mountpoint) => mountpoint.sessions),
            ...autoSessions,
        ];

        for (const session of sessions) {
            const username = normalize(session.username);

            if (username !== '') {
                result.set(username, (result.get(username) ?? 0) + 1);
            }
        }

        return result;
    }, [autoSessions, mountpoints]);

    const filteredAccounts = useMemo(() => {
        const query = normalize(searchQuery);

        if (query === '') {
            return accounts;
        }

        return accounts.filter((account) =>
            [account.username, account.displayName, account.notes].some(
                (value) => normalize(value).includes(query),
            ),
        );
    }, [accounts, searchQuery]);

    const accountCountByMountpointId = useMemo(() => {
        const result = new Map<string, number>();

        for (const account of accounts) {
            for (const mountpoint of account.mountpoints) {
                const id = String(mountpoint.id);
                result.set(id, (result.get(id) ?? 0) + 1);
            }
        }

        return result;
    }, [accounts]);

    const handleEdit = async (account: RoverAccount): Promise<void> => {
        setLoadingAccountId(account.id);

        try {
            const completeAccount = await loadAccount(account.id);
            setEditor({ mode: 'edit', account: completeAccount });
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

    const handleCopyUsername = async (username: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(username);
            toast.success('Username copied.');
        } catch {
            toast.error('Unable to copy the username.');
        }
    };

    if (collapsed) {
        return (
            <aside className="pointer-events-auto absolute top-3 bottom-3 left-3 z-30 flex w-13 flex-col items-center gap-2 rounded-2xl border border-white/38 bg-ntrip-cloud/78 p-2 shadow-ntrip-panel backdrop-blur-2xl">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onCollapsedChange(false)}
                    className="size-9 rounded-xl"
                    aria-label="Open mountpoint operations"
                >
                    <ChevronRight className="size-4" />
                </Button>

                <div className="h-px w-7 bg-ntrip-ink/8" />

                <span
                    className="grid size-9 place-items-center rounded-xl bg-ntrip-teal/10 text-ntrip-teal"
                    title={`${visibleMountpoints.length} mountpoints shown`}
                >
                    <RadioTower className="size-4" />
                </span>

                <span
                    className="grid size-9 place-items-center rounded-xl bg-ntrip-ink/6 text-ntrip-ink/60"
                    title={`${accounts.length} Rover Accounts`}
                >
                    <CircleUserRound className="size-4" />
                </span>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditor({ mode: 'create', account: null })}
                    className="mt-auto size-9 rounded-xl bg-ntrip-ink text-ntrip-cloud hover:bg-ntrip-ink/86 hover:text-ntrip-cloud"
                    aria-label="Add Rover Account"
                >
                    <Plus className="size-4" />
                </Button>

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
            </aside>
        );
    }

    return (
        <>
            <aside className="pointer-events-auto absolute top-3 bottom-3 left-3 z-30 grid min-h-0 w-[20.5rem] grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,0.85fr)] overflow-hidden rounded-2xl border border-white/42 bg-ntrip-cloud/82 shadow-ntrip-panel backdrop-blur-2xl">
                <header className="flex items-center gap-2 border-b border-ntrip-ink/8 px-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ntrip-ink text-ntrip-cloud">
                        <RadioTower className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-sm font-semibold tracking-[-0.02em]">
                            Network operations
                        </h1>
                        <p className="text-2xs text-ntrip-ink/46">
                            Mountpoints and Rover access
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onCollapsedChange(true)}
                        className="size-9 rounded-xl"
                        aria-label="Collapse mountpoint operations"
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                </header>

                <div className="space-y-2 border-b border-ntrip-ink/8 p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/36" />
                        <Input
                            value={searchQuery}
                            onChange={(event) =>
                                onSearchQueryChange(event.target.value)
                            }
                            placeholder="Search network or Rover"
                            className="h-9 rounded-xl border-ntrip-ink/9 bg-ntrip-cloud/72 pl-9 text-micro"
                        />
                    </div>

                    <div className="flex gap-1 overflow-x-auto pb-0.5">
                        {(
                            [
                                ['all', 'All'],
                                ['online', 'Online'],
                                ['waiting-source', 'Waiting'],
                                ['degraded', 'Degraded'],
                                ['disabled', 'Disabled'],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onStatusFilterChange(value)}
                                className={cn(
                                    'h-7 shrink-0 rounded-lg px-2.5 text-2xs font-semibold transition',
                                    statusFilter === value
                                        ? 'bg-ntrip-ink text-ntrip-cloud'
                                        : 'bg-ntrip-ink/5 text-ntrip-ink/48 hover:bg-ntrip-ink/8 hover:text-ntrip-ink',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <section className="min-h-0 overflow-hidden border-b border-ntrip-ink/8">
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                        <div>
                            <p className="text-3xs font-semibold tracking-[0.12em] text-ntrip-ink/38 uppercase">
                                Mountpoints
                            </p>
                            <p className="mt-0.5 text-2xs text-ntrip-ink/44">
                                {visibleMountpoints.length} shown
                            </p>
                        </div>
                    </div>

                    <div className="h-[calc(100%-3.15rem)] space-y-1 overflow-y-auto px-2 pb-3">
                        {autoSessions.length > 0 ? (
                            <button
                                type="button"
                                onClick={() =>
                                    onSelectEntity({
                                        kind: 'mountpoint',
                                        entityId: 'AUTO',
                                        name: 'AUTO',
                                        identifier: 'Virtual router',
                                        status: 'waiting-source',
                                        registeredRoverCount: new Set(
                                            autoSessions
                                                .map(
                                                    (session) =>
                                                        session.username,
                                                )
                                                .filter(Boolean),
                                        ).size,
                                        connectedRoverCount:
                                            autoSessions.length,
                                        bitrate: 'Waiting for Base',
                                    })
                                }
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition',
                                    selectedEntity?.kind === 'mountpoint' &&
                                        selectedEntity.entityId === 'AUTO'
                                        ? 'border-ntrip-teal/35 bg-ntrip-teal/10 shadow-ntrip-inset'
                                        : 'border-ntrip-teal/16 bg-ntrip-teal/6 hover:bg-ntrip-teal/10',
                                )}
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ntrip-teal/12 text-ntrip-teal">
                                    <RadioTower className="size-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                        <span className="font-mono text-micro font-semibold">
                                            AUTO
                                        </span>
                                        <span className="rounded-full bg-ntrip-amber/12 px-1.5 py-0.5 text-[8px] font-semibold text-ntrip-amber">
                                            {autoSessions.length} waiting
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block text-3xs text-ntrip-ink/44">
                                        Virtual mountpoint · no Base assigned
                                    </span>
                                </span>
                            </button>
                        ) : null}

                        {visibleMountpoints.length === 0 &&
                        autoSessions.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-ntrip-ink/10 px-3 py-5 text-center text-micro text-ntrip-ink/44">
                                No matching mountpoints
                            </p>
                        ) : (
                            visibleMountpoints.map((mountpoint) => {
                                const selected =
                                    selectedEntity?.kind === 'mountpoint' &&
                                    selectedEntity.entityId === mountpoint.id;
                                const anonymous =
                                    mountpoint.accessMode === 'public';
                                const updating = updatingAccessModeIds.has(
                                    mountpoint.id,
                                );

                                const selectMountpoint = (): void => {
                                    onSelectEntity({
                                        kind: 'mountpoint',
                                        entityId: mountpoint.id,
                                        name: mountpoint.name,
                                        identifier: mountpoint.identifier,
                                        status: mountpoint.status,
                                        registeredRoverCount:
                                            accountCountByMountpointId.get(
                                                mountpoint.id,
                                            ) ?? 0,
                                        connectedRoverCount:
                                            mountpoint.roverCount,
                                        bitrate: formatBitrate(
                                            mountpoint.uploadBps,
                                        ),
                                    });
                                };

                                return (
                                    <div
                                        key={mountpoint.id}
                                        className={cn(
                                            'group flex w-full items-center gap-1 rounded-xl border p-1 transition',
                                            selected
                                                ? 'border-ntrip-teal/35 bg-ntrip-teal/10 shadow-ntrip-inset'
                                                : 'border-transparent bg-ntrip-cloud/24 hover:border-ntrip-ink/7 hover:bg-ntrip-cloud/58',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={selectMountpoint}
                                            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left"
                                        >
                                            <span
                                                data-status={mountpoint.status}
                                                className="ntrip-status-inline shrink-0"
                                            >
                                                <span className="ntrip-status-inline__dot block size-2 rounded-full" />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="truncate font-mono text-micro font-semibold">
                                                        {mountpoint.name}
                                                    </span>
                                                    <span className="shrink-0 text-3xs text-ntrip-ink/38">
                                                        {mountpoint.roverCount}{' '}
                                                        R
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 flex items-center gap-1.5 text-3xs text-ntrip-ink/44">
                                                    <span className="truncate">
                                                        {mountpoint.station
                                                            ?.name ??
                                                            'No station'}
                                                    </span>
                                                    <span>·</span>
                                                    <span className="shrink-0">
                                                        {
                                                            statusLabels[
                                                                mountpoint
                                                                    .status
                                                            ]
                                                        }
                                                    </span>
                                                </span>
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={updating}
                                            aria-label={
                                                anonymous
                                                    ? `Require login for ${mountpoint.name}`
                                                    : `Allow anonymous access for ${mountpoint.name}`
                                            }
                                            onClick={() =>
                                                void onAnonymousAccessChange(
                                                    mountpoint.id,
                                                    !anonymous,
                                                )
                                            }
                                            className={cn(
                                                'grid size-8 shrink-0 place-items-center rounded-lg transition',
                                                anonymous
                                                    ? 'bg-ntrip-teal/10 text-ntrip-teal'
                                                    : 'bg-ntrip-ink/6 text-ntrip-ink/46',
                                                updating &&
                                                    'animate-pulse opacity-50',
                                            )}
                                        >
                                            {anonymous ? (
                                                <Globe2 className="size-3.5" />
                                            ) : (
                                                <LockKeyhole className="size-3.5" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                <section className="min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                        <div>
                            <p className="text-3xs font-semibold tracking-[0.12em] text-ntrip-ink/38 uppercase">
                                Rover accounts
                            </p>
                            <p className="mt-0.5 text-2xs text-ntrip-ink/44">
                                {filteredAccounts.length} shown
                            </p>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
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
                                className="size-8 rounded-lg"
                                aria-label="Refresh Rover Accounts"
                            >
                                <RefreshCw
                                    className={cn(
                                        'size-3.5',
                                        isRefreshing && 'animate-spin',
                                    )}
                                />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                onClick={() =>
                                    setEditor({
                                        mode: 'create',
                                        account: null,
                                    })
                                }
                                className="size-8 rounded-lg bg-ntrip-ink text-ntrip-cloud hover:bg-ntrip-ink/86"
                                aria-label="Add Rover Account"
                            >
                                <Plus className="size-3.5" />
                            </Button>
                        </div>
                    </div>

                    <div className="h-[calc(100%-3.15rem)] space-y-1 overflow-y-auto px-2 pb-3">
                        {isLoading ? (
                            <div className="grid place-items-center py-8 text-micro text-ntrip-ink/44">
                                <RefreshCw className="mb-2 size-4 animate-spin" />
                                Loading Rover Accounts
                            </div>
                        ) : filteredAccounts.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-ntrip-ink/10 px-3 py-5 text-center text-micro text-ntrip-ink/44">
                                No matching Rover Accounts
                            </p>
                        ) : (
                            filteredAccounts.map((account) => {
                                const activeSessions =
                                    activeConnectionsByUsername.get(
                                        normalize(account.username),
                                    ) ?? account.activeSessionCount;
                                const loading = loadingAccountId === account.id;

                                return (
                                    <div
                                        key={account.id}
                                        className="flex items-center gap-2 rounded-xl border border-transparent bg-ntrip-cloud/24 px-2.5 py-2 hover:border-ntrip-ink/7 hover:bg-ntrip-cloud/58"
                                    >
                                        <span
                                            className={cn(
                                                'grid size-8 shrink-0 place-items-center rounded-lg',
                                                accountStatusClass[
                                                    account.status
                                                ],
                                            )}
                                        >
                                            <CircleUserRound className="size-3.5" />
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleEdit(account)
                                            }
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="truncate font-mono text-micro font-semibold">
                                                    {account.username}
                                                </span>
                                                {activeSessions > 0 ? (
                                                    <span className="shrink-0 rounded-full bg-ntrip-teal/10 px-1.5 py-0.5 text-3xs font-semibold text-ntrip-teal">
                                                        {activeSessions} live
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span className="mt-0.5 block truncate text-3xs text-ntrip-ink/44">
                                                {account.displayName ??
                                                    `${account.mountpointCount} mountpoints`}
                                            </span>
                                        </button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={loading}
                                                    className="size-8 rounded-lg"
                                                    aria-label={`Actions for ${account.username}`}
                                                >
                                                    {loading ? (
                                                        <RefreshCw className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <MoreHorizontal className="size-3.5" />
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="z-[120] min-w-52 border-white/42 bg-ntrip-cloud/96 backdrop-blur-xl"
                                            >
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        void handleEdit(account)
                                                    }
                                                >
                                                    <ShieldCheck className="size-4" />
                                                    Edit account and access
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        setPasswordAccount(
                                                            account,
                                                        )
                                                    }
                                                >
                                                    <KeyRound className="size-4" />
                                                    Change password
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        void handleCopyUsername(
                                                            account.username,
                                                        )
                                                    }
                                                >
                                                    <Copy className="size-4" />
                                                    Copy username
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        void handleToggleEnabled(
                                                            account,
                                                        ).catch(
                                                            (reason: unknown) =>
                                                                toast.error(
                                                                    reason instanceof
                                                                        Error
                                                                        ? reason.message
                                                                        : 'Unable to update the account.',
                                                                ),
                                                        )
                                                    }
                                                >
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
                                                    onSelect={() =>
                                                        setDeleteAccount(
                                                            account,
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                    Delete account
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </aside>

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
                            normalize(deleteAccount.username),
                        ) ?? deleteAccount.activeSessionCount
                    }
                    onClose={() => setDeleteAccount(null)}
                    onDelete={async (accountId) => {
                        await removeAccount(accountId);
                        toast.success('Deleted the Rover Account.');
                    }}
                    onDisable={handleToggleEnabled}
                />
            ) : null}
        </>
    );
}
