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

export const USER_MENU_SURFACE_CLASS_NAME = [
    'overflow-hidden',
    'rounded-2xl',
    'border',
    'border-white/55',
    'bg-ntrip-cloud/78',
    'p-1',
    'text-ntrip-ink',
    'shadow-ntrip-panel',
    'backdrop-blur-xl',
].join(' ');

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
            <DropdownMenuLabel className="p-1.5 font-normal">
                <div className="flex items-center gap-2.5 rounded-xl bg-ntrip-ink/[0.035] px-2.5 py-2.5 text-left shadow-ntrip-inset">
                    <UserInfo user={user} showEmail />
                </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="mx-2 my-1 bg-ntrip-ink/8" />

            <DropdownMenuGroup className="p-1">
                <DropdownMenuItem
                    asChild
                    className="min-h-9 cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-ntrip-ink/72 focus:bg-ntrip-teal/10 focus:text-ntrip-ink"
                >
                    <Link
                        href={settingsHref ?? edit()}
                        prefetch
                        preserveScroll
                        onClick={cleanup}
                        className="flex w-full items-center gap-2.5"
                    >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ntrip-teal/12 text-ntrip-teal">
                            <Settings className="size-3.5" />
                        </span>

                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="mx-2 my-1 bg-ntrip-ink/8" />

            <div className="p-1">
                <DropdownMenuItem
                    asChild
                    className="min-h-9 cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-ntrip-coral focus:bg-ntrip-coral/10 focus:text-ntrip-coral"
                >
                    <Link
                        href={logout()}
                        as="button"
                        onClick={handleLogout}
                        data-test="logout-button"
                        className="flex w-full items-center gap-2.5 text-left"
                    >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ntrip-coral/10 text-ntrip-coral">
                            <LogOut className="!size-3.5 !text-ntrip-coral" />
                        </span>

                        <span>Log out</span>
                    </Link>
                </DropdownMenuItem>
            </div>
        </>
    );
}
