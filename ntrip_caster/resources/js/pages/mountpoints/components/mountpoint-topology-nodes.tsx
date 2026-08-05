import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import {
    CircleUserRound,
    RadioTower,
    Route,
    Server,
    Wifi,
    WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { MountpointStatus } from '../types';

export type StationNodeData = {
    kind: 'station';
    entityId: string;
    name: string;
    deviceId: string;
    online: boolean;
    mountpointCount: number;
};

export type MountpointNodeData = {
    kind: 'mountpoint';
    entityId: string;
    name: string;
    identifier: string | null;
    status: MountpointStatus;
    registeredRoverCount: number;
    connectedRoverCount: number;
    bitrate: string;
};

export type RoverTopologyStatus =
    'active' | 'disabled' | 'expired' | 'unregistered';

export type RoverNodeData = {
    kind: 'rover';
    entityId: string;
    accountId: number | null;
    label: string;
    displayName: string | null;
    remoteIp: string | null;
    username: string | null;
    bytesTransferred: string;
    connected: boolean;
    sessionCount: number;
    accountStatus: RoverTopologyStatus;
    accessEnabled: boolean;
    autoMountpoint: boolean;
    autoState: 'waiting_for_gga' | 'waiting_for_base' | 'assigned' | null;
    mountpointSwitchCount: number;
};

export type TopologyNode =
    | Node<StationNodeData, 'station'>
    | Node<MountpointNodeData, 'mountpoint'>
    | Node<RoverNodeData, 'rover'>;

const STATUS_LABELS: Record<MountpointStatus, string> = {
    online: 'Online',
    'waiting-source': 'Waiting source',
    degraded: 'Degraded',
    disabled: 'Disabled',
};

function HiddenHandle({
    type,
    position,
}: {
    type: 'source' | 'target';
    position: Position;
}) {
    return (
        <Handle
            type={type}
            position={position}
            className="!size-2 !border-0 !bg-ntrip-teal !opacity-0"
        />
    );
}

function NodeShell({
    selected,
    children,
}: {
    selected: boolean;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'min-w-60 rounded-control border px-3.5 py-3 shadow-ntrip-node transition',
                'border-ntrip-cloud/12 bg-ntrip-ink/94 text-ntrip-cloud',
                selected && 'border-ntrip-teal/72 shadow-ntrip-node-selected',
            )}
        >
            {children}
        </div>
    );
}

