import { Link } from '@inertiajs/react';
import {
    Bell,
    Check,
    CheckCircle2,
    CircleAlert,
    LoaderCircle,
    RefreshCw,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { useMapDashboard } from '@/contexts/map-dashboard-context';
import { cn } from '@/lib/utils';
import type { NtripRealtimeConnectionState } from '@/realtime/ntrip-realtime-types';

import type { AlertItem, AlertSeverity } from './types';
import { useAlertNotifications } from './use-alert-notifications';

type DrawerTab = 'active' | 'recent';

type RealtimePresentation = {
    label: string;
    dotClassName: string;
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
    critical: 'Critical',
    warning: 'Warning',
};

function formatRelativeTime(value: string | null): string {
    if (value === null) {
        return 'Unknown time';
    }

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) {
        return 'Unknown time';
    }

    const elapsedSeconds = Math.max(
        0,
        Math.round((Date.now() - timestamp) / 1000),
    );

    if (elapsedSeconds < 5) {
        return 'Just now';
    }

    if (elapsedSeconds < 60) {
        return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.round(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.round(elapsedMinutes / 60);

    if (elapsedHours < 24) {
        return `${elapsedHours}h ago`;
    }

    return `${Math.round(elapsedHours / 24)}d ago`;
}

function humanizeAlertType(type: string): string {
    return type.split('_').filter(Boolean).join(' ');
}

function getRealtimePresentation(
    state: NtripRealtimeConnectionState,
): RealtimePresentation {
    switch (state) {
        case 'connected':
            return {
                label: 'Reverb connected',
                dotClassName: 'bg-ntrip-teal',
            };

        case 'reconnecting':
            return {
                label: 'Reconnecting',
                dotClassName: 'bg-ntrip-amber',
            };

        case 'disconnected':
            return {
                label: 'Realtime offline',
                dotClassName: 'bg-ntrip-coral',
            };

        case 'failed':
            return {
                label: 'Realtime failed',
                dotClassName: 'bg-ntrip-coral',
            };

        case 'connecting':
        default:
            return {
                label: 'Connecting',
                dotClassName: 'bg-ntrip-amber',
            };
    }
}

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
    if (severity === 'critical') {
        return <CircleAlert className="size-4" strokeWidth={1.9} />;
    }

    return <TriangleAlert className="size-4" strokeWidth={1.9} />;
}

function AlertStatusIndicator({ alert }: { alert: AlertItem }) {
    if (alert.status === 'resolved') {
        return (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ntrip-teal" />
        );
    }

    if (alert.status === 'acknowledged') {
        return (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ntrip-teal/14 text-ntrip-teal">
                <Check className="size-3" strokeWidth={2.2} />
            </span>
        );
    }

    return (
        <span
            className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                alert.severity === 'critical'
                    ? 'bg-ntrip-coral'
                    : 'bg-ntrip-amber',
            )}
        />
    );
}

