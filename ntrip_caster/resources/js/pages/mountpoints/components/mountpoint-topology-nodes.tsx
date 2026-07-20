import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CircleUserRound, RadioTower, Server, Wifi } from 'lucide-react';
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
    roverCount: number;
    bitrate: string;
};

export type RoverNodeData = {
    kind: 'rover';
    entityId: string;
    label: string;
    remoteIp: string | null;
    username: string | null;
    bytesTransferred: string;
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
                        {data.roverCount} rover
                        {data.roverCount === 1 ? '' : 's'}
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

export function RoverTopologyNode({
    data,
    selected,
}: NodeProps<Node<RoverNodeData, 'rover'>>) {
    return (
        <>
            <HiddenHandle type="target" position={Position.Left} />

            <NodeShell selected={selected}>
                <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-control-xs bg-ntrip-cloud/8 text-ntrip-cloud/72">
                        {data.username ? (
                            <CircleUserRound className="size-4" />
                        ) : (
                            <Wifi className="size-4" />
                        )}
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                            {data.label}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-2xs text-ntrip-cloud/45">
                            {data.remoteIp ?? 'Unknown remote IP'}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-2xs">
                    <span
                        data-status="online"
                        className="ntrip-status-inline inline-flex items-center gap-1.5"
                    >
                        <span className="ntrip-status-inline__dot size-2 rounded-full" />
                        Connected
                    </span>

                    <span className="font-mono text-ntrip-cloud/52">
                        {data.bytesTransferred}
                    </span>
                </div>
            </NodeShell>
        </>
    );
}
