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
    'w-64',
    'overflow-hidden',
    'rounded-2xl',
    'border',
    'border-black/10',
    'bg-white/70',
    'p-1.5',
    'text-black',
    'shadow-[0_18px_50px_rgba(0,0,0,0.16)]',
    'backdrop-blur-2xl',
    'backdrop-saturate-150',
].join(' ');

type UserMenuContentProps = {
    user: User;
    settingsHref?: string;
};

const MENU_ITEM_CLASS_NAME = [
    'min-h-10',
    'cursor-pointer',
    'rounded-xl',
    'px-2.5',
    'py-2',
    'text-xs',
    'font-semibold',
    'text-black/70',
    'outline-none',
    'transition-colors',
    'focus:bg-black/[0.06]',
    'focus:text-black',
    'data-[highlighted]:bg-black/[0.06]',
    'data-[highlighted]:text-black',
].join(' ');

const MENU_ICON_CLASS_NAME = [
    'grid',
    'size-7',
    'shrink-0',
    'place-items-center',
    'rounded-lg',
    'border',
    'border-black/[0.06]',
    'bg-white/55',
    'text-black/55',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]',
].join(' ');

export function UserMenuContent({ user, settingsHref }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();

    const handleLogout = (): void => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-1 font-normal">
                <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/45 px-2.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <UserInfo user={user} showEmail />
                </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="mx-2 my-1.5 bg-black/[0.08]" />

            <DropdownMenuGroup className="p-1">
                <DropdownMenuItem asChild className={MENU_ITEM_CLASS_NAME}>
                    <Link
                        href={settingsHref ?? edit()}
                        prefetch
                        preserveScroll
                        onClick={cleanup}
                        className="flex w-full items-center gap-2.5"
                    >
                        <span className={MENU_ICON_CLASS_NAME}>
                            <Settings className="size-3.5" />
                        </span>

                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="mx-2 my-1.5 bg-black/[0.08]" />

            <div className="p-1">
                <DropdownMenuItem asChild className={MENU_ITEM_CLASS_NAME}>
                    <Link
                        href={logout()}
                        as="button"
                        onClick={handleLogout}
                        data-test="logout-button"
                        className="flex w-full items-center gap-2.5 text-left"
                    >
                        <span className={MENU_ICON_CLASS_NAME}>
                            <LogOut className="size-3.5" />
                        </span>

                        <span>Log out</span>
                    </Link>
                </DropdownMenuItem>
            </div>
        </>
    );
}
