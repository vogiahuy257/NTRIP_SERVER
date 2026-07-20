import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { configureEcho } from '@laravel/echo-react';

import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import MapDashboardLayout from '@/layouts/map-dashboard-layout';

configureEcho({
    broadcaster: 'reverb',
});

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const MAP_DASHBOARD_PAGE_PREFIXES = [
    'dashboard',
    'stations',
    'mountpoints',
    'rtcm',
    'sessions',
] as const;

function usesMapDashboardLayout(name: string): boolean {
    return MAP_DASHBOARD_PAGE_PREFIXES.some(
        (prefix) => name === prefix || name.startsWith(`${prefix}/`),
    );
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;

            case name.startsWith('auth/'):
                return AuthLayout;

            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];

            case usesMapDashboardLayout(name):
                return MapDashboardLayout;

            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
