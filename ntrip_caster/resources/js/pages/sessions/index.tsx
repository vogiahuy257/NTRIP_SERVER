import { Head } from '@inertiajs/react';

import { Activity, RadioTower, RefreshCw, Router, Search } from 'lucide-react';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';

import { SessionDetailPanel } from './components/session-detail-panel';
import { SessionList } from './components/session-list';

import {
    useSessionHistory,
    type SessionTypeFilter,
} from './hooks/use-session-history';

import type { DashboardSession } from '@/types/ntrip-dashboard';

type PageTab = 'active' | 'history';

function matchesSearch(session: DashboardSession, query: string): boolean {
    if (query === '') {
        return true;
    }

    return [
        session.authenticatedUsername ?? '',
        session.remoteIp ?? '',
        session.clientAgent ?? '',
        session.ntripVersion ?? '',
        session.mountpoint?.name ?? '',
        session.mountpoint?.station?.name ?? '',
    ].some((value) => value.toLowerCase().includes(query));
}

export default function SessionsIndex() {
    const {
        activeSessionItems,
        refresh,
        isRefreshing,
        realtimeConnectionState,
    } = useMapDashboard();

    const [activeTab, setActiveTab] = useState<PageTab>('active');

    const [typeFilter, setTypeFilter] = useState<SessionTypeFilter>('all');

    const [searchQuery, setSearchQuery] = useState('');

    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
        null,
    );

    const deferredSearch = useDeferredValue(searchQuery);

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(intervalId);
    }, []);

    const history = useSessionHistory({
        enabled: activeTab === 'history',

        type: typeFilter,

        search: deferredSearch,
    });

    const activeSessions = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();

        return activeSessionItems.filter((session) => {
            if (typeFilter !== 'all' && session.connectionType !== typeFilter) {
                return false;
            }

            return matchesSearch(session, query);
        });
    }, [activeSessionItems, deferredSearch, typeFilter]);

    const visibleSessions =
        activeTab === 'active' ? activeSessions : history.items;

    const selectedSession =
        visibleSessions.find(
            (session) => String(session.id) === selectedSessionId,
        ) ?? null;

    useEffect(() => {
        if (selectedSessionId !== null && selectedSession === null) {
            setSelectedSessionId(null);
        }
    }, [selectedSession, selectedSessionId]);

    const activeRovers = activeSessionItems.filter(
        (session) => session.connectionType === 'rover',
    ).length;

    const activeSources = activeSessionItems.filter(
        (session) => session.connectionType === 'source',
    ).length;

    const loading = activeTab === 'active' ? isRefreshing : history.isLoading;

    const visibleError = activeTab === 'history' ? history.error : null;

    return (
        <>
            <Head title="NTRIP Sessions" />

            <div className="pointer-events-none absolute inset-0 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                <header className="ntrip-glass-panel-strong pointer-events-auto rounded-3xl px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-micro font-semibold text-ntrip-teal">
                                NTRIP network
                            </p>

                            <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.04em]">
                                Sessions
                            </h1>

                            <p className="mt-1 flex items-center gap-1.5 text-micro text-ntrip-ink/46">
                                <span
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        realtimeConnectionState === 'connected'
                                            ? 'bg-ntrip-teal'
                                            : 'bg-ntrip-amber',
                                    )}
                                />
                                Active connections update in realtime
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <SummaryMetric
                                label="Active"
                                value={activeSessionItems.length}
                                icon={Activity}
                            />

                            <SummaryMetric
                                label="Sources"
                                value={activeSources}
                                icon={RadioTower}
                            />

                            <SummaryMetric
                                label="Rovers"
                                value={activeRovers}
                                icon={Router}
                            />
                        </div>
                    </div>
                </header>

                <section className="ntrip-glass-panel pointer-events-auto grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ntrip-ink/8 p-3">
                        <nav className="flex items-center gap-1 rounded-xl bg-ntrip-ink/5 p-1">
                            {(
                                [
                                    ['active', 'Active'],
                                    ['history', 'History'],
                                ] as const
                            ).map(([tab, label]) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(tab);
                                        setSelectedSessionId(null);
                                    }}
                                    className={cn(
                                        'h-9 rounded-xl px-3 text-xs font-semibold transition',
                                        activeTab === tab
                                            ? 'bg-ntrip-cloud/92 shadow-ntrip-inset-strong'
                                            : 'text-ntrip-ink/48 hover:text-ntrip-ink',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </nav>

                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                            <div className="relative w-full max-w-72">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ntrip-ink/38" />

                                <Input
                                    value={searchQuery}
                                    onChange={(event) =>
                                        setSearchQuery(event.target.value)
                                    }
                                    placeholder="Search sessions"
                                    className="h-9 rounded-xl border-ntrip-ink/9 bg-ntrip-cloud/68 pl-8 text-xs shadow-none"
                                />
                            </div>

                            <select
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(
                                        event.target.value as SessionTypeFilter,
                                    )
                                }
                                className="h-9 rounded-xl border border-ntrip-ink/9 bg-ntrip-cloud/68 px-3 text-xs font-semibold outline-none"
                            >
                                <option value="all">All types</option>

                                <option value="source">Sources</option>

                                <option value="rover">Rovers</option>
                            </select>
                        </div>
                    </div>

                    {visibleError ? (
                        <div className="ntrip-alert-critical m-3">
                            {visibleError}
                        </div>
                    ) : null}

                    <div
                        className={cn(
                            'grid min-h-0',
                            selectedSession
                                ? 'xl:grid-cols-[minmax(0,1fr)_20rem]'
                                : 'grid-cols-1',
                        )}
                    >
                        <div className="min-h-0 overflow-y-auto">
                            <SessionList
                                sessions={visibleSessions}
                                selectedSessionId={selectedSessionId}
                                now={now}
                                onSelect={(session) =>
                                    setSelectedSessionId(String(session.id))
                                }
                            />

                            {activeTab === 'history' && history.lastPage > 1 ? (
                                <div className="flex items-center justify-between border-t border-ntrip-ink/8 px-3 py-2">
                                    <p className="text-xs text-ntrip-ink/42">
                                        {history.total} sessions
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                history.page <= 1 ||
                                                history.isLoading
                                            }
                                            onClick={() =>
                                                history.setPage(
                                                    Math.max(
                                                        1,
                                                        history.page - 1,
                                                    ),
                                                )
                                            }
                                            className="h-8 rounded-xl px-3 text-xs"
                                        >
                                            Previous
                                        </Button>

                                        <span className="text-xs font-semibold tabular-nums">
                                            {history.page}/{history.lastPage}
                                        </span>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                history.page >=
                                                    history.lastPage ||
                                                history.isLoading
                                            }
                                            onClick={() =>
                                                history.setPage(
                                                    Math.min(
                                                        history.lastPage,
                                                        history.page + 1,
                                                    ),
                                                )
                                            }
                                            className="h-8 rounded-xl px-3 text-xs"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {selectedSession ? (
                            <SessionDetailPanel
                                session={selectedSession}
                                now={now}
                                onClose={() => setSelectedSessionId(null)}
                            />
                        ) : null}
                    </div>
                </section>
            </div>
        </>
    );
}

function SummaryMetric({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number;
    icon: typeof Activity;
}) {
    return (
        <div className="min-w-18 rounded-xl bg-ntrip-cloud/68 px-3 py-2 shadow-ntrip-inset">
            <div className="flex items-center gap-1.5 text-ntrip-ink/42">
                <Icon className="size-3" />

                <span className="text-micro font-semibold uppercase">
                    {label}
                </span>
            </div>

            <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
        </div>
    );
}
