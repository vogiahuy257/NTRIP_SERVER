import { useCallback, useEffect, useState } from 'react';

import {
    createRoverAccount,
    deleteRoverAccount,
    fetchRoverAccount,
    fetchRoverAccounts,
    syncRoverAccountMountpoints,
    updateRoverAccount,
} from './rover-account-api';

import type {
    RoverAccount,
    RoverAccountCreateInput,
    RoverAccountMountpointGrantInput,
    RoverAccountUpdateInput,
} from './types';

function isAbortError(reason: unknown): boolean {
    return reason instanceof DOMException && reason.name === 'AbortError';
}

function formatError(reason: unknown): string {
    return reason instanceof Error
        ? reason.message
        : 'Unable to load Rover Accounts.';
}

export function useRoverAccounts() {
    const [accounts, setAccounts] = useState<RoverAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const replaceAccount = useCallback((nextAccount: RoverAccount): void => {
        setAccounts((currentAccounts) =>
            currentAccounts
                .map((account) =>
                    account.id === nextAccount.id ? nextAccount : account,
                )
                .concat(
                    currentAccounts.some(
                        (account) => account.id === nextAccount.id,
                    )
                        ? []
                        : [nextAccount],
                )
                .sort((left, right) =>
                    left.username.localeCompare(right.username),
                ),
        );
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        void fetchRoverAccounts(controller.signal)
            .then((items) => {
                if (!controller.signal.aborted) {
                    setAccounts(items);
                    setError(null);
                }
            })
            .catch((reason: unknown) => {
                if (!controller.signal.aborted && !isAbortError(reason)) {
                    setError(formatError(reason));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, []);

    const refresh = useCallback(async (): Promise<void> => {
        setIsRefreshing(true);

        try {
            const items = await fetchRoverAccounts();

            setAccounts(items);
            setError(null);
        } catch (reason) {
            setError(formatError(reason));

            throw reason;
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    const loadAccount = useCallback(
        async (accountId: number): Promise<RoverAccount> =>
            fetchRoverAccount(accountId),
        [],
    );

    const createAccount = useCallback(
        async (
            input: RoverAccountCreateInput,
            grants: RoverAccountMountpointGrantInput[],
        ): Promise<RoverAccount> => {
            const created = await createRoverAccount(input);

            try {
                await syncRoverAccountMountpoints(created.id, grants);
            } catch (reason) {
                try {
                    await deleteRoverAccount(created.id);
                } catch {
                    /*
                     * If HTTP rollback fails, the next refresh will show the
                     * created account so the operator can resolve it.
                     */
                }

                throw reason;
            }

            const completeAccount = await fetchRoverAccount(created.id);
            replaceAccount(completeAccount);

            return completeAccount;
        },
        [replaceAccount],
    );

    const updateAccount = useCallback(
        async (
            accountId: number,
            input: RoverAccountUpdateInput,
            grants?: RoverAccountMountpointGrantInput[],
        ): Promise<RoverAccount> => {
            await updateRoverAccount(accountId, input);

            if (grants !== undefined) {
                await syncRoverAccountMountpoints(accountId, grants);
            }

            const completeAccount = await fetchRoverAccount(accountId);
            replaceAccount(completeAccount);

            return completeAccount;
        },
        [replaceAccount],
    );

    const removeAccount = useCallback(
        async (accountId: number): Promise<void> => {
            await deleteRoverAccount(accountId);
            setAccounts((currentAccounts) =>
                currentAccounts.filter((account) => account.id !== accountId),
            );
        },
        [],
    );

    return {
        accounts,
        isLoading,
        isRefreshing,
        error,
        refresh,
        loadAccount,
        createAccount,
        updateAccount,
        removeAccount,
    };
}
