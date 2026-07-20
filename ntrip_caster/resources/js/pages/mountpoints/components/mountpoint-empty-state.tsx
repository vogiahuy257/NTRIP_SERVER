import type { LucideIcon } from 'lucide-react';

export function MountpointEmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <div className="grid min-h-96 place-items-center rounded-card border border-dashed border-ntrip-ink/12 bg-ntrip-cloud/50 px-6 text-center">
            <div>
                <Icon className="mx-auto size-7 text-ntrip-ink/30" />
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 max-w-sm text-xs text-ntrip-ink/44">
                    {description}
                </p>
            </div>
        </div>
    );
}
