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

import { WelcomeThreeScene } from '@/components/welcome-3d/welcome-three-scene';
import type { WelcomeSceneNode } from '@/components/welcome-3d/welcome-model-assets';
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
    const activeContent = NODE_CONTENT[activeNode];

    useEffect(() => {
        const steps = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-welcome-architecture-step]',
            ),
        );

        if (steps.length === 0) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntry = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (left, right) =>
                            right.intersectionRatio - left.intersectionRatio,
                    )[0];

                const node = visibleEntry?.target.getAttribute(
                    'data-welcome-architecture-step',
                );

                if (
                    node === 'base' ||
                    node === 'caster' ||
                    node === 'uav' ||
                    node === 'rover'
                ) {
                    setActiveNode(node);
                }
            },
            {
                rootMargin: '-32% 0px -42% 0px',
                threshold: [0.2, 0.45, 0.7],
            },
        );

        steps.forEach((step) => observer.observe(step));

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <Head title="Realtime GNSS Correction Network">
                <meta
                    name="description"
                    content="Manage RTK base stations, RTCM streams, mountpoints, UAVs and autonomous rovers through one realtime NTRIP platform."
                />
            </Head>

            <div className="relative isolate min-h-screen overflow-x-clip bg-[#f7f7f3] text-[#11110f] selection:bg-black selection:text-white">
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 -z-10 opacity-50"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px)',
                        backgroundSize: 'clamp(2.5rem, 8vw, 4rem) clamp(2.5rem, 8vw, 4rem)',
                        maskImage:
                            'linear-gradient(to bottom, black, transparent 88%)',
                    }}
                />

                <WelcomeThreeScene
                    activeNode={activeNode}
                    onActiveNodeChange={setActiveNode}
                    className="fixed inset-x-0 top-[4.5rem] z-0 h-[38svh] min-h-56 sm:top-20 sm:h-[44svh] md:h-[50svh] lg:inset-y-20 lg:right-0 lg:left-[42%] lg:h-auto lg:min-h-0 xl:left-[40%]"
                />

                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[2] h-[38svh] bg-gradient-to-b from-transparent via-transparent to-[#f7f7f3] sm:top-20 sm:h-[44svh] md:h-[50svh] lg:hidden"
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
                                    <span className="hidden min-[360px]:inline">Dashboard</span>
                                    <span className="min-[360px]:hidden">Open</span>
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
                                        <span className="min-[360px]:hidden">Start</span>
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
                        className="mx-auto flex min-h-[100svh] max-w-[1440px] scroll-mt-20 flex-col justify-end px-4 pt-[calc(38svh+6.25rem)] pb-10 sm:px-6 sm:pt-[calc(44svh+7rem)] sm:pb-14 md:px-8 md:pt-[calc(50svh+7rem)] lg:grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-center lg:px-10 lg:pt-28 lg:pb-20"
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
                        </div>

                        <div className="hidden lg:block" aria-hidden="true" />
                    </section>

                    <section
                        aria-label="Interactive network controls"
                        className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 md:px-8 lg:px-10 lg:pb-24"
                    >
                        <div className="rounded-[1.5rem] border border-black/[0.08] bg-white/86 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:p-4 lg:max-w-[36rem]">
                            <div className="flex items-start justify-between gap-3 px-1 pb-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold tracking-[0.14em] text-black/38 uppercase">
                                        Interactive scene
                                    </p>
                                    <p className="mt-1 truncate text-sm font-semibold">
                                        {activeContent.label}
                                    </p>
                                </div>

                                <span className="shrink-0 rounded-full border border-black/10 px-2 py-1 text-[10px] font-bold text-black/48">
                                    {activeContent.index}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {NODE_ORDER.map((node) => {
                                    const content = NODE_CONTENT[node];
                                    const selected = node === activeNode;

                                    return (
                                        <button
                                            key={node}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => setActiveNode(node)}
                                            className={`min-h-11 rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none sm:min-h-12 sm:text-xs ${
                                                selected
                                                    ? 'border-black bg-black text-white'
                                                    : 'border-black/[0.07] bg-white/62 text-black/58 hover:border-black/15 hover:bg-white hover:text-black'
                                            }`}
                                        >
                                            <span className="block text-[9px] opacity-55 sm:text-[10px]">
                                                {content.index}
                                            </span>
                                            <span className="mt-0.5 block truncate">
                                                {content.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="mt-3 text-xs leading-5 text-black/50">
                                {activeContent.description}
                            </p>

                            <div className="mt-3 hidden items-center gap-2 text-[11px] font-semibold text-black/45 sm:flex">
                                <MousePointer2 className="size-3.5" />
                                Drag to rotate · Hover or click to inspect ·
                                Scroll to move the camera
                            </div>
                        </div>
                    </section>

                    <section
                        id="architecture"
                        data-welcome-architecture
                        className="mx-auto max-w-[1440px] scroll-mt-20 px-4 pt-[calc(38svh+6rem)] pb-16 sm:px-6 sm:pt-[calc(44svh+7rem)] sm:pb-20 md:px-8 md:pt-[calc(50svh+7rem)] lg:px-10 lg:pt-28 lg:pb-28"
                    >
                        <div className="w-full max-w-xl lg:max-w-[34rem]">
                            <div className="rounded-[1.5rem] border border-black/[0.08] bg-white/92 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:sticky lg:top-24 lg:p-8">
                                <p className="text-[10px] font-bold tracking-[0.16em] text-black/38 uppercase sm:text-[11px]">
                                    Architecture
                                </p>
                                <h2 className="mt-3 max-w-[13ch] text-[clamp(2.15rem,9.5vw,3.75rem)] leading-[0.96] font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                                    From source to RTK Fixed.
                                </h2>
                                <p className="mt-4 max-w-lg text-sm leading-6 text-black/52 sm:mt-5 sm:text-base sm:leading-7">
                                    Scroll through the four operational layers.
                                    The camera follows the active component and
                                    keeps its RTCM path visible.
                                </p>
                            </div>

                            <div className="mt-5 grid gap-5 sm:mt-7 sm:gap-7 lg:mt-10 lg:gap-10">
                                {NODE_ORDER.map((node) => {
                                    const content = NODE_CONTENT[node];
                                    const selected = activeNode === node;

                                    return (
                                        <article
                                            key={node}
                                            id={`architecture-${node}`}
                                            data-welcome-architecture-step={node}
                                            className="flex min-h-[48svh] scroll-mt-28 items-center sm:min-h-[54svh] lg:min-h-[62svh]"
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => {
                                                    setActiveNode(node);
                                                    scrollToArchitectureNode(node);
                                                }}
                                                onFocus={() => setActiveNode(node)}
                                                onPointerEnter={() =>
                                                    setActiveNode(node)
                                                }
                                                className={`group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.35rem] border px-4 py-4 text-left shadow-[0_18px_55px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-4 sm:rounded-[1.6rem] sm:px-5 sm:py-5 ${
                                                    selected
                                                        ? 'border-black bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,0.2)]'
                                                        : 'border-black/[0.08] bg-white/90 hover:-translate-y-0.5 hover:border-black/14 hover:bg-white'
                                                }`}
                                            >
                                                <span
                                                    className={`grid size-10 place-items-center rounded-xl text-xs font-bold sm:size-12 sm:rounded-2xl sm:text-sm ${
                                                        selected
                                                            ? 'bg-white/12 text-white'
                                                            : 'bg-black/[0.05] text-black/45'
                                                    }`}
                                                >
                                                    {content.index}
                                                </span>

                                                <span className="min-w-0">
                                                    <span className="block text-sm font-semibold sm:text-base">
                                                        {content.label}
                                                    </span>
                                                    <span
                                                        className={`mt-1 block text-xs leading-5 sm:text-sm sm:leading-6 ${
                                                            selected
                                                                ? 'text-white/58'
                                                                : 'text-black/48'
                                                        }`}
                                                    >
                                                        {content.title}
                                                    </span>
                                                    <span
                                                        className={`mt-2 hidden text-xs leading-5 sm:block ${
                                                            selected
                                                                ? 'text-white/42'
                                                                : 'text-black/38'
                                                        }`}
                                                    >
                                                        {content.description}
                                                    </span>
                                                </span>

                                                <ArrowRight
                                                    className={`size-4 shrink-0 transition group-hover:translate-x-0.5 sm:size-5 ${
                                                        selected
                                                            ? 'text-white/65'
                                                            : 'text-black/28'
                                                    }`}
                                                />
                                            </button>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section
                        id="capabilities"
                        className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:min-h-[110svh] lg:px-10 lg:py-24"
                    >
                        <div className="max-w-4xl rounded-[1.5rem] border border-black/[0.08] bg-white/92 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:p-8">
                            <p className="text-[10px] font-bold tracking-[0.16em] text-black/38 uppercase sm:text-[11px]">
                                Core capabilities
                            </p>

                            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] md:items-end md:gap-8">
                                <h2 className="max-w-[12ch] text-[clamp(2.25rem,10vw,4rem)] leading-[0.96] font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                                    Built for live correction networks.
                                </h2>
                                <p className="text-sm leading-6 text-black/50 sm:text-base sm:leading-7">
                                    The production scene already supports your
                                    real ZD550 UAV and RTK base GLB files. The
                                    Caster and Rover remain lightweight
                                    procedural models.
                                </p>
                            </div>

                            <div className="mt-7 grid gap-2.5 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
                                {CAPABILITIES.map((capability) => {
                                    const Icon = capability.icon;

                                    return (
                                        <article
                                            key={capability.title}
                                            className="rounded-2xl border border-black/[0.07] bg-white/68 p-4 transition hover:-translate-y-0.5 hover:border-black/12 hover:bg-white sm:p-5"
                                        >
                                            <span className="grid size-10 place-items-center rounded-xl bg-black text-white sm:size-11">
                                                <Icon
                                                    className="size-4 sm:size-[1.125rem]"
                                                    strokeWidth={1.8}
                                                />
                                            </span>
                                            <h3 className="mt-4 text-sm font-semibold sm:mt-5">
                                                {capability.title}
                                            </h3>
                                            <p className="mt-2 text-xs leading-5 text-black/48 sm:text-[13px] sm:leading-5">
                                                {capability.description}
                                            </p>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section
                        id="platform"
                        className="mx-auto flex max-w-[1440px] scroll-mt-20 items-end px-4 py-10 sm:min-h-[90svh] sm:px-6 sm:py-14 md:px-8 lg:min-h-[100svh] lg:px-10"
                    >
                        <div className="w-full overflow-hidden rounded-[1.5rem] border border-black/[0.08] bg-black text-white shadow-[0_35px_110px_rgba(0,0,0,0.22)] sm:rounded-[2rem]">
                            <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-14">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase sm:text-[11px]">
                                        <ServerCog className="size-4" />
                                        Production-ready foundation
                                    </div>
                                    <h2 className="mt-4 max-w-[13ch] text-[clamp(2.25rem,10vw,4rem)] leading-[0.96] font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                                        Build your precision network.
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:mt-5 sm:text-base sm:leading-7">
                                        Laravel, React, PostgreSQL, Redis,
                                        Reverb and the NTRIP TCP service work as
                                        one operational platform.
                                    </p>
                                </div>

                                <Link
                                    href={auth.user ? dashboard() : register()}
                                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none sm:w-auto"
                                >
                                    {auth.user
                                        ? 'Open dashboard'
                                        : 'Create an account'}
                                    <ArrowRight className="size-4" />
                                </Link>
                            </div>

                            <div className="grid border-t border-white/10 sm:grid-cols-3">
                                {[
                                    ['01', 'Base stations', 'RTCM source layer'],
                                    ['02', 'Caster runtime', 'Realtime control plane'],
                                    ['03', 'UAV and rover', 'Precision client layer'],
                                ].map(([index, title, description]) => (
                                    <div
                                        key={index}
                                        className="border-b border-white/10 p-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 sm:p-6"
                                    >
                                        <span className="text-[10px] font-bold tracking-[0.14em] text-white/30">
                                            {index}
                                        </span>
                                        <p className="mt-3 text-sm font-semibold">
                                            {title}
                                        </p>
                                        <p className="mt-1 text-xs text-white/42">
                                            {description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <footer className="mx-auto max-w-[1440px] px-4 pb-6 sm:px-6 sm:pb-8 md:px-8 lg:px-10">
                        <div className="flex flex-col gap-3 border-t border-black/[0.08] py-5 text-xs text-black/42 sm:flex-row sm:items-center sm:justify-between">
                            <p>NTRIP Caster · Realtime GNSS infrastructure</p>
                            <p>Base → Caster → UAV / Rover</p>
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
