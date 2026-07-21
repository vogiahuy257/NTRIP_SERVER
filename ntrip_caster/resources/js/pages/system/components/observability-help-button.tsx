import { CircleHelp } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import type { ObservabilityHelpId } from '../lib/observability-help';
import { getObservabilityHelp } from '../lib/observability-help';

type ObservabilityHelpButtonProps = {
    helpId: ObservabilityHelpId;
    className?: string;
};

export function ObservabilityHelpButton({
    helpId,
    className,
}: ObservabilityHelpButtonProps) {
    const help = getObservabilityHelp(helpId);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    aria-label={`Xem chú thích: ${help.title}`}
                    title="Xem chú thích"
                    className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full border border-white/42 bg-ntrip-cloud/38 text-ntrip-ink/52 shadow-ntrip-inset transition hover:bg-ntrip-cloud/66 hover:text-ntrip-teal focus-visible:ring-2 focus-visible:ring-ntrip-teal/40 focus-visible:outline-none sm:size-9',
                        className,
                    )}
                >
                    <CircleHelp className="size-4" strokeWidth={1.8} />
                </button>
            </DialogTrigger>

            <DialogContent
                surface="glass"
                overlayClassName="z-[100] bg-ntrip-ink/18 backdrop-blur-sm"
                className="z-[110] max-h-[min(88dvh,46rem)] w-[calc(100%-1rem)] max-w-2xl gap-0 overflow-hidden rounded-3xl border-white/42 bg-transparent p-0 text-ntrip-ink shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-2xl"
            >
                <DialogHeader className="border-b border-ntrip-ink/8 bg-ntrip-cloud px-5 pt-5 pr-14 pb-4 text-left sm:px-6 sm:pt-6">
                    <p className="text-micro font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                        Chú thích hệ thống
                    </p>

                    <DialogTitle className="text-xl leading-tight tracking-[-0.035em] text-ntrip-ink">
                        {help.title}
                    </DialogTitle>

                    <DialogDescription className="text-sm leading-relaxed text-ntrip-ink/64">
                        {help.summary}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto overscroll-contain bg-ntrip-cloud  px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                    <HelpSection title="Mục đích">
                        <p>{help.purpose}</p>
                    </HelpSection>

                    <HelpSection title="Cách đọc">
                        <ol className="grid gap-2">
                            {help.howToRead.map((item, index) => (
                                <li
                                    key={item}
                                    className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2"
                                >
                                    <span className="grid size-6 place-items-center rounded-full bg-ntrip-teal/10 text-[0.65rem] font-semibold text-ntrip-teal">
                                        {index + 1}
                                    </span>

                                    <span>{item}</span>
                                </li>
                            ))}
                        </ol>
                    </HelpSection>

                    {help.thresholds.length > 0 && (
                        <HelpSection title="Ngưỡng tham khảo">
                            <div className="grid gap-2">
                                {help.thresholds.map((threshold) => (
                                    <article
                                        key={`${threshold.label}-${threshold.value}`}
                                        className="rounded-xl border border-white/42 bg-ntrip-cloud/28 p-3 shadow-ntrip-inset"
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <h4 className="text-xs font-semibold text-ntrip-ink/78">
                                                {threshold.label}
                                            </h4>

                                            <code className="rounded-md bg-ntrip-ink/6 px-2 py-1 text-[0.7rem] font-semibold text-ntrip-ink/66">
                                                {threshold.value}
                                            </code>
                                        </div>

                                        <p className="mt-2 text-xs leading-relaxed text-ntrip-ink/58">
                                            {threshold.meaning}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        </HelpSection>
                    )}

                    {help.notes.length > 0 && (
                        <HelpSection title="Lưu ý">
                            <ul className="grid list-disc gap-2 pl-5">
                                {help.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </HelpSection>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HelpSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="not-last:mb-5">
            <h3 className="mb-2 text-xs font-semibold tracking-[0.06em] text-ntrip-ink/48 uppercase">
                {title}
            </h3>

            <div className="text-sm leading-relaxed text-ntrip-ink/66">
                {children}
            </div>
        </section>
    );
}