export function StationTopologyNode({
    data,
    selected,
}: NodeProps<Node<StationNodeData, 'station'>>) {
    return (
        <>
            <NodeShell selected={selected}>
                <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-control-sm bg-ntrip-cloud/8 text-ntrip-cloud/74">
                        <Server className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-caption font-semibold">
                            {data.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-2xs text-ntrip-cloud/48">
                            {data.deviceId}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-2xs">
                    <span
                        data-status={data.online ? 'online' : 'disabled'}
                        className="ntrip-status-inline inline-flex items-center gap-1.5"
                    >
                        <span className="ntrip-status-inline__dot size-2 rounded-full" />
                        {data.online ? 'Source online' : 'Source offline'}
                    </span>

                    <span className="rounded-full bg-ntrip-cloud/7 px-2 py-1 text-ntrip-cloud/58">
                        {data.mountpointCount} mountpoint
                        {data.mountpointCount === 1 ? '' : 's'}
                    </span>
                </div>
            </NodeShell>

            <HiddenHandle type="source" position={Position.Right} />
        </>
    );
}

export function MountpointTopologyNode({
    data,
    selected,
}: NodeProps<Node<MountpointNodeData, 'mountpoint'>>) {
    return (
        <>
            <HiddenHandle type="target" position={Position.Left} />

            <NodeShell selected={selected}>
                <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-control-xs bg-ntrip-teal/12 text-ntrip-teal">
                        <RadioTower className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-caption font-semibold">
                            {data.name}
                        </p>
                        <p className="mt-0.5 truncate text-2xs text-ntrip-cloud/46">
                            {data.identifier ?? 'NTRIP mountpoint'}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs">
                    <span
                        data-status={data.status}
                        className="ntrip-status-inline inline-flex items-center gap-1.5"
                    >
                        <span className="ntrip-status-inline__dot size-2 rounded-full" />
                        {STATUS_LABELS[data.status]}
                    </span>

                    <span className="rounded-full bg-ntrip-cloud/7 px-2 py-1 text-ntrip-cloud/58">
                        {data.registeredRoverCount} registered
                    </span>

                    <span
                        className={cn(
                            'rounded-full px-2 py-1',
                            data.connectedRoverCount > 0
                                ? 'bg-ntrip-teal/12 text-ntrip-teal'
                                : 'bg-ntrip-cloud/7 text-ntrip-cloud/58',
                        )}
                    >
                        {data.connectedRoverCount} connected
                    </span>

                    <span className="rounded-full bg-ntrip-cloud/7 px-2 py-1 font-mono text-ntrip-cloud/58">
                        {data.bitrate}
                    </span>
                </div>
            </NodeShell>

            <HiddenHandle type="source" position={Position.Right} />
        </>
    );
}

function roverState(data: RoverNodeData): {
    label: string;
    dataStatus: 'online' | 'waiting-source' | 'disabled';
    iconClass: string;
} {
    if (!data.accessEnabled) {
        return {
            label: 'Access disabled',
            dataStatus: 'disabled',
            iconClass: 'bg-ntrip-coral/12 text-ntrip-coral',
        };
    }

    if (data.accountStatus === 'disabled') {
        return {
            label: 'Account disabled',
            dataStatus: 'disabled',
            iconClass: 'bg-ntrip-cloud/8 text-ntrip-cloud/46',
        };
    }

    if (data.accountStatus === 'expired') {
        return {
            label: 'Account expired',
            dataStatus: 'disabled',
            iconClass: 'bg-ntrip-amber/12 text-ntrip-amber',
        };
    }

    if (data.connected) {
        return {
            label: 'Connected',
            dataStatus: 'online',
            iconClass: 'bg-ntrip-teal/12 text-ntrip-teal',
        };
    }

    return {
        label:
            data.accountStatus === 'unregistered'
                ? 'Unregistered session'
                : 'Registered · Offline',
        dataStatus: 'waiting-source',
        iconClass: 'bg-ntrip-cloud/8 text-ntrip-cloud/62',
    };
}

export function RoverTopologyNode({
    data,
    selected,
}: NodeProps<Node<RoverNodeData, 'rover'>>) {
    const state = roverState(data);

    return (
        <>
            <HiddenHandle type="target" position={Position.Left} />

            <NodeShell selected={selected}>
                <div className="flex items-center gap-3">
                    <span
                        className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-control-xs',
                            state.iconClass,
                        )}
                    >
                        {data.connected ? (
                            <Wifi className="size-4" />
                        ) : data.username ? (
                            <CircleUserRound className="size-4" />
                        ) : (
                            <WifiOff className="size-4" />
                        )}
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-xs font-semibold">
                                {data.label}
                            </p>
                            {data.autoMountpoint ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ntrip-teal/12 px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.08em] text-ntrip-teal uppercase">
                                    <Route className="size-2.5" />
                                    Auto
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-2xs text-ntrip-cloud/45">
                            {data.username ?? data.remoteIp ?? 'Unknown Rover'}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-2xs">
                    <span
                        data-status={state.dataStatus}
                        className="ntrip-status-inline inline-flex items-center gap-1.5"
                    >
                        <span className="ntrip-status-inline__dot size-2 rounded-full" />
                        {data.autoMountpoint && data.autoState !== null
                            ? data.autoState.replaceAll('_', ' ')
                            : state.label}
                    </span>

                    <span className="font-mono text-ntrip-cloud/52">
                        {data.connected
                            ? `${data.sessionCount} session${data.sessionCount === 1 ? '' : 's'} · ${data.bytesTransferred}`
                            : '0 sessions'}
                    </span>
                </div>
            </NodeShell>
        </>
    );
}
