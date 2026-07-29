import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, Menu, RadioTower, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { AlertNotificationDrawer } from '@/features/alerts/alert-notification-drawer';
import { usePendingDevices } from '@/features/pending-devices/use-pending-devices';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { edit as editProfile } from '@/routes/profile';

const NAVIGATION = [
    {
        label: 'Dashboard',
        href: '/dashboard',
    },
    {
        label: 'Stations',
        href: '/stations',
        pendingDevices: true,
    },
    {
        label: 'Mountpoints',
        href: '/mountpoints',
    },
    {
        label: 'RTCM Live',
        href: '/rtcm',
    },
    {
        label: 'Sessions',
        href: '/sessions',
    },
    {
        label: 'System',
        href: '/system',
    },
] as const;

const DESKTOP_NAV_ITEM_CLASS = [
    'inline-flex',
    'h-10',
    'shrink-0',
    'items-center',
    'justify-center',
    'gap-2',
    'rounded-xl',
    'px-4',
    'font-sans',
    'text-xs',
    'leading-none',
    'font-semibold',
    'transition',
].join(' ');

const MOBILE_NAV_ITEM_CLASS = [
    'flex',
    'min-h-11',
    'w-full',
    'items-center',
    'justify-between',
    'rounded-xl',
    'px-3',
    'py-2.5',
    'font-sans',
    'text-sm',
    'leading-none',
    'font-semibold',
    'transition',
].join(' ');

type PendingDeviceBadgeProps = {
    count: number;
};

function PendingDeviceBadge({ count }: PendingDeviceBadgeProps) {
    if (count <= 0) {
        return null;
    }

    const displayedCount = count > 99 ? '99+' : String(count);

    return (
        <span
            aria-label={`${count} pending devices`}
            title={`${count} pending devices`}
            className={cn(
                'inline-flex',
                'h-5',
                'min-w-5',
                'shrink-0',
                'items-center',
                'justify-center',
                'rounded-full',
                'border',
                'border-ntrip-amber/35',
                'bg-ntrip-amber/24',
                'px-1.5',
                'font-sans',
                'text-[10px]',
                'leading-none',
                'font-bold',
                'text-ntrip-ink',
                'shadow-ntrip-inset-strong',
            )}
        >
            {displayedCount}
        </span>
    );
}

function isCurrentPage(currentUrl: string, href: string): boolean {
    if (href === '/dashboard') {
        return currentUrl === '/dashboard';
    }

    return currentUrl.startsWith(href);
}

function getRealtimeLabel(
    state:
        'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed',
): string {
    switch (state) {
        case 'connected':
            return 'Realtime connected';

        case 'reconnecting':
            return 'Reconnecting';

        case 'disconnected':
            return 'Realtime offline';

        case 'failed':
            return 'Realtime failed';

        case 'connecting':
        default:
            return 'Connecting';
    }
}

type MobileMenuState = {
    url: string;
    open: boolean;
};

