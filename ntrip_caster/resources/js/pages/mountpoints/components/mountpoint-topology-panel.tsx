import {
    Background,
    BackgroundVariant,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from '@xyflow/react';
import type { Edge, NodeTypes } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RoverAccount } from '@/features/rover-accounts/types';
import { cn } from '@/lib/utils';

import { formatBitrate, formatBytes } from '../lib/mountpoint-data';

import type { ActiveSession, MountpointWithSessions } from '../types';
import {
    MountpointTopologyNode,
    RoverTopologyNode,
    StationTopologyNode,
} from './mountpoint-topology-nodes';
import type {
    MountpointNodeData,
    RoverNodeData,
    StationNodeData,
    TopologyNode,
} from './mountpoint-topology-nodes';

const elk = new ELK();
const MAX_VISIBLE_ROVERS_PER_MOUNTPOINT = 8;

const nodeTypes: NodeTypes = {
    station: StationTopologyNode,
    mountpoint: MountpointTopologyNode,
    rover: RoverTopologyNode,
};

export type SelectedTopologyEntity =
    StationNodeData | MountpointNodeData | RoverNodeData | null;

type MountpointTopologyPanelProps = {
    mountpoints: MountpointWithSessions[];
    roverAccounts: RoverAccount[];
    selectedEntity: SelectedTopologyEntity;
    onSelectEntity: (entity: SelectedTopologyEntity) => void;
};

type ElkChild = {
    id: string;
    x?: number;
    y?: number;
};

function normalizeUsername(value: string | null): string {
    return value?.trim().toLowerCase() ?? '';
}

function registeredAccountsForMountpoint(
    accounts: RoverAccount[],
    mountpointId: string,
): Array<{
    account: RoverAccount;
    accessEnabled: boolean;
}> {
    return accounts.flatMap((account) => {
        const assignedMountpoint = account.mountpoints.find(
            (mountpoint) => String(mountpoint.id) === mountpointId,
        );

        if (assignedMountpoint === undefined) {
            return [];
        }

        return [
            {
                account,
                accessEnabled: assignedMountpoint.access?.enabled ?? true,
            },
        ];
    });
}

function summarizeRemoteIps(sessions: ActiveSession[]): string | null {
    const remoteIps = Array.from(
        new Set(
            sessions
                .map((session) => session.remoteIp)
                .filter((remoteIp): remoteIp is string => remoteIp !== null),
        ),
    );

    if (remoteIps.length === 0) {
        return null;
    }

    if (remoteIps.length === 1) {
        return remoteIps[0];
    }

    return `${remoteIps[0]} +${remoteIps.length - 1}`;
}

