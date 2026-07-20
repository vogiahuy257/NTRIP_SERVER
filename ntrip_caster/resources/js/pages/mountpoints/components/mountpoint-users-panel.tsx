import { CircleUserRound } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { RoverAccountSummary } from '../types';
import { MountpointEmptyState } from './mountpoint-empty-state';

export function MountpointUsersPanel({
    accounts,
}: {
    accounts: RoverAccountSummary[];
}) {
    if (accounts.length === 0) {
        return (
            <MountpointEmptyState
                icon={CircleUserRound}
                title="No rover accounts"
                description="Protected mountpoints and authenticated rover sessions will appear here."
            />
        );
    }

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
                <article
                    key={account.username}
                    className="ntrip-card rounded-control-lg p-4"
                >
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-ink/7 text-ntrip-ink/62">
                            <CircleUserRound className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-sm font-semibold">
                                {account.username}
                            </h2>
                            <p className="mt-1 text-micro text-ntrip-ink/46">
                                {account.mountpointIds.length} assigned
                                mountpoint
                                {account.mountpointIds.length === 1 ? '' : 's'}
                            </p>
                        </div>

                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-2xs font-semibold',
                                account.activeConnections > 0
                                    ? 'bg-ntrip-teal/13 text-ntrip-teal'
                                    : 'bg-ntrip-ink/6 text-ntrip-ink/62',
                            )}
                        >
                            {account.activeConnections} active
                        </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                        {account.mountpointNames.map((mountpointName) => (
                            <span
                                key={mountpointName}
                                className="rounded-full border border-ntrip-ink/8 bg-ntrip-cloud/72 px-2.5 py-1 font-mono text-2xs text-ntrip-ink/55"
                            >
                                {mountpointName}
                            </span>
                        ))}
                    </div>
                </article>
            ))}
        </div>
    );
}