function AlertRow({
    alert,
    isAcknowledging,
    onAcknowledge,
    onNavigate,
}: {
    alert: AlertItem;
    isAcknowledging: boolean;
    onAcknowledge: (alertId: number) => void;
    onNavigate: () => void;
}) {
    const timestamp =
        alert.status === 'resolved'
            ? alert.resolvedAt
            : alert.lastObservedAt ?? alert.openedAt;

    return (
        <article
            className={cn(
                'rounded-2xl border p-3.5',
                'bg-ntrip-cloud/68 shadow-ntrip-inset',
                alert.severity === 'critical'
                    ? 'border-ntrip-coral/22'
                    : 'border-ntrip-amber/24',
            )}
        >
            <div className="flex items-start gap-3">
                <span
                    className={cn(
                        'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl',
                        alert.severity === 'critical'
                            ? 'bg-ntrip-coral/14 text-ntrip-coral'
                            : 'bg-ntrip-amber/18 text-ntrip-ink',
                    )}
                >
                    <SeverityIcon severity={alert.severity} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-[-0.015em] text-ntrip-ink">
                                {alert.title}
                            </p>

                            <p className="mt-0.5 text-[11px] font-semibold tracking-[0.04em] text-ntrip-ink/42 uppercase">
                                {SEVERITY_LABEL[alert.severity]}
                                {' · '}
                                {humanizeAlertType(alert.type)}
                            </p>
                        </div>

                        <AlertStatusIndicator alert={alert} />
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-ntrip-ink/62">
                        {alert.message}
                    </p>

                    {alert.occurrenceCount > 1 ? (
                        <p className="mt-1.5 text-[11px] font-medium text-ntrip-ink/44 tabular-nums">
                            Observed {alert.occurrenceCount} times
                        </p>
                    ) : null}

                    {alert.status === 'acknowledged' ? (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-ntrip-teal">
                            <Check className="size-3.5" />
                            <span>
                                Acknowledged
                                {alert.acknowledgedBy
                                    ? ` by ${alert.acknowledgedBy.name}`
                                    : ''}
                            </span>
                        </div>
                    ) : null}

                    {alert.status === 'resolved' && alert.resolutionNote ? (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-ntrip-ink/48">
                            {alert.resolutionNote}
                        </p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                        {alert.station ? (
                            <Link
                                href={`/stations/${alert.station.id}`}
                                onClick={onNavigate}
                                className="min-w-0 truncate font-semibold text-ntrip-ink transition hover:text-ntrip-teal"
                            >
                                {alert.station.name}
                            </Link>
                        ) : (
                            <span className="text-ntrip-ink/42">System</span>
                        )}

                        <time
                            dateTime={timestamp ?? undefined}
                            className="shrink-0 text-ntrip-ink/42 tabular-nums"
                        >
                            {formatRelativeTime(timestamp)}
                        </time>
                    </div>

                    {alert.status === 'open' ? (
                        <div className="mt-3 flex justify-end border-t border-ntrip-ink/6 pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isAcknowledging}
                                onClick={() => onAcknowledge(alert.id)}
                                className="h-8 rounded-xl border-ntrip-ink/10 bg-ntrip-cloud/72 px-3 text-[11px] font-semibold"
                            >
                                {isAcknowledging ? (
                                    <>
                                        <LoaderCircle className="size-3.5 animate-spin" />
                                        Acknowledging
                                    </>
                                ) : (
                                    <>
                                        <Check className="size-3.5" />
                                        Acknowledge
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

function EmptyAlerts({ tab }: { tab: DrawerTab }) {
    return (
        <div className="grid flex-1 place-items-center px-6 py-16 text-center">
            <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-ntrip-teal/12 text-ntrip-teal">
                    <CheckCircle2 className="size-5" strokeWidth={1.8} />
                </span>

                <p className="mt-4 text-sm font-semibold text-ntrip-ink">
                    {tab === 'active'
                        ? 'No active alerts'
                        : 'No recent recovery'}
                </p>

                <p className="mt-1 text-xs leading-5 text-ntrip-ink/48">
                    {tab === 'active'
                        ? 'All monitored stations and RTCM streams are currently stable.'
                        : 'Resolved alerts will appear here automatically.'}
                </p>
            </div>
        </div>
    );
}

export function AlertNotificationDrawer() {
    const { realtimeConnectionState } = useMapDashboard();

    const {
        activeAlerts,
        recentAlerts,
        activeCount,
        criticalCount,
        unacknowledgedCount,
        isLoading,
        isRefreshing,
        error,
        actionError,
        acknowledgingAlertIds,
        eventVersion,
        refresh,
        acknowledgeAlert,
    } = useAlertNotifications();

    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<DrawerTab>('active');
    const [seenEventVersion, setSeenEventVersion] = useState(0);

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        setSeenEventVersion(eventVersion);

        const focusFrame = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') {
                return;
            }

            setOpen(false);

            window.requestAnimationFrame(() => {
                triggerRef.current?.focus();
            });
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [eventVersion, open]);

    useEffect(() => {
        if (open) {
            setSeenEventVersion(eventVersion);
        }
    }, [eventVersion, open]);

    const hasFreshEvent = eventVersion > seenEventVersion;
    const displayedAlerts = tab === 'active' ? activeAlerts : recentAlerts;
    const realtime = getRealtimePresentation(realtimeConnectionState);

    const closeDrawer = (): void => {
        setOpen(false);

        window.requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
    };

    const drawer =
        mounted && open
            ? createPortal(
                  <div className="pointer-events-auto fixed inset-0 z-[100]">
                      <button
                          type="button"
                          aria-label="Close notifications"
                          className="absolute inset-0 cursor-default bg-ntrip-ink/18 backdrop-blur-[2px]"
                          onClick={closeDrawer}
                      />

                      <section
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="alert-drawer-title"
                          className={cn(
                              'absolute inset-y-2 right-2',
                              'flex w-[min(420px,calc(100vw-1rem))] flex-col overflow-hidden',
                              'rounded-[28px] border border-ntrip-cloud/60',
                              'bg-ntrip-cloud/88 shadow-[0_24px_90px_rgb(var(--ntrip-ink)/0.28)]',
                              'backdrop-blur-3xl',
                          )}
                      >
                          <header className="border-b border-ntrip-ink/7 px-5 pt-5 pb-4">
                              <div className="flex items-start justify-between gap-4">
                                  <div>
                                      <p className="text-[11px] font-semibold tracking-[0.08em] text-ntrip-ink/42 uppercase">
                                          Alert Engine
                                      </p>

                                      <h2
                                          id="alert-drawer-title"
                                          className="mt-1 text-xl font-semibold tracking-[-0.035em] text-ntrip-ink"
                                      >
                                          Notifications
                                      </h2>

                                      <p className="mt-1 text-xs text-ntrip-ink/50">
                                          {unacknowledgedCount > 0
                                              ? `${unacknowledgedCount} unacknowledged alert${unacknowledgedCount === 1 ? '' : 's'}`
                                              : `${activeCount} active alert${activeCount === 1 ? '' : 's'}`}
                                      </p>
                                  </div>

                                  <Button
                                      ref={closeButtonRef}
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Close notification drawer"
                                      onClick={closeDrawer}
                                      className="size-9 rounded-xl text-ntrip-ink/58 hover:bg-ntrip-ink/6 hover:text-ntrip-ink"
                                  >
                                      <X className="size-4" />
                                  </Button>
                              </div>

                              <div className="mt-4 flex items-center gap-2">
                                  <button
                                      type="button"
                                      onClick={() => setTab('active')}
                                      className={cn(
                                          'flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition',
                                          tab === 'active'
                                              ? 'bg-ntrip-ink text-ntrip-cloud shadow-sm'
                                              : 'bg-ntrip-cloud/55 text-ntrip-ink/56 hover:bg-ntrip-cloud/82 hover:text-ntrip-ink',
                                      )}
                                  >
                                      Active

                                      <span
                                          className={cn(
                                              'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                                              tab === 'active'
                                                  ? 'bg-ntrip-cloud/14 text-ntrip-cloud'
                                                  : 'bg-ntrip-ink/7 text-ntrip-ink/55',
                                          )}
                                      >
                                          {activeCount}
                                      </span>
                                  </button>

                                  <button
                                      type="button"
                                      onClick={() => setTab('recent')}
                                      className={cn(
                                          'flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition',
                                          tab === 'recent'
                                              ? 'bg-ntrip-ink text-ntrip-cloud shadow-sm'
                                              : 'bg-ntrip-cloud/55 text-ntrip-ink/56 hover:bg-ntrip-cloud/82 hover:text-ntrip-ink',
                                      )}
                                  >
                                      Recent

                                      <span
                                          className={cn(
                                              'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                                              tab === 'recent'
                                                  ? 'bg-ntrip-cloud/14 text-ntrip-cloud'
                                                  : 'bg-ntrip-ink/7 text-ntrip-ink/55',
                                          )}
                                      >
                                          {recentAlerts.length}
                                      </span>
                                  </button>

                                  <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Refresh alerts"
                                      title="Refresh alerts"
                                      disabled={isRefreshing}
                                      onClick={refresh}
                                      className="ml-auto size-9 rounded-xl text-ntrip-ink/52 hover:bg-ntrip-ink/6 hover:text-ntrip-ink"
                                  >
                                      <RefreshCw
                                          className={cn(
                                              'size-4',
                                              isRefreshing && 'animate-spin',
                                          )}
                                      />
                                  </Button>
                              </div>
                          </header>

                          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                              {actionError ? (
                                  <div className="mb-3 rounded-xl border border-ntrip-coral/20 bg-ntrip-coral/8 px-3 py-2 text-xs leading-5 text-ntrip-ink">
                                      {actionError}
                                  </div>
                              ) : null}

                              {isLoading ? (
                                  <div className="grid h-full min-h-48 place-items-center">
                                      <LoaderCircle className="size-5 animate-spin text-ntrip-teal" />
                                  </div>
                              ) : error ? (
                                  <div className="rounded-2xl border border-ntrip-coral/18 bg-ntrip-coral/8 p-4">
                                      <p className="text-sm font-semibold text-ntrip-ink">
                                          Unable to load alerts
                                      </p>

                                      <p className="mt-1 text-xs leading-5 text-ntrip-ink/56">
                                          {error}
                                      </p>

                                      <Button
                                          type="button"
                                          variant="outline"
                                          onClick={refresh}
                                          className="mt-3 h-9 rounded-xl border-ntrip-ink/10 bg-ntrip-cloud/68 text-xs"
                                      >
                                          Try again
                                      </Button>
                                  </div>
                              ) : displayedAlerts.length === 0 ? (
                                  <EmptyAlerts tab={tab} />
                              ) : (
                                  <div className="space-y-2.5">
                                      {displayedAlerts.map((alert) => (
                                          <AlertRow
                                              key={alert.id}
                                              alert={alert}
                                              isAcknowledging={acknowledgingAlertIds.has(
                                                  alert.id,
                                              )}
                                              onAcknowledge={(alertId) => {
                                                  void acknowledgeAlert(alertId);
                                              }}
                                              onNavigate={closeDrawer}
                                          />
                                      ))}
                                  </div>
                              )}
                          </div>

                          <footer className="border-t border-ntrip-ink/7 px-5 py-3.5">
                              <div className="flex items-center justify-between gap-3 text-[11px] text-ntrip-ink/42">
                                  <span>
                                      {criticalCount > 0
                                          ? `${criticalCount} active critical`
                                          : 'Realtime monitoring'}
                                  </span>

                                  <span className="flex items-center gap-1.5">
                                      <span
                                          className={cn(
                                              'size-1.5 rounded-full',
                                              realtime.dotClassName,
                                          )}
                                      />
                                      {realtime.label}
                                  </span>
                              </div>
                          </footer>
                      </section>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            <Button
                ref={triggerRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                title="Notifications"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => {
                    setOpen(true);
                    setSeenEventVersion(eventVersion);
                }}
                className={cn(
                    'ntrip-glass-panel relative size-10 rounded-xl',
                    'text-ntrip-ink hover:bg-ntrip-cloud/94',
                )}
            >
                <Bell className="size-4" />

                {activeCount > 0 ? (
                    <span
                        className={cn(
                            'absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ntrip-cloud px-1',
                            'text-[9px] leading-none font-bold text-white tabular-nums',
                            criticalCount > 0
                                ? 'bg-ntrip-coral'
                                : 'bg-ntrip-amber text-ntrip-ink',
                        )}
                    >
                        {activeCount > 99 ? '99+' : activeCount}
                    </span>
                ) : null}

                {hasFreshEvent ? (
                    <span className="absolute top-0.5 right-0.5 size-2 animate-ping rounded-full bg-ntrip-coral" />
                ) : null}
            </Button>

            {drawer}
        </>
    );
}
