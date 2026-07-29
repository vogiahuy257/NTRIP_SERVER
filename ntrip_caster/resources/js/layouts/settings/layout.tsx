import { Link, router, usePage } from '@inertiajs/react';
import { Palette, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren } from 'react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

type SettingsNavigationItem = {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
};

const SETTINGS_NAVIGATION: SettingsNavigationItem[] = [
    {
        title: 'Profile',
        description: 'Name, email and account',
        href: editProfile().url,
        icon: UserRound,
    },
    {
        title: 'Security',
        description: 'Password, 2FA and passkeys',
        href: editSecurity().url,
        icon: ShieldCheck,
    },
    // {
    //     title: 'Appearance',
    //     description: 'Theme and display mode',
    //     href: editAppearance().url,
    //     icon: Palette,
    // },
];

function resolveReturnUrl(pageUrl: string): string {
    const queryString = pageUrl.split('?')[1] ?? '';

    const requestedReturnUrl = new URLSearchParams(queryString).get('return');

    if (
        requestedReturnUrl === null ||
        !requestedReturnUrl.startsWith('/') ||
        requestedReturnUrl.startsWith('//') ||
        requestedReturnUrl.startsWith('/settings')
    ) {
        return '/dashboard';
    }

    return requestedReturnUrl;
}

function appendReturnUrl(href: string, returnUrl: string): string {
    const separator = href.includes('?') ? '&' : '?';

    return `${href}${separator}return=${encodeURIComponent(returnUrl)}`;
}

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { url, props } = usePage();

    const user = props.auth.user;

    const currentPath = url.split('?')[0];

    const returnUrl = resolveReturnUrl(url);

    const closeSettings = (): void => {
        router.visit(returnUrl, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    closeSettings();
                }
            }}
        >
            <DialogContent
                surface="glass"
                overlayClassName="bg-ntrip-ink/30 backdrop-blur-[3px]"
                className={cn(
                    'bg-[rgb(var(--ntrip-cloud)/0.64)]',
                    'h-[min(48rem,calc(100dvh-1rem))]',
                    'w-[calc(100%-1rem)] max-w-5xl',
                    'grid-rows-[auto_minmax(0,1fr)] gap-0',
                    'rounded-2xl sm:rounded-3xl',
                )}
            >
                <DialogHeader className="border-b border-ntrip-ink/8 px-4 py-4 pr-14 sm:px-5 sm:py-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ntrip-ink text-ntrip-cloud">
                            <Settings2 className="size-5" strokeWidth={1.8} />
                        </span>

                        <div className="min-w-0">
                            <DialogTitle className="text-left text-xl tracking-[-0.035em]">
                                Account Settings
                            </DialogTitle>

                            <DialogDescription className="mt-1 text-left text-micro leading-5 text-ntrip-ink/52">
                                Manage your profile, account security and
                                interface preferences.
                            </DialogDescription>

                            {user ? (
                                <p className="mt-2 truncate text-micro font-medium text-ntrip-teal">
                                    {user.name}
                                    <span className="mx-1.5 text-ntrip-ink/24">
                                        ·
                                    </span>
                                    <span className="text-ntrip-ink/48">
                                        {user.email}
                                    </span>
                                </p>
                            ) : null}
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[14rem_minmax(0,1fr)] md:grid-rows-1">
                    <aside className="border-b border-ntrip-ink/8 p-2.5 md:border-r md:border-b-0 md:p-3">
                        <nav
                            aria-label="Settings navigation"
                            className="flex gap-2 overflow-x-auto md:grid md:overflow-visible"
                        >
                            {SETTINGS_NAVIGATION.map((item) => {
                                const active = currentPath === item.href;

                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.href}
                                        href={appendReturnUrl(
                                            item.href,
                                            returnUrl,
                                        )}
                                        preserveScroll
                                        preserveState
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'group flex min-w-44 shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition md:min-w-0',
                                            active
                                                ? 'bg-ntrip-cloud/88 text-ntrip-ink shadow-ntrip-inset-strong'
                                                : 'text-ntrip-ink/52 hover:bg-ntrip-cloud/52 hover:text-ntrip-ink',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'grid size-9 shrink-0 place-items-center rounded-xl transition',
                                                active
                                                    ? 'bg-ntrip-teal/13 text-ntrip-teal'
                                                    : 'bg-ntrip-ink/6 text-ntrip-ink/48 group-hover:text-ntrip-teal',
                                            )}
                                        >
                                            <Icon className="size-4" />
                                        </span>

                                        <span className="min-w-0">
                                            <span className="block text-caption font-semibold">
                                                {item.title}
                                            </span>

                                            <span className="mt-0.5 hidden truncate text-micro text-ntrip-ink/42 md:block">
                                                {item.description}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </aside>

                    <div
                        className={cn(
                            'min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5',
                            '[&_input]:rounded-xl',
                            '[&_input]:border-white/42',
                            '[&_input]:bg-ntrip-cloud/46',
                            '[&_input]:shadow-ntrip-inset',
                            '[&_button]:rounded-xl',
                            '[&_label]:text-xs',
                            '[&_label]:font-semibold',
                            '[&_label]:text-ntrip-ink/68',
                        )}
                    >
                        <div className="mx-auto w-full max-w-2xl">
                            {children}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
