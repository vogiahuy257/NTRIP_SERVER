import { Link, router } from '@inertiajs/react';
import { LogOut, Settings } from 'lucide-react';

import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import { edit } from '@/routes/profile';
import type { User } from '@/types';

type UserMenuContentProps = {
    user: User;
    settingsHref?: string;
};

export function UserMenuContent({ user, settingsHref }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();

    const handleLogout = (): void => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-2 font-normal">
                <div className="flex items-center gap-2 rounded-xl bg-ntrip-cloud/42 px-2.5 py-2 text-left">
                    <UserInfo user={user} showEmail />
                </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="mx-2 bg-ntrip-ink/8" />

            <DropdownMenuGroup className="p-1">
                <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-xl px-3 py-2.5 text-caption font-semibold focus:bg-ntrip-cloud/72"
                >
                    <Link
                        href={settingsHref ?? edit()}
                        prefetch
                        preserveScroll
                        onClick={cleanup}
                        className="flex w-full items-center"
                    >
                        <Settings className="size-4 text-ntrip-teal" />

                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="mx-2 bg-ntrip-ink/8" />

            <div className="p-1">
                <DropdownMenuItem
                    asChild
                    variant="destructive"
                    className="cursor-pointer rounded-xl px-3 py-2.5 text-caption font-semibold"
                >
                    <Link
                        href={logout()}
                        as="button"
                        onClick={handleLogout}
                        data-test="logout-button"
                        className="flex w-full items-center text-left"
                    >
                        <LogOut className="size-4" />

                        <span>Log out</span>
                    </Link>
                </DropdownMenuItem>
            </div>
        </>
    );
}
