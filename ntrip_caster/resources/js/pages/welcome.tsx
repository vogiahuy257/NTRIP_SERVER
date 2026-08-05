import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowDown,
    ArrowRight,
    Database,
    LocateFixed,
    MousePointer2,
    Network,
    RadioTower,
    ServerCog,
    ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import type { WelcomeSceneNode } from '@/components/welcome-3d/welcome-model-assets';
import { WelcomeThreeScene } from '@/components/welcome-3d/welcome-three-scene';
import { dashboard, login, register } from '@/routes';

const NODE_ORDER: WelcomeSceneNode[] = ['base', 'caster', 'uav', 'rover'];

const NODE_CONTENT: Record<
    WelcomeSceneNode,
    {
        index: string;
        label: string;
        title: string;
        description: string;
    }
> = {
    base: {
        index: '01',
        label: 'RTK base station',
        title: 'Correction data begins at the source.',
        description:
            'Distributed GNSS stations generate RTCM observations and publish them continuously to the caster.',
    },
    caster: {
        index: '02',
        label: 'NTRIP Caster',
        title: 'One control plane for every stream.',
        description:
            'Authenticate sources, organize mountpoints, monitor traffic and recover stalled correction streams.',
    },
    uav: {
        index: '03',
        label: 'UAV client',
        title: 'Precision correction delivered in flight.',
        description:
            'UAV clients receive low-latency RTCM data for stable centimeter-level navigation and mission execution.',
    },
    rover: {
        index: '04',
        label: 'Autonomous rover',
        title: 'Reliable positioning across the network.',
        description:
            'Rovers report GGA position, receive the appropriate correction source and remain visible in realtime.',
    },
};

const NODE_VISUALS: Record<
    WelcomeSceneNode,
    {
        icon: typeof RadioTower;
        role: string;
        metric: string;
        signal: string;
    }
> = {
    base: {
        icon: RadioTower,
        role: 'Source node',
        metric: 'RTCM observations',
        signal: 'Continuous source',
    },
    caster: {
        icon: ServerCog,
        role: 'Control plane',
        metric: 'Mountpoint routing',
        signal: 'Realtime orchestration',
    },
    uav: {
        icon: Network,
        role: 'Air client',
        metric: 'Low-latency correction',
        signal: 'Precision in flight',
    },
    rover: {
        icon: LocateFixed,
        role: 'Ground client',
        metric: 'GGA-aware delivery',
        signal: 'Centimeter positioning',
    },
};

const CAPABILITIES = [
    {
        icon: RadioTower,
        title: 'Station management',
        description:
            'Provision, configure and supervise distributed RTK base stations.',
    },
    {
        icon: Network,
        title: 'Mountpoint control',
        description:
            'Manage source routing, access permissions and connected clients.',
    },
    {
        icon: Activity,
        title: 'Realtime observability',
        description:
            'Inspect RTCM age, traffic, CRC errors, sessions and alert recovery.',
    },
    {
        icon: LocateFixed,
        title: 'Adaptive correction',
        description:
            'Prepare for automatic mountpoint selection from rover GGA location.',
    },
    {
        icon: Database,
        title: 'Production runtime',
        description:
            'PostgreSQL history with Redis-backed cache, queue and sessions.',
    },
    {
        icon: ShieldCheck,
        title: 'Secure access',
        description:
            'Authenticated sources, rover accounts and controlled correction delivery.',
    },
] as const;

const NAVIGATION = [
    ['Architecture', 'architecture'],
    ['Capabilities', 'capabilities'],
    ['Platform', 'platform'],
] as const;

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function scrollToArchitectureNode(node: WelcomeSceneNode): void {
    document
        .querySelector<HTMLElement>(
            `[data-welcome-architecture-step="${node}"]`,
        )
        ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
}

