import type { LucideIcon } from 'lucide-react';
import { Activity, RadioTower, Server, Wifi } from 'lucide-react';

import { cn } from '@/lib/utils';

import type {
    RtcmFlowDiagnosis,
    RtcmFlowDiagnosisStatus,
    RtcmFlowDiagnosisTarget,
} from '../lib/rtcm-flow-diagnosis';

import { ObservabilityHelpButton } from './observability-help-button';

const statusLabel: Record<RtcmFlowDiagnosisStatus, string> = {
    unknown: 'Waiting',
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
};

const statusTextClass: Record<RtcmFlowDiagnosisStatus, string> = {
    unknown: 'text-ntrip-ink/48',
    healthy: 'text-ntrip-teal',
    warning: 'text-ntrip-amber',
    critical: 'text-ntrip-coral',
};

const statusBackgroundClass: Record<RtcmFlowDiagnosisStatus, string> = {
    unknown: 'bg-ntrip-ink/6',
    healthy: 'bg-ntrip-teal/8',
    warning: 'bg-ntrip-amber/10',
    critical: 'bg-ntrip-coral/10',
};

const targetIcon: Record<RtcmFlowDiagnosisTarget, LucideIcon> = {
    base: RadioTower,
    caster: Server,
    rover: Wifi,
};

export function BottleneckDiagnosisCard({
    diagnosis,
}: {
    diagnosis: RtcmFlowDiagnosis;
}) {
    return (
        <section className="ntrip-section flex h-full min-h-0 min-w-0 flex-col rounded-2xl p-3 sm:p-4">
            <header className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        className={cn(
                            'grid size-11 shrink-0 place-items-center rounded-xl shadow-ntrip-inset',
                            statusBackgroundClass[diagnosis.overall],
                            statusTextClass[diagnosis.overall],
                        )}
                    >
                        <Activity className="size-4" strokeWidth={1.8} />
                    </span>

                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-sm font-semibold">
                                Bottleneck diagnosis
                            </h2>

                            <ObservabilityHelpButton helpId="diagnosis" />
                        </div>

                        <p className="mt-1 text-sm leading-relaxed text-ntrip-ink/62">
                            Realtime classification of the BASE, Caster and
                            Rover data path.
                        </p>
                    </div>
                </div>

                <span
                    className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold',
                        statusBackgroundClass[diagnosis.overall],
                        statusTextClass[diagnosis.overall],
                    )}
                >
                    {statusLabel[diagnosis.overall]}
                </span>
            </header>

            <div className="mt-4 grid min-h-0 flex-1 auto-rows-fr gap-2">
                {diagnosis.items.map((item) => {
                    const Icon = targetIcon[item.target];

                    return (
                        <article
                            key={item.target}
                            className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-white/38 bg-ntrip-cloud/18 p-3"
                        >
                            <span
                                className={cn(
                                    'grid size-9 shrink-0 place-items-center rounded-lg',
                                    statusBackgroundClass[item.status],
                                    statusTextClass[item.status],
                                )}
                            >
                                <Icon className="size-4" strokeWidth={1.8} />
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    <h3 className="truncate text-sm font-semibold text-ntrip-ink/78">
                                        {item.label}
                                    </h3>

                                    <span
                                        className={cn(
                                            'shrink-0 text-sm font-semibold',
                                            statusTextClass[item.status],
                                        )}
                                    >
                                        {statusLabel[item.status]}
                                    </span>
                                </div>

                                <p className="mt-1 text-sm leading-relaxed text-ntrip-ink/56">
                                    {item.summary}
                                </p>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
