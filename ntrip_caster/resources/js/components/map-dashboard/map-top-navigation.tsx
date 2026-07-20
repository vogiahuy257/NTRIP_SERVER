import { Link, usePage } from '@inertiajs/react';

import {
    ChevronDown,
    Menu,
    RadioTower,
    X,
} from 'lucide-react';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';
import { AlertNotificationDrawer } from '@/features/alerts/alert-notification-drawer';

const NAVIGATION = [
    {
        label: 'Dashboard',
        href: '/dashboard',
    },
    {
        label: 'Stations',
        href: '/stations',
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
] as const;

/*
 * Dùng đúng một typography và một kích thước cho mọi mục desktop.
 * Không dùng button disabled để tránh khác biệt hiển thị với thẻ Link.
 */
const DESKTOP_NAV_ITEM_CLASS = [
    'inline-flex',
    'h-10',
    'shrink-0',
    'items-center',
    'justify-center',
    'rounded-xl',
    'px-4',
    'font-sans',
    'text-xs',
    'leading-none',
    'font-semibold',
    'transition',
].join(' ');

/*
 * Menu mobile sử dụng vùng bấm lớn hơn desktop.
 */
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

export function MapTopNavigation() {
    const { url } = usePage();

    const {
        isRefreshing,
        error,
        refresh,
        realtimeConnectionState,
        isRealtimeResyncing,
    } = useMapDashboard();

    const currentUrl = url.split('?')[0];

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    /*
     * Đóng menu khi Inertia chuyển sang trang khác.
     */
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [currentUrl]);

    /*
     * Cho phép đóng menu bằng phím Escape.
     */
    useEffect(() => {
        if (!mobileMenuOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [mobileMenuOpen]);

    return (
        <header
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
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
                    onClick={() => {
                        setMobileMenuOpen((currentValue) => !currentValue);
                    }}
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
                    const active =
                        item.href !== null &&
                        isCurrentPage(currentUrl, item.href);

                    return (
                        <Link
                            key={item.label}
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
                            {item.label}
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
                <AlertNotificationDrawer/>

                <button
                    type="button"
                    aria-label="Open user menu"
                    className="flex h-10 items-center gap-2 rounded-xl bg-ntrip-cloud/72 px-2.5 font-sans shadow-ntrip-inset-strong"
                >
                    <span className="grid size-7 place-items-center rounded-xl bg-ntrip-amber/25 text-xs leading-none font-bold">
                        GH
                    </span>

                    <ChevronDown className="size-3.5 text-ntrip-ink/48" />
                </button>
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
                        'z-50',
                        'rounded-2xl',
                        'p-2',
                        'lg:hidden',
                    )}
                >
                    <nav aria-label="Mobile navigation" className="grid gap-1">
                        {NAVIGATION.map((item) => {
                            const active = item.href !== null && isCurrentPage(currentUrl, item.href);

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    preserveScroll
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                    }}
                                    className={cn(
                                        MOBILE_NAV_ITEM_CLASS,
                                        active
                                            ? 'bg-ntrip-cloud/92 text-ntrip-ink shadow-ntrip-inset-strong'
                                            : 'text-ntrip-ink/58 hover:bg-ntrip-cloud/60 hover:text-ntrip-ink',
                                    )}
                                >
                                    <span>{item.label}</span>

                                    {active && (
                                        <span className="size-2 rounded-full bg-ntrip-teal" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            )}
        </header>
    );
}
