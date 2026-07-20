import type { LucideIcon } from 'lucide-react';

import type { StationHealth } from '@/types/ntrip-dashboard';

export type MetricTone = 'ink' | 'teal' | 'amber' | 'coral';

export type DashboardMetric = {
    label: string;
    value: string;
    unit?: string;
    hint: string;
    icon: LucideIcon;
    tone: MetricTone;
    points: number[];
};

export const HEALTH_ORDER: Record<StationHealth, number> = {
    critical: 0,
    warning: 1,
    offline: 2,
    healthy: 3,
};

export const HEALTH_LABELS: Record<StationHealth, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    offline: 'Offline',
};

export const HEALTH_FILTERS = [
    'all',
    'healthy',
    'warning',
    'critical',
    'offline',
] as const;

export type HealthFilter = (typeof HEALTH_FILTERS)[number];