function createTopology(
    mountpoints: MountpointWithSessions[],
    roverAccounts: RoverAccount[],
): {
    nodes: TopologyNode[];
    edges: Edge[];
} {
    const nodes: TopologyNode[] = [];
    const edges: Edge[] = [];
    const stationGroups = new Map<
        string,
        {
            name: string;
            deviceId: string;
            online: boolean;
            mountpointCount: number;
        }
    >();

    for (const mountpoint of mountpoints) {
        const stationId = mountpoint.station?.id ?? 'unassigned';
        const current = stationGroups.get(stationId);

        stationGroups.set(stationId, {
            name: mountpoint.station?.name ?? 'Unassigned source station',
            deviceId: mountpoint.station?.deviceId ?? 'NO-STATION',
            online:
                (current?.online ?? false) ||
                (mountpoint.station?.sourceConnected ?? false),
            mountpointCount: (current?.mountpointCount ?? 0) + 1,
        });
    }

    for (const [stationId, station] of stationGroups) {
        nodes.push({
            id: `station:${stationId}`,
            type: 'station',
            position: { x: 0, y: 0 },
            width: 250,
            height: 105,
            data: {
                kind: 'station',
                entityId: stationId,
                name: station.name,
                deviceId: station.deviceId,
                online: station.online,
                mountpointCount: station.mountpointCount,
            },
        });
    }

    for (const mountpoint of mountpoints) {
        const stationId = mountpoint.station?.id ?? 'unassigned';
        const mountpointNodeId = `mountpoint:${mountpoint.id}`;
        const registeredAccounts = registeredAccountsForMountpoint(
            roverAccounts,
            mountpoint.id,
        );
        const registeredUsernames = new Set(
            registeredAccounts.map(({ account }) =>
                normalizeUsername(account.username),
            ),
        );

        const roverCandidates: Array<{
            id: string;
            connected: boolean;
            data: RoverNodeData;
        }> = registeredAccounts.map(({ account, accessEnabled }) => {
            const accountSessions = mountpoint.sessions.filter(
                (session) =>
                    normalizeUsername(session.username) ===
                    normalizeUsername(account.username),
            );
            const bytesTransferred = accountSessions.reduce(
                (total, session) => total + session.bytesTransferred,
                0,
            );

            return {
                id: `account:${account.id}`,
                connected: accountSessions.length > 0,
                data: {
                    kind: 'rover',
                    entityId: `account-${account.id}-mountpoint-${mountpoint.id}`,
                    accountId: account.id,
                    label: account.displayName ?? account.username,
                    displayName: account.displayName,
                    remoteIp: summarizeRemoteIps(accountSessions),
                    username: account.username,
                    bytesTransferred: formatBytes(bytesTransferred),
                    connected: accountSessions.length > 0,
                    sessionCount: accountSessions.length,
                    accountStatus: account.status,
                    accessEnabled,
                },
            };
        });

        for (const session of mountpoint.sessions) {
            const normalizedSessionUsername = normalizeUsername(
                session.username,
            );

            if (
                normalizedSessionUsername !== '' &&
                registeredUsernames.has(normalizedSessionUsername)
            ) {
                continue;
            }

            roverCandidates.push({
                id: `session:${session.id}`,
                connected: true,
                data: {
                    kind: 'rover',
                    entityId: session.id,
                    accountId: null,
                    label: session.username ?? 'Unregistered Rover',
                    displayName: null,
                    remoteIp: session.remoteIp,
                    username: session.username,
                    bytesTransferred: formatBytes(session.bytesTransferred),
                    connected: true,
                    sessionCount: 1,
                    accountStatus: 'unregistered',
                    accessEnabled: true,
                },
            });
        }

        roverCandidates.sort((left, right) => {
            if (left.connected !== right.connected) {
                return left.connected ? -1 : 1;
            }

            return left.data.label.localeCompare(right.data.label);
        });

        const connectedRoverCount = roverCandidates.filter(
            (candidate) => candidate.connected,
        ).length;

        nodes.push({
            id: mountpointNodeId,
            type: 'mountpoint',
            position: { x: 0, y: 0 },
            width: 270,
            height: 120,
            data: {
                kind: 'mountpoint',
                entityId: mountpoint.id,
                name: mountpoint.name,
                identifier: mountpoint.identifier,
                status: mountpoint.status,
                registeredRoverCount: registeredAccounts.length,
                connectedRoverCount,
                bitrate: formatBitrate(mountpoint.uploadBps),
            },
        });

        edges.push({
            id: `edge:station:${stationId}:mountpoint:${mountpoint.id}`,
            source: `station:${stationId}`,
            target: mountpointNodeId,
            type: 'default',
            className: 'ntrip-topology-edge',
            animated: mountpoint.station?.sourceConnected ?? false,
            interactionWidth: 24,
            style: {
                strokeDasharray: '5 7',
                strokeLinecap: 'round',
                strokeWidth: 1.8,
                opacity: mountpoint.station?.sourceConnected ? 0.82 : 0.28,
            },
        });

        const visibleRovers = roverCandidates.slice(
            0,
            MAX_VISIBLE_ROVERS_PER_MOUNTPOINT,
        );

        for (const rover of visibleRovers) {
            const roverNodeId = `rover:${mountpoint.id}:${rover.id}`;

            nodes.push({
                id: roverNodeId,
                type: 'rover',
                position: { x: 0, y: 0 },
                width: 250,
                height: 108,
                data: rover.data,
            });

            edges.push({
                id: `edge:${mountpointNodeId}:${roverNodeId}`,
                source: mountpointNodeId,
                target: roverNodeId,
                type: 'default',
                className: 'ntrip-topology-edge',
                animated: rover.connected,
                interactionWidth: 24,
                style: {
                    strokeDasharray: '5 7',
                    strokeLinecap: 'round',
                    strokeWidth: rover.connected ? 1.8 : 1.4,
                    opacity: rover.connected ? 0.78 : 0.3,
                },
            });
        }

        const hiddenRoverCount = roverCandidates.length - visibleRovers.length;

        if (hiddenRoverCount > 0) {
            const hiddenRovers = roverCandidates.slice(
                MAX_VISIBLE_ROVERS_PER_MOUNTPOINT,
            );
            const hiddenSessionCount = hiddenRovers.reduce(
                (total, rover) => total + rover.data.sessionCount,
                0,
            );
            const roverNodeId = `rover:${mountpoint.id}:overflow`;

            nodes.push({
                id: roverNodeId,
                type: 'rover',
                position: { x: 0, y: 0 },
                width: 250,
                height: 108,
                data: {
                    kind: 'rover',
                    entityId: `overflow-${mountpoint.id}`,
                    accountId: null,
                    label: `+${hiddenRoverCount} more Rover Accounts`,
                    displayName: null,
                    remoteIp: null,
                    username: null,
                    bytesTransferred: 'Hidden by topology limit',
                    connected: hiddenSessionCount > 0,
                    sessionCount: hiddenSessionCount,
                    accountStatus: 'unregistered',
                    accessEnabled: true,
                },
            });

            edges.push({
                id: `edge:${mountpointNodeId}:${roverNodeId}`,
                source: mountpointNodeId,
                target: roverNodeId,
                type: 'default',
                className: 'ntrip-topology-edge',
                animated: hiddenSessionCount > 0,
                interactionWidth: 24,
                style: {
                    strokeDasharray: '5 7',
                    strokeLinecap: 'round',
                    strokeWidth: 1.5,
                    opacity: hiddenSessionCount > 0 ? 0.55 : 0.26,
                },
            });
        }
    }

    return { nodes, edges };
}

