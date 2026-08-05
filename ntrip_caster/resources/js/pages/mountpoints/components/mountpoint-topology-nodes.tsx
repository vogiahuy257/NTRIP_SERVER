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
                'w-[13.75rem] rounded-[1.1rem] border px-3 py-2.5 shadow-ntrip-node transition',
                'border-ntrip-cloud/10 bg-ntrip-ink/92 text-ntrip-cloud backdrop-blur-xl',
                selected && 'border-ntrip-teal/68 shadow-ntrip-node-selected',
            )}
        >
            {children}
        </div>
    );
}

function StatusLine({
    status,
    label,
    trailing,
}: {
    status: 'online' | 'waiting-source' | 'degraded' | 'disabled';
    label: string;
    trailing?: string;
}) {
    return (
        <div className="mt-2.5 flex items-center justify-between gap-3 text-2xs">
            <span
                data-status={status}
                className="ntrip-status-inline inline-flex min-w-0 items-center gap-1.5"
            >
                <span className="ntrip-status-inline__dot size-1.5 shrink-0 rounded-full" />
                <span className="truncate">{label}</span>
            </span>

            {trailing ? (
                <span className="shrink-0 font-mono text-ntrip-cloud/44">
                    {trailing}
                </span>
            ) : null}
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
                <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ntrip-cloud/7 text-ntrip-cloud/66">
                        <Server className="size-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                            {data.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-3xs text-ntrip-cloud/40">
                            {data.deviceId}
                        </p>
                    </div>
                </div>

                <StatusLine
                    status={data.online ? 'online' : 'disabled'}
                    label={data.online ? 'Source online' : 'Source offline'}
                    trailing={`${data.mountpointCount} MP`}
                />
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
                <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ntrip-teal/12 text-ntrip-teal">
                        <RadioTower className="size-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-semibold">
                            {data.name}
                        </p>
                        <p className="mt-0.5 truncate text-3xs text-ntrip-cloud/40">
                            {data.identifier ?? 'NTRIP mountpoint'}
                        </p>
                    </div>
                </div>

                <StatusLine
                    status={data.status}
                    label={STATUS_LABELS[data.status]}
                    trailing={`${data.connectedRoverCount} R · ${data.bitrate}`}
                />
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
    if (!data.accessEnabled || data.accountStatus === 'disabled') {
        return {
            label: 'Access disabled',
            dataStatus: 'disabled',
            iconClass: 'bg-ntrip-coral/10 text-ntrip-coral',
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
            data.accountStatus === 'unregistered' ? 'Unregistered' : 'Offline',
        dataStatus: 'waiting-source',
        iconClass: 'bg-ntrip-cloud/7 text-ntrip-cloud/54',
    };
}

export function RoverTopologyNode({
    data,
    selected,
}: NodeProps<Node<RoverNodeData, 'rover'>>) {
    const state = roverState(data);
    const statusLabel =
        data.autoMountpoint && data.autoState !== null
            ? data.autoState.replaceAll('_', ' ')
            : state.label;

    return (
        <>
            <HiddenHandle type="target" position={Position.Left} />

            <NodeShell selected={selected}>
                <div className="flex items-center gap-2.5">
                    <span
                        className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-lg',
                            state.iconClass,
                        )}
                    >
                        {data.connected ? (
                            <Wifi className="size-3.5" />
                        ) : data.username ? (
                            <CircleUserRound className="size-3.5" />
                        ) : (
                            <WifiOff className="size-3.5" />
                        )}
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-xs font-semibold">
                                {data.label}
                            </p>
                            {data.autoMountpoint ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ntrip-teal/12 px-1.5 py-0.5 text-[8px] font-semibold text-ntrip-teal uppercase">
                                    <Route className="size-2.5" />
                                    Auto
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-3xs text-ntrip-cloud/40">
                            {data.username ?? data.remoteIp ?? 'Unknown Rover'}
                        </p>
                    </div>
                </div>

                <StatusLine
                    status={state.dataStatus}
                    label={statusLabel}
                    trailing={`${data.sessionCount} session${data.sessionCount === 1 ? '' : 's'}`}
                />
            </NodeShell>
        </>
    );
}
