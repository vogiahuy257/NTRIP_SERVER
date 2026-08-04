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
    Satellite,
    ServerCog,
    ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

import {
    WelcomeThreeScene,
} from '@/components/welcome-3d/welcome-three-scene';
import type { WelcomeSceneNode } from '@/components/welcome-3d/welcome-model-assets';
import { dashboard, login, register } from '@/routes';

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

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

export default function Welcome() {
    const { auth } = usePage().props;
    const [activeNode, setActiveNode] = useState<WelcomeSceneNode>('caster');
    const activeContent = NODE_CONTENT[activeNode];

    return (
        <>
            <Head title="Realtime GNSS Correction Network">
                <meta
                    name="description"
                    content="Manage RTK base stations, RTCM streams, mountpoints, UAVs and autonomous rovers through one realtime NTRIP platform."
                />
            </Head>

            <div className="relative min-h-screen overflow-x-clip bg-[#f7f7f3] text-[#11110f] selection:bg-black selection:text-white">
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 z-0 opacity-55"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px)',
                        backgroundSize: '64px 64px',
                        maskImage:
                            'linear-gradient(to bottom, black, transparent 88%)',
                    }}
                />

                <WelcomeThreeScene
                    activeNode={activeNode}
                    onActiveNodeChange={setActiveNode}
                    className="fixed inset-0 z-[1]"
                />

                <header className="fixed top-0 right-0 left-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
                    <nav className="mx-auto flex h-14 max-w-[1440px] items-center justify-between rounded-2xl border border-black/[0.08] bg-white/70 px-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:h-16 sm:px-4">
                        <button
                            type="button"
                            onClick={() => scrollToSection('hero')}
                            className="flex items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:outline-none"
                        >
                            <span className="grid size-9 place-items-center rounded-xl bg-black text-white sm:size-10">
                                <RadioTower className="size-4.5" strokeWidth={1.8} />
                            </span>

                            <span>
                                <span className="block text-sm leading-none font-bold tracking-[-0.025em]">
                                    NTRIP Caster
                                </span>
                                <span className="mt-1 hidden text-[11px] leading-none text-black/45 sm:block">
                                    GNSS correction infrastructure
                                </span>
                            </span>
                        </button>

                        <div className="hidden items-center gap-1 lg:flex">
                            {[
                                ['Architecture', 'architecture'],
                                ['Capabilities', 'capabilities'],
                                ['Platform', 'platform'],
                            ].map(([label, id]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => scrollToSection(id)}
                                    className="rounded-xl px-3 py-2 text-xs font-semibold text-black/55 transition hover:bg-black/[0.05] hover:text-black"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-black px-3.5 text-xs font-semibold text-white transition hover:bg-black/[0.82]"
                                >
                                    Dashboard
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="hidden min-h-9 items-center rounded-xl px-3 text-xs font-semibold text-black/60 transition hover:bg-black/[0.05] hover:text-black sm:inline-flex"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-black px-3.5 text-xs font-semibold text-white transition hover:bg-black/[0.82]"
                                    >
                                        Get started
                                        <ArrowRight className="size-3.5" />
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </header>

                <main className="pointer-events-none relative z-10">
                    <section
                        id="hero"
                        className="mx-auto grid min-h-[100svh] max-w-[1440px] items-center px-5 pt-28 pb-16 sm:px-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(28rem,1.18fr)] lg:px-10"
                    >
                        <div className="pointer-events-auto max-w-2xl lg:pb-10">
                            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-black/55 uppercase backdrop-blur-xl">
                                <span className="size-1.5 rounded-full bg-black" />
                                Realtime GNSS infrastructure
                            </div>

                            <h1 className="mt-6 max-w-[12ch] text-[clamp(3rem,7vw,7.2rem)] leading-[0.88] font-semibold tracking-[-0.07em] text-black">
                                Precision correction.
                                <span className="block text-black/35">
                                    Delivered everywhere.
                                </span>
                            </h1>

                            <p className="mt-7 max-w-xl text-[clamp(1rem,1.6vw,1.25rem)] leading-7 text-black/55">
                                Manage RTK base stations, RTCM streams,
                                mountpoints, UAVs and autonomous rovers from one
                                production-ready control plane.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    href={auth.user ? dashboard() : login()}
                                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-black px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-black/84"
                                >
                                    {auth.user ? 'Open dashboard' : 'Open platform'}
                                    <ArrowRight className="size-4" />
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => scrollToSection('architecture')}
                                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white/72 px-5 text-sm font-semibold text-black backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white"
                                >
                                    Explore the network
                                    <ArrowDown className="size-4" />
                                </button>
                            </div>

                            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-black/40">
                                <span>Realtime RTCM</span>
                                <span className="size-1 rounded-full bg-black/20" />
                                <span>WebSocket telemetry</span>
                                <span className="size-1 rounded-full bg-black/20" />
                                <span>Redis-backed runtime</span>
                            </div>
                        </div>

                        <div className="pointer-events-none min-h-[44svh] lg:min-h-0" />

                        <div className="pointer-events-auto absolute right-5 bottom-6 left-5 sm:right-8 sm:left-auto sm:w-[22rem] lg:right-10 lg:bottom-10">
                            <div className="rounded-2xl border border-black/[0.08] bg-white/72 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold tracking-[0.14em] text-black/38 uppercase">
                                            Interactive scene
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {activeContent.label}
                                        </p>
                                    </div>

                                    <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-bold text-black/48">
                                        {activeContent.index}
                                    </span>
                                </div>

                                <p className="mt-3 text-xs leading-5 text-black/52">
                                    Drag with the mouse to rotate. Hover or click
                                    a model to inspect it. Scroll to move the
                                    camera through the network.
                                </p>

                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-black/48">
                                    <MousePointer2 className="size-3.5" />
                                    Mouse interaction enabled
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="architecture"
                        className="mx-auto flex min-h-[115svh] max-w-[1440px] items-center px-5 py-24 sm:px-8 lg:px-10"
                    >
                        <div className="pointer-events-auto ml-auto w-full max-w-xl rounded-[2rem] border border-black/[0.08] bg-white/78 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:p-8">
                            <p className="text-[11px] font-bold tracking-[0.16em] text-black/38 uppercase">
                                Architecture
                            </p>
                            <h2 className="mt-3 max-w-[13ch] text-4xl leading-[0.95] font-semibold tracking-[-0.055em] sm:text-6xl">
                                From source to RTK Fixed.
                            </h2>
                            <p className="mt-5 max-w-lg text-sm leading-6 text-black/52 sm:text-base sm:leading-7">
                                One continuous correction path connects field
                                infrastructure to autonomous clients while every
                                stream remains observable.
                            </p>

                            <div className="mt-7 grid gap-2">
                                {INTERACTIVE_NODE_ORDER.map((node) => {
                                    const content = NODE_CONTENT[node];
                                    const selected = activeNode === node;

                                    return (
                                        <button
                                            key={node}
                                            type="button"
                                            onClick={() => setActiveNode(node)}
                                            className={`group grid grid-cols-[2.4rem_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${
                                                selected
                                                    ? 'border-black/12 bg-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.14)]'
                                                    : 'border-black/[0.07] bg-white/58 hover:border-black/12 hover:bg-white'
                                            }`}
                                        >
                                            <span
                                                className={`grid size-9 place-items-center rounded-xl text-xs font-bold ${
                                                    selected
                                                        ? 'bg-white/12 text-white'
                                                        : 'bg-black/[0.05] text-black/45'
                                                }`}
                                            >
                                                {content.index}
                                            </span>

                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold">
                                                    {content.label}
                                                </span>
                                                <span
                                                    className={`mt-0.5 block truncate text-xs ${
                                                        selected
                                                            ? 'text-white/55'
                                                            : 'text-black/42'
                                                    }`}
                                                >
                                                    {content.title}
                                                </span>
                                            </span>

                                            <ArrowRight
                                                className={`size-4 transition group-hover:translate-x-0.5 ${
                                                    selected
                                                        ? 'text-white/65'
                                                        : 'text-black/28'
                                                }`}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section
                        id="capabilities"
                        className="mx-auto min-h-[115svh] max-w-[1440px] px-5 py-24 sm:px-8 lg:px-10"
                    >
                        <div className="pointer-events-auto max-w-3xl rounded-[2rem] border border-black/[0.08] bg-white/80 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:p-8">
                            <p className="text-[11px] font-bold tracking-[0.16em] text-black/38 uppercase">
                                Core capabilities
                            </p>
                            <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                                <h2 className="max-w-[11ch] text-4xl leading-[0.95] font-semibold tracking-[-0.055em] sm:text-6xl">
                                    Built for live correction networks.
                                </h2>
                                <p className="max-w-sm text-sm leading-6 text-black/50">
                                    The welcome scene is procedural today and
                                    ready to receive your real ZD550 UAV, RTK
                                    base and rover GLB models later.
                                </p>
                            </div>

                            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {CAPABILITIES.map((capability) => {
                                    const Icon = capability.icon;

                                    return (
                                        <article
                                            key={capability.title}
                                            className="rounded-2xl border border-black/[0.07] bg-white/62 p-4 transition hover:-translate-y-0.5 hover:border-black/12 hover:bg-white"
                                        >
                                            <span className="grid size-10 place-items-center rounded-xl bg-black text-white">
                                                <Icon className="size-4.5" strokeWidth={1.8} />
                                            </span>
                                            <h3 className="mt-5 text-sm font-semibold">
                                                {capability.title}
                                            </h3>
                                            <p className="mt-2 text-xs leading-5 text-black/48">
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
                        className="mx-auto flex min-h-[100svh] max-w-[1440px] items-end px-5 py-10 sm:px-8 lg:px-10 lg:py-14"
                    >
                        <div className="pointer-events-auto w-full overflow-hidden rounded-[2rem] border border-black/[0.08] bg-black text-white shadow-[0_35px_110px_rgba(0,0,0,0.22)]">
                            <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end lg:p-14">
                                <div>
                                    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">
                                        <ServerCog className="size-4" />
                                        Production-ready foundation
                                    </div>
                                    <h2 className="mt-4 max-w-[13ch] text-4xl leading-[0.95] font-semibold tracking-[-0.055em] sm:text-6xl">
                                        Build your precision network.
                                    </h2>
                                    <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55 sm:text-base sm:leading-7">
                                        Laravel, React, PostgreSQL, Redis,
                                        Reverb and the NTRIP TCP service work as
                                        one operational platform.
                                    </p>
                                </div>

                                <Link
                                    href={auth.user ? dashboard() : register()}
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90"
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
                                        className="border-white/10 p-5 sm:border-r sm:last:border-r-0 sm:p-6"
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
                </main>

                <div className="pointer-events-none fixed right-3 bottom-3 z-30 hidden rounded-full border border-black/10 bg-white/68 px-3 py-2 text-[10px] font-semibold text-black/42 backdrop-blur-xl sm:block">
                    Scroll to move · Drag to rotate · Click to inspect
                </div>
            </div>
        </>
    );
}

const INTERACTIVE_NODE_ORDER: WelcomeSceneNode[] = [
    'base',
    'caster',
    'uav',
    'rover',
];