async function applyElkLayout(
    nodes: TopologyNode[],
    edges: Edge[],
): Promise<TopologyNode[]> {
    const graph = await elk.layout({
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.edgeRouting': 'SPLINES',
            'elk.spacing.nodeNode': '34',
            'elk.layered.spacing.nodeNodeBetweenLayers': '160',
            'elk.layered.spacing.edgeNodeBetweenLayers': '42',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        },
        children: nodes.map((node) => ({
            id: node.id,
            width: node.width ?? 240,
            height: node.height ?? 100,
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    });

    const positions = new Map(
        (graph.children as ElkChild[] | undefined)?.map((child) => [
            child.id,
            {
                x: child.x ?? 0,
                y: child.y ?? 0,
            },
        ]) ?? [],
    );

    return nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
    })) as TopologyNode[];
}

function MountpointTopologyCanvas({
    mountpoints,
    roverAccounts,
    selectedEntity,
    onSelectEntity,
}: MountpointTopologyPanelProps) {
    const topology = useMemo(
        () => createTopology(mountpoints, roverAccounts),
        [mountpoints, roverAccounts],
    );
    const topologyRef = useRef(topology);
    useEffect(() => {
        topologyRef.current = topology;
    }, [topology]);
    const initialFitCompletedRef = useRef(false);
    const [nodes, setNodes, onNodesChange] = useNodesState<TopologyNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [layouting, setLayouting] = useState(true);
    const { fitView } = useReactFlow<TopologyNode, Edge>();

    const structureKey = useMemo(() => {
        const nodeIds = topology.nodes
            .map((node) => node.id)
            .sort()
            .join('|');
        const edgeIds = topology.edges
            .map((edge) => edge.id)
            .sort()
            .join('|');

        return `${nodeIds}::${edgeIds}`;
    }, [topology.edges, topology.nodes]);

    useEffect(() => {
        let cancelled = false;

        const synchronizeStructure = async (): Promise<void> => {
            const latestTopology = topologyRef.current;
            const shouldShowLayouting = !initialFitCompletedRef.current;

            if (shouldShowLayouting) {
                setLayouting(true);
            }

            try {
                const laidOutNodes = await applyElkLayout(
                    latestTopology.nodes,
                    latestTopology.edges,
                );

                if (cancelled) {
                    return;
                }

                const shouldFitInitialView =
                    !initialFitCompletedRef.current &&
                    latestTopology.nodes.length > 0;

                setNodes((currentNodes) => {
                    const currentById = new Map(
                        currentNodes.map((node) => [node.id, node]),
                    );
                    const layoutById = new Map(
                        laidOutNodes.map((node) => [node.id, node]),
                    );

                    return latestTopology.nodes.map((nextNode) => {
                        const currentNode = currentById.get(nextNode.id);
                        const layoutNode = layoutById.get(nextNode.id);

                        return {
                            ...nextNode,
                            position:
                                currentNode?.position ??
                                layoutNode?.position ??
                                nextNode.position,
                            selected: currentNode?.selected ?? false,
                        } as TopologyNode;
                    });
                });

                setEdges(latestTopology.edges);

                if (shouldFitInitialView) {
                    initialFitCompletedRef.current = true;

                    window.requestAnimationFrame(() => {
                        void fitView({
                            duration: 420,
                            padding: 0.18,
                            maxZoom: 1.08,
                        });
                    });
                }
            } finally {
                if (!cancelled && shouldShowLayouting) {
                    setLayouting(false);
                }
            }
        };

        void synchronizeStructure();

        return () => {
            cancelled = true;
        };
    }, [fitView, setEdges, setNodes, structureKey]);

    useEffect(() => {
        const latestNodes = new Map(
            topology.nodes.map((node) => [node.id, node]),
        );
        const latestEdges = new Map(
            topology.edges.map((edge) => [edge.id, edge]),
        );

        setNodes((currentNodes) =>
            currentNodes.map((currentNode) => {
                const latestNode = latestNodes.get(currentNode.id);

                if (!latestNode) {
                    return currentNode;
                }

                return {
                    ...currentNode,
                    data: latestNode.data,
                    width: latestNode.width,
                    height: latestNode.height,
                } as TopologyNode;
            }),
        );

        setEdges((currentEdges) =>
            currentEdges.map((currentEdge) => {
                const latestEdge = latestEdges.get(currentEdge.id);

                if (!latestEdge) {
                    return currentEdge;
                }

                return {
                    ...currentEdge,
                    animated: latestEdge.animated,
                    className: latestEdge.className,
                    interactionWidth: latestEdge.interactionWidth,
                    style: latestEdge.style,
                };
            }),
        );
    }, [setEdges, setNodes, topology]);

    useEffect(() => {
        setNodes((currentNodes) =>
            currentNodes.map((node) => ({
                ...node,
                selected:
                    selectedEntity?.entityId === node.data.entityId &&
                    selectedEntity.kind === node.data.kind,
            })),
        );
    }, [selectedEntity, setNodes]);

    return (
        <div className="relative h-full min-h-136 overflow-hidden rounded-card-lg border border-ntrip-cloud/10 bg-ntrip-ink">
            <ReactFlow<TopologyNode, Edge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_event, node) => {
                    onSelectEntity(node.data);
                }}
                onPaneClick={() => {
                    onSelectEntity(null);
                }}
                nodesDraggable
                nodesConnectable={false}
                elementsSelectable
                minZoom={0.2}
                maxZoom={1.8}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={18}
                    size={1}
                    color="currentColor"
                    className="ntrip-topology-background opacity-[0.14]"
                />

                <Controls
                    position="bottom-left"
                    showInteractive={false}
                    className="ntrip-topology-controls"
                />
            </ReactFlow>

            {layouting ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ntrip-ink/32 backdrop-blur-ntrip-overlay">
                    <div className="inline-flex items-center gap-2 rounded-full border border-ntrip-cloud/10 bg-ntrip-ink/86 px-3 py-2 text-micro font-medium text-ntrip-cloud/64">
                        <LoaderCircle className="size-3.5 animate-spin text-ntrip-teal" />
                        Arranging topology
                    </div>
                </div>
            ) : null}

            <div
                className={cn(
                    'pointer-events-none absolute right-4 bottom-4 rounded-full border px-3 py-1.5 text-2xs font-medium backdrop-blur-xl',
                    'border-ntrip-cloud/10 bg-ntrip-ink/76 text-ntrip-cloud/48',
                )}
            >
                Drag nodes · Drag pane to pan · Scroll to zoom
            </div>
        </div>
    );
}

export function MountpointTopologyPanel(props: MountpointTopologyPanelProps) {
    return (
        <ReactFlowProvider>
            <MountpointTopologyCanvas {...props} />
        </ReactFlowProvider>
    );
}