export function MapTopNavigation() {
    const { url, props } = usePage();

    const user = props.auth.user;

    const getInitials = useInitials();

    const {
        isRefreshing,
        error,
        realtimeConnectionState,
        isRealtimeResyncing,
    } = useMapDashboard();

    const { pendingCount } = usePendingDevices();

    const currentUrl = url.split('?')[0];
    const settingsHref = `${editProfile().url}?return=${encodeURIComponent(currentUrl)}`;
    const [mobileMenuState, setMobileMenuState] = useState<MobileMenuState>(
        () => ({
            url: currentUrl,
            open: false,
        }),
    );

    const mobileMenuOpen =
        mobileMenuState.url === currentUrl && mobileMenuState.open;

    const closeMobileMenu = (): void => {
        setMobileMenuState({
            url: currentUrl,
            open: false,
        });
    };

    const toggleMobileMenu = (): void => {
        setMobileMenuState({
            url: currentUrl,
            open: !mobileMenuOpen,
        });
    };

    useEffect(() => {
        if (!mobileMenuOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setMobileMenuState({
                    url: currentUrl,
                    open: false,
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentUrl, mobileMenuOpen]);

    return (
        <header
            onPointerDown={(event) => {
                event.stopPropagation();
            }}
            onDoubleClick={(event) => {
                event.stopPropagation();
            }}
            onWheel={(event) => {
                event.stopPropagation();
            }}
            className={cn('ntrip-glass-panel', [
                'pointer-events-auto',
                'relative',
                'z-50',
                'flex',
                'min-h-14',
                'items-center',
                'overflow-visible',
                'rounded-2xl',
                'px-3',
                'sm:min-h-16',
                'sm:px-4',
            ])}
        >
            <div className="flex min-w-0 shrink-0 items-center gap-2">
                <Link
                    href="/dashboard"
                    className="hidden min-w-0 items-center gap-3 lg:flex"
                    aria-label="Go to dashboard"
                >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-ntrip-ink text-ntrip-cloud">
                        <RadioTower className="size-5" strokeWidth={1.8} />
                    </span>

                    <span className="hidden min-w-0 sm:block">
                        <span className="block truncate text-sm leading-none font-bold tracking-[-0.02em]">
                            NTRIP Caster
                        </span>

                        <span className="mt-1 block truncate text-xs leading-none text-ntrip-ink/48">
                            GNSS correction network
                        </span>
                    </span>
                </Link>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                        mobileMenuOpen
                            ? 'Close navigation menu'
                            : 'Open navigation menu'
                    }
                    aria-controls="ntrip-mobile-navigation"
                    aria-expanded={mobileMenuOpen}
                    onClick={toggleMobileMenu}
                    className="size-10 rounded-xl bg-ntrip-cloud/68 lg:hidden"
                >
                    {mobileMenuOpen ? (
                        <X className="size-4" />
                    ) : (
                        <Menu className="size-4" />
                    )}
                </Button>
            </div>

            <nav
                aria-label="Main navigation"
                className="ml-3 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex"
            >
                {NAVIGATION.map((item) => {
                    const active = isCurrentPage(currentUrl, item.href);

                    const showPendingBadge =
                        'pendingDevices' in item && item.pendingDevices;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            preserveScroll
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                DESKTOP_NAV_ITEM_CLASS,
                                active
                                    ? 'bg-ntrip-cloud/92 text-ntrip-ink shadow-ntrip-inset-strong'
                                    : 'text-ntrip-ink/52 hover:bg-ntrip-cloud/60 hover:text-ntrip-ink',
                            )}
                        >
                            <span>{item.label}</span>

                            {showPendingBadge && (
                                <PendingDeviceBadge count={pendingCount} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2">
                <div className="hidden items-center gap-2 rounded-[12px] bg-[rgb(var(--ntrip-cloud)/0.64)] px-3 py-2 md:flex">
                    <span className="text-xs font-medium text-ntrip-ink/62">
                        {error
                            ? 'API unavailable'
                            : isRealtimeResyncing
                              ? 'Synchronizing'
                              : isRefreshing
                                ? 'Refreshing'
                                : getRealtimeLabel(realtimeConnectionState)}
                    </span>

                    <span
                        className={cn(
                            'size-2 rounded-full',
                            error ||
                                realtimeConnectionState === 'failed' ||
                                realtimeConnectionState === 'disconnected'
                                ? 'bg-ntrip-coral'
                                : isRealtimeResyncing ||
                                    realtimeConnectionState === 'connecting' ||
                                    realtimeConnectionState === 'reconnecting'
                                  ? 'bg-ntrip-amber'
                                  : 'bg-ntrip-teal',
                        )}
                    />
                </div>

                <AlertNotificationDrawer />

                {user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Open user menu"
                                className={cn(
                                    'flex h-10 items-center gap-2 rounded-xl px-2.5 font-sans transition',
                                    'bg-ntrip-cloud/72 shadow-ntrip-inset-strong',
                                    'hover:bg-ntrip-cloud/92',
                                    'focus-visible:ring-2 focus-visible:ring-ntrip-teal/35 focus-visible:outline-none',
                                    'data-[state=open]:bg-ntrip-cloud/92',
                                )}
                            >
                                <span className="grid size-7 place-items-center rounded-xl bg-ntrip-amber/25 text-xs leading-none font-bold">
                                    {getInitials(user.name)}
                                </span>

                                {/* <span className="hidden max-w-28 truncate text-xs font-semibold text-ntrip-ink/68 sm:block">
                                    {user.name}
                                </span> */}

                                <ChevronDown className="size-3.5 text-ntrip-ink/48 transition-transform data-[state=open]:rotate-180" />
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className={cn(
                                'ntrip-glass-panel',
                                'z-[120] w-72 overflow-hidden rounded-2xl',
                                'border-white/42 p-1.5 shadow-ntrip-panel',
                            )}
                        >
                            <UserMenuContent
                                user={user}
                                settingsHref={settingsHref}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>

            {mobileMenuOpen && (
                <div
                    id="ntrip-mobile-navigation"
                    className={cn(
                        'ntrip-glass-panel',
                        'pointer-events-auto',
                        'absolute',
                        'top-[calc(100%+0.5rem)]',
                        'right-0',
                        'left-0',
                        'z-9999',
                        'rounded-2xl',
                        'p-2',
                        'lg:hidden',
                    )}
                >
                    <nav aria-label="Mobile navigation" className="grid gap-1">
                        {NAVIGATION.map((item) => {
                            const active = isCurrentPage(currentUrl, item.href);

                            const showPendingBadge =
                                'pendingDevices' in item && item.pendingDevices;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    preserveScroll
                                    aria-current={active ? 'page' : undefined}
                                    onClick={closeMobileMenu}
                                    className={cn(
                                        MOBILE_NAV_ITEM_CLASS,
                                        active
                                            ? 'bg-ntrip-cloud/92 text-ntrip-ink shadow-ntrip-inset-strong'
                                            : 'text-ntrip-ink/58 hover:bg-ntrip-cloud/60 hover:text-ntrip-ink',
                                    )}
                                >
                                    <span>{item.label}</span>

                                    <span className="flex items-center gap-2">
                                        {showPendingBadge && (
                                            <PendingDeviceBadge
                                                count={pendingCount}
                                            />
                                        )}

                                        {active && (
                                            <span className="size-2 rounded-full bg-ntrip-teal" />
                                        )}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            )}
        </header>
    );
}
