import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { RoverAccountApiError } from '@/features/rover-accounts/rover-account-api';

import type { RoverAccount } from '@/features/rover-accounts/types';

export function RoverAccountPasswordDialog({
    account,
    onClose,
    onSubmit,
}: {
    account: RoverAccount;
    onClose: () => void;
    onSubmit: (
        accountId: number,
        password: string,
        passwordConfirmation: string,
    ) => Promise<void>;
}) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [passwordError, setPasswordError] = useState<string | undefined>();
    const [confirmationError, setConfirmationError] = useState<
        string | undefined
    >();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (): Promise<void> => {
        let valid = true;

        setPasswordError(undefined);
        setConfirmationError(undefined);
        setSubmitError(null);

        if (password.length < 6) {
            setPasswordError('Password must be at least 6 characters.');
            valid = false;
        }

        if (password !== confirmation) {
            setConfirmationError('Password confirmation does not match.');
            valid = false;
        }

        if (!valid) {
            return;
        }

        setSubmitting(true);

        try {
            await onSubmit(account.id, password, confirmation);
            onClose();
        } catch (reason) {
            if (reason instanceof RoverAccountApiError) {
                setPasswordError(reason.errors.password?.[0]);
                setConfirmationError(reason.errors.password_confirmation?.[0]);
            }

            setSubmitError(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to change the password.',
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
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ntrip-amber/10 text-ntrip-amber shadow-ntrip-inset">
                            <KeyRound className="size-4" />
                        </span>
                        <div>
                            <DialogTitle>Change Rover password</DialogTitle>
                            <DialogDescription className="mt-1 text-ntrip-ink/56">
                                Create a new credential for{' '}
                                <span className="font-mono font-semibold">
                                    {account.username}
                                </span>
                                . NTRIP clients using the old password must be
                                reconfigured.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-4 px-5 py-4">
                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="rover-new-password"
                            className="text-micro font-semibold text-ntrip-ink/64"
                        >
                            New password
                        </Label>
                        <PasswordInput
                            id="rover-new-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            autoComplete="new-password"
                            placeholder="At least 6 characters"
                            className="h-11 rounded-xl border-slate-200 bg-white"
                        />
                        <InputError
                            message={passwordError}
                            className="text-micro"
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="rover-new-password-confirmation"
                            className="text-micro font-semibold text-ntrip-ink/64"
                        >
                            Confirm password
                        </Label>
                        <PasswordInput
                            id="rover-new-password-confirmation"
                            value={confirmation}
                            onChange={(event) =>
                                setConfirmation(event.target.value)
                            }
                            autoComplete="new-password"
                            placeholder="Re-enter the password"
                            className="h-11 rounded-xl border-slate-200 bg-white"
                        />
                        <InputError
                            message={confirmationError}
                            className="text-micro"
                        />
                    </div>

                    {submitError ? (
                        <div className="rounded-xl border border-ntrip-coral/24 bg-ntrip-coral/8 px-3 py-2 text-micro font-medium text-ntrip-coral">
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
                    <Button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className="h-11 rounded-xl bg-ntrip-ink text-ntrip-cloud hover:bg-ntrip-ink/88"
                    >
                        {submitting ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <KeyRound className="size-4" />
                        )}
                        Change password
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
