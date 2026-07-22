import { ShieldOff, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import type { RoverAccount } from '@/features/rover-accounts/types';

export function RoverAccountDeleteDialog({
    account,
    activeSessionCount,
    onClose,
    onDelete,
    onDisable,
}: {
    account: RoverAccount;
    activeSessionCount: number;
    onClose: () => void;
    onDelete: (accountId: number) => Promise<void>;
    onDisable: (account: RoverAccount) => Promise<void>;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const hasActiveSessions = activeSessionCount > 0;

    const runAction = async (action: () => Promise<void>): Promise<void> => {
        setSubmitting(true);
        setSubmitError(null);

        try {
            await action();
            onClose();
        } catch (reason) {
            setSubmitError(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to complete this action.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                surface="default"
                className="max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl"
                overlayClassName="bg-black/45 backdrop-blur-sm"
            >
                <DialogHeader className="border-b border-ntrip-ink/8 px-5 py-4 pr-14">
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-coral/10 text-ntrip-coral shadow-ntrip-inset">
                            <TriangleAlert className="size-4" />
                        </span>
                        <div>
                            <DialogTitle>Delete Rover Account?</DialogTitle>
                            <DialogDescription className="mt-1 text-ntrip-ink/56">
                                The account{' '}
                                <span className="font-mono font-semibold">
                                    {account.username}
                                </span>{' '}
                                will lose all Mountpoint permissions. This
                                action cannot be undone.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-5 py-4">
                    {hasActiveSessions ? (
                        <div className="rounded-2xl border border-ntrip-amber/24 bg-ntrip-amber/8 p-4">
                            <p className="text-sm font-semibold text-ntrip-amber">
                                This account has {activeSessionCount} active
                                connections
                            </p>
                            <p className="mt-1 text-micro leading-relaxed text-ntrip-ink/58">
                                The backend does not allow deleting an account
                                that is currently in use. Disable the account
                                first; existing sessions can be monitored and
                                ended from the Sessions page.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm leading-relaxed text-ntrip-ink/64">
                            NTRIP clients using this username will no longer be
                            able to sign in after the account is deleted.
                        </p>
                    )}

                    {submitError ? (
                        <div className="mt-3 rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2 text-micro font-medium text-ntrip-coral">
                            {submitError}
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={submitting}
                        className="h-11 rounded-xl border-slate-200 bg-white"
                    >
                        Cancel
                    </Button>

                    {hasActiveSessions ? (
                        <Button
                            type="button"
                            onClick={() =>
                                void runAction(() => onDisable(account))
                            }
                            disabled={submitting || !account.enabled}
                            className="h-11 rounded-xl bg-ntrip-amber text-ntrip-ink hover:bg-ntrip-amber/88"
                        >
                            <ShieldOff className="size-4" />
                            Disable account
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={() =>
                                void runAction(() => onDelete(account.id))
                            }
                            disabled={submitting}
                            className="h-11 rounded-xl bg-ntrip-coral text-white hover:bg-ntrip-coral/88"
                        >
                            <Trash2 className="size-4" />
                            Delete permanently
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