export default function Welcome() {
    const { auth } = usePage().props;
    const [activeNode, setActiveNode] = useState<WelcomeSceneNode>('caster');
    const activeNodeIndex = Math.max(0, NODE_ORDER.indexOf(activeNode));
    const activeContent = NODE_CONTENT[activeNode];
    const activeVisual = NODE_VISUALS[activeNode];
    const ActiveNodeIcon = activeVisual.icon;
    const architectureProgress =
        ((activeNodeIndex + 1) / NODE_ORDER.length) * 100;

    useEffect(() => {
        let animationFrame = 0;

        const updateActiveArchitectureNode = (): void => {
            const steps = Array.from(
                document.querySelectorAll<HTMLElement>(
                    '[data-welcome-architecture-step]',
                ),
            ).filter((element) => element.offsetParent !== null);

            if (steps.length === 0) {
                return;
            }

            /*
            * Dùng vùng 52% chiều cao viewport làm điểm kích hoạt.
            * Thẻ gần đường này nhất sẽ trở thành active.
            */
            const activationLine = window.innerHeight * 0.52;

            const nearestStep = steps
                .map((element) => {
                    const bounds = element.getBoundingClientRect();

                    const center =
                        bounds.top + bounds.height / 2;

                    return {
                        element,
                        distance: Math.abs(
                            center - activationLine,
                        ),
                    };
                })
                .sort(
                    (left, right) =>
                        left.distance - right.distance,
                )[0];

            if (!nearestStep) {
                return;
            }

            const node =
                nearestStep.element.dataset
                    .welcomeArchitectureStep;

            if (
                node === 'base' ||
                node === 'caster' ||
                node === 'uav' ||
                node === 'rover'
            ) {
                setActiveNode(node);
            }
        };

        const scheduleUpdate = (): void => {
            window.cancelAnimationFrame(
                animationFrame,
            );

            animationFrame =
                window.requestAnimationFrame(
                    updateActiveArchitectureNode,
                );
        };

        window.addEventListener(
            'scroll',
            scheduleUpdate,
            {
                passive: true,
            },
        );

        window.addEventListener(
            'resize',
            scheduleUpdate,
        );

        scheduleUpdate();

        return () => {
            window.cancelAnimationFrame(
                animationFrame,
            );

            window.removeEventListener(
                'scroll',
                scheduleUpdate,
            );

            window.removeEventListener(
                'resize',
                scheduleUpdate,
            );
        };
    }, []);

    return (
        <>
            <Head title="Realtime GNSS Correction Network">
                <meta
                    name="description"
                    content="Manage RTK base stations, RTCM streams, mountpoints, UAVs and autonomous rovers through one realtime NTRIP platform."
                />
            </Head>

            <style>{`
                @keyframes ntrip-chapter-enter {
                    0% {
                        opacity: 0;
                        transform: translate3d(0, 22px, 0);
                        clip-path: inset(100% 0 0 0 round 1.5rem);
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0);
                        clip-path: inset(0 0 0 0 round 1.5rem);
                    }
                }

                @keyframes ntrip-label-enter {
                    0% {
                        opacity: 0;
                        transform: translate3d(22px, 10px, 0) scale(0.96);
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                }

                @keyframes ntrip-signal-sweep {
                    0% { transform: translateX(-115%); }
                    100% { transform: translateX(315%); }
                }

                .ntrip-chapter-enter {
                    animation: ntrip-chapter-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                .ntrip-label-enter {
                    animation: ntrip-label-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                .ntrip-signal-sweep {
                    animation: ntrip-signal-sweep 3.4s linear infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .ntrip-chapter-enter,
                    .ntrip-label-enter,
                    .ntrip-signal-sweep {
                        animation: none !important;
                    }
                }
            `}</style>

            <div className="relative isolate min-h-screen overflow-x-clip bg-[#f7f7f3] text-[#11110f] selection:bg-black selection:text-white">
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 -z-10 opacity-50"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px)',
                        backgroundSize:
                            'clamp(2.5rem, 8vw, 4rem) clamp(2.5rem, 8vw, 4rem)',
                        maskImage:
                            'linear-gradient(to bottom, black, transparent 88%)',
                    }}
                />

                <WelcomeThreeScene
                    activeNode={activeNode}
                    onActiveNodeChange={setActiveNode}
                    className="fixed inset-0 z-0 h-[100svh] w-full"
                />

                <header className="fixed inset-x-0 top-0 z-40 px-2.5 pt-2.5 sm:px-4 sm:pt-4">
                    <nav className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-2 rounded-2xl border border-black/[0.08] bg-white/78 px-2.5 shadow-[0_18px_54px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:min-h-16 sm:px-4">
                        <button
                            type="button"
                            onClick={() => scrollToSection('hero')}
                            className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none sm:gap-3"
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-white sm:size-10">
                                <RadioTower
                                    className="size-4 sm:size-[1.125rem]"
                                    strokeWidth={1.8}
                                />
                            </span>

                            <span className="min-w-0">
                                <span className="block truncate text-[13px] leading-none font-bold tracking-[-0.025em] sm:text-sm">
                                    NTRIP Caster
                                </span>
                                <span className="mt-1 hidden truncate text-[11px] leading-none text-black/45 sm:block">
                                    GNSS correction infrastructure
                                </span>
                            </span>
                        </button>

                        <div className="hidden items-center gap-1 lg:flex">
                            {NAVIGATION.map(([label, id]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => scrollToSection(id)}
                                    className="min-h-10 rounded-xl px-3 text-xs font-semibold text-black/55 transition hover:bg-black/[0.05] hover:text-black focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:outline-none"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/[0.82] focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-4"
                                >
                                    <span className="hidden min-[360px]:inline">
                                        Dashboard
                                    </span>
                                    <span className="min-[360px]:hidden">
                                        Open
                                    </span>
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="hidden min-h-11 items-center rounded-xl px-3 text-xs font-semibold text-black/60 transition hover:bg-black/[0.05] hover:text-black sm:inline-flex"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/[0.82] focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-4"
                                    >
                                        <span className="hidden min-[360px]:inline">
                                            Get started
                                        </span>
                                        <span className="min-[360px]:hidden">
                                            Start
                                        </span>
                                        <ArrowRight className="size-3.5" />
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </header>

                <main className="relative z-10">
                    <section
                        id="hero"
                        data-welcome-hero
                        className="relative mx-auto flex min-h-[100svh] max-w-[1440px] scroll-mt-20 flex-col justify-end px-4 pt-24 pb-8 sm:px-6 sm:pt-28 sm:pb-12 md:px-8 lg:grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-center lg:px-10 lg:pt-28 lg:pb-16"
                    >
                        <div className="max-w-2xl rounded-[1.5rem] border border-black/[0.07] bg-white/84 p-4 shadow-[0_24px_75px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:p-6 lg:max-w-[40rem] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
                            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-black/55 uppercase backdrop-blur-xl sm:text-[11px]">
                                <span className="size-1.5 rounded-full bg-black" />
                                Realtime GNSS infrastructure
                            </div>

                            <h1 className="mt-5 max-w-[11ch] text-[clamp(2.35rem,11vw,4.25rem)] leading-[0.92] font-semibold tracking-[-0.065em] text-black sm:mt-6 sm:text-[clamp(3rem,8vw,5rem)] lg:text-[clamp(3.75rem,5.2vw,5.75rem)] xl:text-[clamp(4rem,5vw,6.25rem)]">
                                Precision correction.
                                <span className="block text-black/35">
                                    Delivered everywhere.
                                </span>
                            </h1>

                            <p className="mt-5 max-w-xl text-sm leading-6 text-black/55 sm:mt-6 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
                                Manage RTK base stations, RTCM streams,
                                mountpoints, UAVs and autonomous rovers from one
                                realtime platform.
                            </p>

                            <div className="mt-6 grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                                <Link
                                    href={auth.user ? dashboard() : register()}
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-black px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black/[0.82] focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    {auth.user
                                        ? 'Open dashboard'
                                        : 'Get started'}
                                    <ArrowRight className="size-4" />
                                </Link>

                                <button
                                    type="button"
                                    onClick={() =>
                                        scrollToSection('architecture')
                                    }
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/72 px-5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:outline-none"
                                >
                                    Explore network
                                    <ArrowDown className="size-4" />
                                </button>
                            </div>

                            <div className="mt-5 grid grid-cols-3 gap-1.5 sm:max-w-xl sm:gap-2">
                                {[
                                    ['RTCM', 'Realtime'],
                                    ['Redis', 'Runtime'],
                                    ['RTK', 'Ready'],
                                ].map(([value, label]) => (
                                    <div
                                        key={value}
                                        className="min-w-0 rounded-xl border border-black/[0.07] bg-white/58 px-2.5 py-2.5 sm:rounded-2xl sm:px-3 sm:py-3"
                                    >
                                        <p className="truncate text-xs font-semibold sm:text-sm">
                                            {value}
                                        </p>
                                        <p className="mt-0.5 truncate text-[10px] text-black/42 sm:text-[11px]">
                                            {label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-black/42 lg:hidden">
                                <MousePointer2 className="size-3.5 shrink-0" />
                                Drag to rotate · Tap a model to inspect
                            </div>
                        </div>

                        <div className="hidden lg:block" aria-hidden="true" />

                        <div className="pointer-events-none absolute right-10 bottom-8 hidden max-w-[20rem] text-right lg:block xl:right-12 xl:bottom-10">
                            <div className="flex items-center justify-end gap-2 text-[10px] font-bold tracking-[0.14em] text-black/34 uppercase">
                                <MousePointer2 className="size-3.5" />
                                Interactive scene
                            </div>

                            <p className="mt-1.5 text-xs leading-5 text-black/45">
                                Drag to rotate · Click a model to inspect ·
                                Scroll to move through the network
                            </p>
                        </div>
                    </section>

                    <section
                        id="architecture"
                        data-welcome-architecture
                        className="relative h-[570svh] scroll-mt-20 sm:h-[590svh] md:h-[610svh] lg:h-[650svh]"
                    >
                        <div className="sticky top-0 flex min-h-[100svh] items-end overflow-hidden px-3 pt-24 pb-3 sm:items-center sm:px-6 sm:pt-28 sm:pb-6 md:px-8 lg:px-10">
                            <div className="mx-auto grid w-full max-w-[1440px] items-end gap-6 lg:grid-cols-[minmax(21rem,35rem)_minmax(0,1fr)] lg:items-center xl:grid-cols-[minmax(22rem,36rem)_minmax(0,1fr)]">
                                <div className="pointer-events-auto w-full max-w-[38rem] justify-self-start lg:max-w-[35rem]">
                                    <div className="overflow-hidden rounded-[1.45rem] border border-black/[0.08] bg-white/82 shadow-[0_28px_90px_rgba(0,0,0,0.11)] backdrop-blur-2xl sm:rounded-[1.8rem]">
                                        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-4 py-3.5 sm:px-6 sm:py-4.5">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-black text-white sm:size-8">
                                                    <span className="size-1.5 rounded-full bg-white" />
                                                    <span className="absolute inset-0 animate-ping rounded-full border border-black/18 opacity-25" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold tracking-[0.18em] text-black/35 uppercase sm:text-[10px]">
                                                        Architecture sequence
                                                    </p>
                                                    <p className="mt-0.5 truncate text-xs font-semibold text-black/72 sm:text-[13px]">
                                                        Source → Caster → Clients
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="text-[10px] font-bold tracking-[0.12em] text-black/32 uppercase">
                                                    Chapter
                                                </p>
                                                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums sm:text-base">
                                                    {activeContent.index}
                                                    <span className="text-black/25"> / 04</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative min-h-[15.5rem] overflow-hidden px-4 py-4 sm:min-h-[17rem] sm:px-6 sm:py-5 lg:min-h-[18rem]">
                                            <span
                                                aria-hidden="true"
                                                className="pointer-events-none absolute -top-7 right-2 font-mono text-[7.5rem] leading-none font-black tracking-[-0.12em] text-black/[0.035] sm:-top-10 sm:right-4 sm:text-[10rem] lg:text-[11rem]"
                                            >
                                                {activeContent.index}
                                            </span>

                                            <div
                                                key={activeNode}
                                                className="ntrip-chapter-enter relative z-10 flex h-full flex-col"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-black/[0.07] bg-black/[0.035] py-1.5 pr-3 pl-1.5">
                                                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black text-white">
                                                            <ActiveNodeIcon className="size-3.5" strokeWidth={1.8} />
                                                        </span>
                                                        <span className="truncate text-[10px] font-bold tracking-[0.12em] text-black/50 uppercase">
                                                            {activeVisual.role}
                                                        </span>
                                                    </div>

                                                    <span className="hidden items-center gap-2 text-[10px] font-semibold text-black/35 min-[390px]:inline-flex">
                                                        <span className="size-1.5 rounded-full bg-black" />
                                                        {activeVisual.signal}
                                                    </span>
                                                </div>

                                                <div className="mt-auto pt-7 sm:pt-9">
                                                    <p className="max-w-[26ch] text-[clamp(1.75rem,7vw,3rem)] leading-[0.94] font-semibold tracking-[-0.055em] text-black sm:text-[clamp(2.25rem,5vw,3.4rem)]">
                                                        {activeContent.label}
                                                    </p>
                                                    <p className="mt-3 max-w-lg text-sm leading-6 font-medium text-black/58 sm:text-base sm:leading-7">
                                                        {activeContent.title}
                                                    </p>
                                                    <p className="mt-2 hidden max-w-lg text-xs leading-5 text-black/42 min-[380px]:block sm:text-[13px] sm:leading-6">
                                                        {activeContent.description}
                                                    </p>
                                                </div>

                                                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6">
                                                    <div className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                                                        <p className="text-[9px] font-bold tracking-[0.12em] text-black/30 uppercase sm:text-[10px]">
                                                            Runtime role
                                                        </p>
                                                        <p className="mt-1 truncate text-xs font-semibold text-black/70 sm:text-sm">
                                                            {activeVisual.metric}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-black/[0.06] bg-white/60 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                                                        <p className="text-[9px] font-bold tracking-[0.12em] text-black/30 uppercase sm:text-[10px]">
                                                            Active path
                                                        </p>
                                                        <p className="mt-1 truncate text-xs font-semibold text-black/70 sm:text-sm">
                                                            RTCM correction
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-black/[0.06] bg-white/38 px-3 py-3 sm:px-4 sm:py-4">
                                            <div className="relative grid grid-cols-4 gap-1.5 lg:grid-cols-1 lg:gap-1">
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute top-5 right-5 left-5 hidden h-px bg-black/[0.08] sm:block lg:top-5 lg:right-auto lg:bottom-5 lg:left-5 lg:h-auto lg:w-px"
                                                />

                                                {NODE_ORDER.map((node) => {
                                                    const content = NODE_CONTENT[node];
                                                    const visual = NODE_VISUALS[node];
                                                    const Icon = visual.icon;
                                                    const selected = activeNode === node;
                                                    const passed =
                                                        NODE_ORDER.indexOf(node) <=
                                                        activeNodeIndex;

                                                    return (
                                                        <button
                                                            key={node}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            onClick={() => {
                                                                setActiveNode(node);
                                                                scrollToArchitectureNode(node);
                                                            }}
                                                            onFocus={() => setActiveNode(node)}
                                                            className={`group relative z-10 flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-1.5 py-2 text-left transition-all duration-500 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none sm:min-h-14 sm:px-2 lg:min-h-12 lg:justify-start lg:border-transparent lg:px-2.5 ${
                                                                selected
                                                                    ? 'border-black/10 bg-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] lg:translate-x-1'
                                                                    : 'border-black/[0.06] bg-white/58 text-black/48 hover:border-black/10 hover:bg-white/84 lg:bg-transparent lg:hover:bg-black/[0.04]'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold tabular-nums transition-all duration-500 sm:size-8 ${
                                                                    selected
                                                                        ? 'border-white/15 bg-white/12 text-white'
                                                                        : passed
                                                                          ? 'border-black bg-black text-white'
                                                                          : 'border-black/[0.08] bg-[#f4f4f1] text-black/32'
                                                                }`}
                                                            >
                                                                <span className="sm:hidden">{content.index}</span>
                                                                <Icon className="hidden size-3.5 sm:block" strokeWidth={1.8} />
                                                            </span>

                                                            <span className="hidden min-w-0 sm:block lg:flex-1">
                                                                <span className="block truncate text-[11px] font-semibold sm:text-xs">
                                                                    {content.label}
                                                                </span>
                                                                <span
                                                                    className={`mt-0.5 hidden truncate text-[10px] lg:block ${
                                                                        selected
                                                                            ? 'text-white/48'
                                                                            : 'text-black/32'
                                                                    }`}
                                                                >
                                                                    {visual.role}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-3 flex items-center gap-3 px-1">
                                                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                                                    <div
                                                        className="h-full rounded-full bg-black transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                                        style={{ width: `${architectureProgress}%` }}
                                                    />
                                                </div>
                                                <span className="shrink-0 text-[9px] font-bold tracking-[0.12em] text-black/30 uppercase sm:text-[10px]">
                                                    Scroll to continue
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pointer-events-none hidden min-h-[30rem] lg:block" aria-hidden="true">
                                    <div
                                        key={`scene-label-${activeNode}`}
                                        className="ntrip-label-enter absolute right-[clamp(2.5rem,6vw,7rem)] bottom-[clamp(3.5rem,9vh,7rem)] max-w-[17rem] text-right"
                                    >
                                        <div className="flex items-center justify-end gap-2 text-[10px] font-bold tracking-[0.16em] text-black/32 uppercase">
                                            <span>{activeContent.index}</span>
                                            <span className="h-px w-10 bg-black/20" />
                                            <span>{activeVisual.role}</span>
                                        </div>
                                        <p className="mt-2 text-lg font-semibold tracking-[-0.025em] text-black/78">
                                            {activeContent.label}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-black/40">
                                            {activeVisual.signal}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 top-[65svh]"
                        >
                            {NODE_ORDER.map((node) => (
                                <div
                                    key={node}
                                    data-welcome-architecture-step={node}
                                    className="h-[125svh] sm:h-[130svh] lg:h-[145svh]"
                                />
                            ))}
                        </div>
                    </section>

                    <section
                        id="capabilities"
                        className="relative mx-auto max-w-[1440px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-10 lg:py-28"
                    >
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end lg:gap-12">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/65 px-3 py-2 text-[10px] font-bold tracking-[0.16em] text-black/38 uppercase backdrop-blur-xl">
                                    <Activity className="size-3.5" />
                                    Core capabilities
                                </div>
                                <h2 className="mt-5 max-w-[11ch] text-[clamp(2.5rem,10vw,4.75rem)] leading-[0.94] font-semibold tracking-[-0.06em]">
                                    Live infrastructure, shaped as one system.
                                </h2>
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-black/48 sm:text-base sm:leading-7 lg:justify-self-end lg:text-lg lg:leading-8">
                                Every operating layer shares one visual language,
                                one realtime runtime and one source of truth—from
                                the correction source to each connected vehicle.
                            </p>
                        </div>

                        <div className="mt-9 grid auto-rows-[minmax(12rem,auto)] gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-12 lg:auto-rows-[14rem]">
                            {CAPABILITIES.map((capability, index) => {
                                const Icon = capability.icon;
                                const layout = [
                                    'lg:col-span-5 lg:row-span-2',
                                    'lg:col-span-3',
                                    'lg:col-span-4',
                                    'lg:col-span-4',
                                    'lg:col-span-3',
                                    'lg:col-span-5',
                                ][index];
                                const featured = index === 0;

                                return (
                                    <article
                                        key={capability.title}
                                        className={`group relative overflow-hidden rounded-[1.45rem] border p-5 transition-all duration-500 hover:-translate-y-1 sm:rounded-[1.75rem] sm:p-6 ${layout} ${
                                            featured
                                                ? 'border-black bg-black text-white shadow-[0_32px_90px_rgba(0,0,0,0.2)]'
                                                : 'border-black/[0.07] bg-white/72 text-black shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-2xl hover:border-black/12 hover:bg-white/90'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`absolute top-5 right-5 font-mono text-6xl leading-none font-black tracking-[-0.1em] sm:text-7xl ${
                                                featured
                                                    ? 'text-white/[0.055]'
                                                    : 'text-black/[0.035]'
                                            }`}
                                        >
                                            {String(index + 1).padStart(2, '0')}
                                        </span>

                                        <div className="relative z-10 flex h-full flex-col">
                                            <span
                                                className={`grid size-11 place-items-center rounded-2xl border sm:size-12 ${
                                                    featured
                                                        ? 'border-white/10 bg-white/10 text-white'
                                                        : 'border-black/[0.06] bg-black/[0.04] text-black/65'
                                                }`}
                                            >
                                                <Icon className="size-[1.15rem]" strokeWidth={1.8} />
                                            </span>

                                            <div className="mt-auto pt-8">
                                                <h3 className={`font-semibold tracking-[-0.025em] ${featured ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>
                                                    {capability.title}
                                                </h3>
                                                <p
                                                    className={`mt-2 max-w-md text-sm leading-6 ${
                                                        featured
                                                            ? 'text-white/52'
                                                            : 'text-black/45'
                                                    }`}
                                                >
                                                    {capability.description}
                                                </p>
                                            </div>

                                            <div className={`relative mt-6 h-px overflow-hidden ${featured ? 'bg-white/10' : 'bg-black/[0.07]'}`}>
                                                <span
                                                    className={`ntrip-signal-sweep absolute inset-y-0 left-0 w-1/3 ${featured ? 'bg-white/75' : 'bg-black/55'}`}
                                                />
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        id="platform"
                        className="relative mx-auto max-w-[1440px] scroll-mt-20 px-4 py-12 sm:px-6 sm:py-18 md:px-8 lg:px-10 lg:py-24"
                    >
                        <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black text-white shadow-[0_42px_130px_rgba(0,0,0,0.26)] sm:rounded-[2rem]">
                            <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.62fr)] lg:items-end lg:p-14">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/38 uppercase sm:text-[11px]">
                                        <ServerCog className="size-4" />
                                        Production runtime
                                    </div>
                                    <h2 className="mt-5 max-w-[12ch] text-[clamp(2.5rem,10vw,5rem)] leading-[0.93] font-semibold tracking-[-0.065em]">
                                        One control plane. Every precision client.
                                    </h2>
                                    <p className="mt-5 max-w-2xl text-sm leading-6 text-white/50 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
                                        Laravel, React, PostgreSQL, Redis, Reverb
                                        and the NTRIP TCP service operate as one
                                        observable platform.
                                    </p>
                                </div>

                                <div className="grid gap-2.5">
                                    {[
                                        ['01', 'Source layer', 'RTK base stations publish continuous RTCM observations.'],
                                        ['02', 'Control layer', 'The caster authenticates, routes and monitors every stream.'],
                                        ['03', 'Client layer', 'UAVs and rovers receive precise corrections in realtime.'],
                                    ].map(([index, title, description]) => (
                                        <div
                                            key={index}
                                            className="group grid grid-cols-[2.6rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 transition hover:border-white/18 hover:bg-white/[0.085] sm:p-4"
                                        >
                                            <span className="grid size-10 place-items-center rounded-xl bg-white/10 font-mono text-xs font-bold text-white/70">
                                                {index}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold">{title}</p>
                                                <p className="mt-1 text-xs leading-5 text-white/38">{description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative overflow-hidden border-t border-white/10 px-5 py-5 sm:px-8 lg:px-14">
                                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.055] to-transparent ntrip-signal-sweep" aria-hidden="true" />
                                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-white/78">Ready to operate the network?</p>
                                        <p className="mt-1 text-xs text-white/36">Open the realtime dashboard or create your first account.</p>
                                    </div>
                                    <Link
                                        href={auth.user ? dashboard() : register()}
                                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none sm:w-auto"
                                    >
                                        {auth.user ? 'Open dashboard' : 'Create an account'}
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </section>

                    <footer className="mx-auto max-w-[1440px] px-4 pb-6 sm:px-6 sm:pb-8 md:px-8 lg:px-10">
                        <div className="grid gap-4 border-t border-black/[0.08] py-6 text-xs text-black/40 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                                <p className="font-semibold text-black/62">NTRIP Caster</p>
                                <p className="mt-1">Realtime GNSS correction infrastructure.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                                <button type="button" onClick={() => scrollToSection('architecture')} className="transition hover:text-black">Architecture</button>
                                <button type="button" onClick={() => scrollToSection('capabilities')} className="transition hover:text-black">Capabilities</button>
                                <button type="button" onClick={() => scrollToSection('platform')} className="transition hover:text-black">Platform</button>
                            </div>
                        </div>
                    </footer>
                </main>

                <div className="pointer-events-none fixed right-4 bottom-4 z-30 hidden rounded-full border border-black/10 bg-white/72 px-3 py-2 text-[10px] font-semibold text-black/42 backdrop-blur-xl lg:block">
                    Scroll to move · Drag to rotate · Click to inspect
                </div>
            </div>
        </>
    );
}
