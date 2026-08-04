import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
}: {
    user: User;
    showEmail?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="size-8 shrink-0 overflow-hidden rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-full bg-ntrip-amber/24 text-xs font-semibold text-ntrip-ink">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>

            <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-ntrip-ink">
                    {user.name}
                </span>

                {showEmail ? (
                    <span className="mt-0.5 truncate text-xs font-normal text-ntrip-ink/48">
                        {user.email}
                    </span>
                ) : null}
            </div>
        </>
    );
}
