import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

import { WELCOME_MODEL_ASSETS } from './welcome-model-assets';
import type {
    WelcomeReplaceableModelNode,
    WelcomeSceneNode,
} from './welcome-model-assets';

type WelcomeThreeSceneProps = {
    activeNode: WelcomeSceneNode;
    onActiveNodeChange: (node: WelcomeSceneNode) => void;
    className?: string;
};

type InteractiveNode = {
    id: WelcomeSceneNode;
    slot: THREE.Group;
    ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    baseScale: number;
};

type DataPath = {
    from: WelcomeSceneNode;
    to: WelcomeSceneNode;
    curve: THREE.CatmullRomCurve3;
    mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
    particles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
    speed: number;
    layer: 'gnss' | 'rtcm';
};

const NODE_POSITIONS: Record<WelcomeSceneNode, THREE.Vector3> = {
    satellite: new THREE.Vector3(-0.5, 7.0, -3.6),
    base: new THREE.Vector3(-4.25, -0.1, 0.25),
    caster: new THREE.Vector3(0, 0.15, -0.2),
    uav: new THREE.Vector3(4.15, 1.55, -1.15),
    rover: new THREE.Vector3(4.15, -0.3, 2.25),
    usv: new THREE.Vector3(5.2, -0.18, 5.0),
};

type ArchitectureFocusSettings = {
    distance: number;
    targetHeight: number;
    horizontalOffset: number;
    fov: number;
};

type ArchitectureFocusFrame = {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
};

/**
 * Architecture always uses one stable camera angle.
 *
 * Only the focus anchor and distance change between Base, Caster, UAV and
 * Rover. This keeps the visual language consistent while scrolling.
 */
const ARCHITECTURE_VIEW_DIRECTION = new THREE.Vector3(
    0.62,
    0.34,
    0.72,
).normalize();

/**
 * Horizontal screen-right vector for the fixed Architecture camera.
 *
 * Looking slightly to the left of each node makes that node appear a little
 * to the right of the viewport, leaving the UI column unobstructed.
 */
const ARCHITECTURE_SCREEN_RIGHT = new THREE.Vector3(
    ARCHITECTURE_VIEW_DIRECTION.z,
    0,
    -ARCHITECTURE_VIEW_DIRECTION.x,
).normalize();

const ARCHITECTURE_FOCUS_SETTINGS: Record<
    WelcomeSceneNode,
    ArchitectureFocusSettings
> = {
    satellite: {
        distance: 12.8,
        targetHeight: 0.25,
        horizontalOffset: 1.05,
        fov: 39,
    },

    base: {
        distance: 10.5,
        targetHeight: 1.15,
        horizontalOffset: 0.9,
        fov: 37,
    },

    caster: {
        distance: 11.5,
        targetHeight: 1.45,
        horizontalOffset: 1,
        fov: 37,
    },

    uav: {
        distance: 10.8,
        targetHeight: 0.1,
        horizontalOffset: 0.95,
        fov: 36,
    },

    rover: {
        distance: 10.5,
        targetHeight: 0.9,
        horizontalOffset: 0.95,
        fov: 37,
    },

    usv: {
        distance: 10.9,
        targetHeight: 0.7,
        horizontalOffset: 0.95,
        fov: 37,
    },
};

function getArchitectureDistanceMultiplier(viewportWidth: number): number {
    if (viewportWidth < 480) {
        return 1.48;
    }

    if (viewportWidth < 768) {
        return 1.3;
    }

    if (viewportWidth < 1024) {
        return 1.15;
    }

    return 1;
}

function getArchitectureFocusFrame(
    node: WelcomeSceneNode,
    anchor: THREE.Vector3,
    viewportWidth: number,
): ArchitectureFocusFrame {
    const settings = ARCHITECTURE_FOCUS_SETTINGS[node];
    const distance =
        settings.distance * getArchitectureDistanceMultiplier(viewportWidth);

    const position = anchor
        .clone()
        .addScaledVector(ARCHITECTURE_VIEW_DIRECTION, distance);

    const target = anchor
        .clone()
        .addScaledVector(ARCHITECTURE_SCREEN_RIGHT, -settings.horizontalOffset);

    return {
        position,
        target,
        fov: settings.fov,
    };
}

type ResponsiveSceneProfile = {
    cameraPoints: THREE.Vector3[];
    targetPoints: THREE.Vector3[];
    heroWorldScale: number;
    focusWorldScale: number;
    heroWorldX: number;
    focusWorldX: number;
    heroWorldY: number;
    focusWorldY: number;
    maxPixelRatio: number;
    baseFov: number;
    pointerInfluence: number;
    particleLimit: number;
    showGrid: boolean;
    shadowMapSize: number;
};

const CAMERA_COMPACT = [
    new THREE.Vector3(10.8, 7.4, 23.5),
    new THREE.Vector3(8.9, 6.2, 18.6),
    new THREE.Vector3(3.6, 10.4, 16.8),
    new THREE.Vector3(-0.4, 5.0, 14.8),
    new THREE.Vector3(0.3, 4.8, 12.8),
    new THREE.Vector3(7.7, 5.5, 13.2),
    new THREE.Vector3(7.6, 4.0, 13.8),
    new THREE.Vector3(8.8, 4.2, 15.2),
    new THREE.Vector3(9.6, 8.1, 21.0),
];

const CAMERA_MOBILE = [
    new THREE.Vector3(10.2, 6.9, 20.8),
    new THREE.Vector3(8.4, 5.7, 16.5),
    new THREE.Vector3(3.3, 9.5, 14.9),
    new THREE.Vector3(-0.8, 4.6, 12.6),
    new THREE.Vector3(0.2, 4.4, 10.9),
    new THREE.Vector3(7.3, 5.0, 11.2),
    new THREE.Vector3(7.2, 3.7, 11.8),
    new THREE.Vector3(8.3, 3.9, 13.0),
    new THREE.Vector3(9.0, 7.4, 18.2),
];

const CAMERA_TABLET = [
    new THREE.Vector3(9.8, 6.2, 17.8),
    new THREE.Vector3(7.8, 5.1, 13.8),
    new THREE.Vector3(3.0, 8.7, 12.8),
    new THREE.Vector3(-1.1, 4.0, 10.7),
    new THREE.Vector3(0.2, 4.0, 9.3),
    new THREE.Vector3(7.1, 4.5, 9.8),
    new THREE.Vector3(7.0, 3.4, 10.3),
    new THREE.Vector3(8.0, 3.5, 11.5),
    new THREE.Vector3(8.5, 6.8, 15.8),
];

const CAMERA_DESKTOP = [
    new THREE.Vector3(10.2, 5.9, 18.8),
    new THREE.Vector3(8.0, 4.9, 13.8),
    new THREE.Vector3(2.8, 8.2, 11.9),
    new THREE.Vector3(-1.3, 3.6, 9.8),
    new THREE.Vector3(0.2, 3.8, 8.8),
    new THREE.Vector3(7.1, 4.2, 9.4),
    new THREE.Vector3(7.0, 3.3, 9.8),
    new THREE.Vector3(7.9, 3.4, 10.9),
    new THREE.Vector3(8.2, 6.4, 14.8),
];

const CAMERA_TARGETS = [
    new THREE.Vector3(0.2, 0.45, 0.3),

    // Camera tiến vào giữa network trước khi focus từng node.
    new THREE.Vector3(0.2, 0.5, 0.25),

    NODE_POSITIONS.satellite.clone().add(new THREE.Vector3(0, 0.25, 0)),

    NODE_POSITIONS.base.clone().add(new THREE.Vector3(0, 1.05, 0)),

    NODE_POSITIONS.caster.clone().add(new THREE.Vector3(0, 1.15, 0)),

    NODE_POSITIONS.uav.clone().add(new THREE.Vector3(0, 0.1, 0)),

    NODE_POSITIONS.rover.clone().add(new THREE.Vector3(0, 0.85, 0)),

    NODE_POSITIONS.usv.clone().add(new THREE.Vector3(0, 0.7, 0)),

    new THREE.Vector3(0.25, 0.5, 0.25),
];

function getResponsiveSceneProfile(width: number): ResponsiveSceneProfile {
    if (width < 480) {
        return {
            cameraPoints: CAMERA_COMPACT,
            targetPoints: CAMERA_TARGETS,
            heroWorldScale: 0.46,
            focusWorldScale: 0.72,
            heroWorldX: 0.55,
            focusWorldX: 0,
            heroWorldY: -0.72,
            focusWorldY: -0.58,
            maxPixelRatio: 1.15,
            baseFov: 42,
            pointerInfluence: 0,
            particleLimit: 3,
            showGrid: false,
            shadowMapSize: 768,
        };
    }

    if (width < 768) {
        return {
            cameraPoints: CAMERA_MOBILE,
            targetPoints: CAMERA_TARGETS,
            heroWorldScale: 0.52,
            focusWorldScale: 0.82,
            heroWorldX: 0.9,
            focusWorldX: 0,
            heroWorldY: -0.58,
            focusWorldY: -0.42,
            maxPixelRatio: 1.4,
            baseFov: 39,
            pointerInfluence: 0,
            particleLimit: 4,
            showGrid: true,
            shadowMapSize: 1024,
        };
    }

    if (width < 1024) {
        return {
            cameraPoints: CAMERA_TABLET,
            targetPoints: CAMERA_TARGETS,
            heroWorldScale: 0.58,
            focusWorldScale: 0.92,
            heroWorldX: 1.45,
            focusWorldX: 0,
            heroWorldY: -0.42,
            focusWorldY: -0.3,
            maxPixelRatio: 1.65,
            baseFov: 37,
            pointerInfluence: 0.45,
            particleLimit: 5,
            showGrid: true,
            shadowMapSize: 1024,
        };
    }

    return {
        cameraPoints: CAMERA_DESKTOP,
        targetPoints: CAMERA_TARGETS,
        heroWorldScale: 0.56,
        focusWorldScale: 1,
        heroWorldX: 3.1,
        focusWorldX: 0,
        heroWorldY: -0.3,
        focusWorldY: -0.2,
        maxPixelRatio: 2,
        baseFov: 35,
        pointerInfluence: 0.8,
        particleLimit: 5,
        showGrid: true,
        shadowMapSize: 1536,
    };
}

const INTERACTIVE_NODE_ORDER: WelcomeSceneNode[] = [
    'satellite',
    'base',
    'caster',
    'uav',
    'rover',
    'usv',
];

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

function createStandardMaterial(
    color: number,
    options: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.18,
        ...options,
    });
}

function addMesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: readonly [number, number, number],
    rotation: readonly [number, number, number] = [0, 0, 0],
    scale: readonly [number, number, number] = [1, 1, 1],
): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    return mesh;
}

function createBaseStation(): THREE.Group {
    const group = new THREE.Group();
    const dark = createStandardMaterial(0x171717, {
        roughness: 0.48,
        metalness: 0.48,
    });
    const graphite = createStandardMaterial(0x4b4b4b);
    const white = createStandardMaterial(0xf2f2ef, {
        roughness: 0.38,
        metalness: 0.06,
    });

    addMesh(group, new THREE.BoxGeometry(0.9, 0.55, 0.7), dark, [0, 1.35, 0]);
    addMesh(
        group,
        new THREE.CylinderGeometry(0.11, 0.13, 1.35, 20),
        graphite,
        [0, 2.25, 0],
    );
    addMesh(
        group,
        new THREE.CylinderGeometry(0.68, 0.72, 0.25, 32),
        white,
        [0, 3.0, 0],
    );
    addMesh(
        group,
        new THREE.SphereGeometry(0.65, 32, 18),
        white,
        [0, 3.12, 0],
        [0, 0, 0],
        [1, 0.52, 1],
    );

    for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2;
        const leg = addMesh(
            group,
            new THREE.CylinderGeometry(0.065, 0.085, 2.2, 12),
            dark,
            [Math.cos(angle) * 0.58, 0.48, Math.sin(angle) * 0.58],
        );

        leg.rotation.z = Math.sin(angle) * 0.42;
        leg.rotation.x = Math.cos(angle) * 0.42;
    }

    return group;
}

function createCasterServer(): THREE.Group {
    const group = new THREE.Group();
    const dark = createStandardMaterial(0x101010, {
        roughness: 0.4,
        metalness: 0.58,
    });
    const panel = createStandardMaterial(0x303030, {
        roughness: 0.52,
        metalness: 0.32,
    });
    const light = createStandardMaterial(0xe6e6e2, {
        emissive: 0x777777,
        emissiveIntensity: 0.22,
    });

    addMesh(group, new THREE.BoxGeometry(1.7, 3.25, 1.45), dark, [0, 1.65, 0]);

    for (let index = 0; index < 6; index += 1) {
        addMesh(group, new THREE.BoxGeometry(1.48, 0.28, 0.08), panel, [
            0,
            0.55 + index * 0.46,
            0.765,
        ]);
        addMesh(group, new THREE.SphereGeometry(0.045, 12, 8), light, [
            -0.55,
            0.55 + index * 0.46,
            0.82,
        ]);
    }

    addMesh(group, new THREE.BoxGeometry(1.95, 0.16, 1.7), panel, [0, 0.05, 0]);

    return group;
}

function createUav(): THREE.Group {
    const group = new THREE.Group();
    const dark = createStandardMaterial(0x111111, {
        roughness: 0.36,
        metalness: 0.58,
    });
    const graphite = createStandardMaterial(0x3b3b3b, {
        roughness: 0.52,
        metalness: 0.4,
    });
    const rotor = createStandardMaterial(0x0b0b0b, {
        roughness: 0.3,
        metalness: 0.18,
        transparent: true,
        opacity: 0.78,
    });

    addMesh(group, new THREE.BoxGeometry(1.15, 0.46, 0.85), dark, [0, 0.1, 0]);
    addMesh(
        group,
        new THREE.BoxGeometry(0.72, 0.34, 0.58),
        graphite,
        [0, -0.2, 0],
    );

    const armPositions: readonly [number, number, number][] = [
        [1.15, 0.1, 1.15],
        [-1.15, 0.1, 1.15],
        [1.15, 0.1, -1.15],
        [-1.15, 0.1, -1.15],
    ];

    for (const [x, y, z] of armPositions) {
        const armLength = Math.hypot(x, z);
        const armAngle = Math.atan2(z, x);

        addMesh(
            group,
            new THREE.BoxGeometry(armLength, 0.12, 0.13),
            dark,
            [x / 2, y, z / 2],
            [0, -armAngle, 0],
        );
        addMesh(
            group,
            new THREE.CylinderGeometry(0.19, 0.22, 0.28, 20),
            graphite,
            [x, y + 0.08, z],
        );
        addMesh(
            group,
            new THREE.BoxGeometry(1.15, 0.035, 0.11),
            rotor,
            [x, y + 0.31, z],
            [0, armAngle, 0],
        );
    }

    addMesh(
        group,
        new THREE.BoxGeometry(0.06, 0.9, 0.06),
        dark,
        [-0.42, -0.66, 0.28],
        [0, 0, -0.14],
    );
    addMesh(
        group,
        new THREE.BoxGeometry(0.06, 0.9, 0.06),
        dark,
        [0.42, -0.66, 0.28],
        [0, 0, 0.14],
    );
    addMesh(
        group,
        new THREE.BoxGeometry(1.15, 0.06, 0.06),
        dark,
        [0, -1.08, 0.28],
    );

    return group;
}

function createRover(): THREE.Group {
    const group = new THREE.Group();
    const dark = createStandardMaterial(0x151515, {
        roughness: 0.42,
        metalness: 0.5,
    });
    const graphite = createStandardMaterial(0x454545);
    const rubber = createStandardMaterial(0x080808, {
        roughness: 0.92,
        metalness: 0.02,
    });
    const white = createStandardMaterial(0xe9e9e6);

    addMesh(group, new THREE.BoxGeometry(2.2, 0.65, 1.35), dark, [0, 0.58, 0]);
    addMesh(
        group,
        new THREE.BoxGeometry(1.25, 0.48, 1.0),
        graphite,
        [0.15, 1.08, 0],
    );

    const wheelPositions: readonly [number, number, number][] = [
        [0.78, 0.28, 0.82],
        [-0.78, 0.28, 0.82],
        [0.78, 0.28, -0.82],
        [-0.78, 0.28, -0.82],
    ];

    for (const position of wheelPositions) {
        addMesh(
            group,
            new THREE.CylinderGeometry(0.38, 0.38, 0.28, 22),
            rubber,
            position,
            [Math.PI / 2, 0, 0],
        );
    }

    addMesh(
        group,
        new THREE.CylinderGeometry(0.05, 0.06, 1.15, 14),
        graphite,
        [0.3, 1.85, 0],
    );
    addMesh(
        group,
        new THREE.CylinderGeometry(0.32, 0.34, 0.16, 24),
        white,
        [0.3, 2.46, 0],
    );

    return group;
}

function createSatellite(): THREE.Group {
    const group = new THREE.Group();
    const body = createStandardMaterial(0x202020, {
        roughness: 0.36,
        metalness: 0.65,
    });
    const panel = createStandardMaterial(0x444444, {
        roughness: 0.4,
        metalness: 0.42,
    });
    const white = createStandardMaterial(0xf1f1ed, {
        roughness: 0.28,
        metalness: 0.12,
    });

    addMesh(group, new THREE.BoxGeometry(0.9, 0.75, 0.9), body, [0, 0, 0]);
    addMesh(
        group,
        new THREE.BoxGeometry(2.2, 0.08, 0.92),
        panel,
        [-1.55, 0, 0],
    );
    addMesh(group, new THREE.BoxGeometry(2.2, 0.08, 0.92), panel, [1.55, 0, 0]);

    for (const x of [-2.2, -1.5, -0.9, 0.9, 1.5, 2.2]) {
        addMesh(group, new THREE.BoxGeometry(0.02, 0.1, 0.94), white, [
            x,
            0.01,
            0,
        ]);
    }

    addMesh(
        group,
        new THREE.CylinderGeometry(0.08, 0.08, 0.85, 16),
        body,
        [0, -0.75, 0],
    );
    addMesh(
        group,
        new THREE.SphereGeometry(0.42, 24, 14),
        white,
        [0, -1.15, 0],
        [Math.PI, 0, 0],
        [1, 0.45, 1],
    );

    group.rotation.z = -0.08;

    return group;
}

function createUsv(): THREE.Group {
    const group = new THREE.Group();
    const hull = createStandardMaterial(0x111111, {
        roughness: 0.42,
        metalness: 0.5,
    });
    const graphite = createStandardMaterial(0x444444, {
        roughness: 0.56,
        metalness: 0.35,
    });
    const white = createStandardMaterial(0xefefeb, {
        roughness: 0.34,
        metalness: 0.08,
    });

    addMesh(group, new THREE.BoxGeometry(2.7, 0.48, 1.15), hull, [0, 0.34, 0]);
    addMesh(
        group,
        new THREE.BoxGeometry(2.35, 0.32, 0.92),
        hull,
        [0.12, 0.05, 0],
        [0, 0, 0],
        [1, 0.78, 1],
    );
    addMesh(
        group,
        new THREE.BoxGeometry(1.15, 0.52, 0.78),
        graphite,
        [0.15, 0.85, 0],
    );
    addMesh(
        group,
        new THREE.CylinderGeometry(0.04, 0.05, 1.05, 12),
        graphite,
        [0.35, 1.65, 0],
    );
    addMesh(
        group,
        new THREE.CylinderGeometry(0.25, 0.27, 0.13, 22),
        white,
        [0.35, 2.2, 0],
    );

    return group;
}

function createProceduralNode(id: WelcomeSceneNode): THREE.Group {
    switch (id) {
        case 'satellite':
            return createSatellite();
        case 'base':
            return createBaseStation();
        case 'caster':
            return createCasterServer();
        case 'uav':
            return createUav();
        case 'rover':
            return createRover();
        case 'usv':
            return createUsv();
    }
}

function setNodeMetadata(object: THREE.Object3D, id: WelcomeSceneNode): void {
    object.traverse((child: THREE.Object3D) => {
        child.userData.welcomeSceneNode = id;
    });
}

function createInteractiveNode(id: WelcomeSceneNode): InteractiveNode {
    const slot = new THREE.Group();
    const procedural = createProceduralNode(id);
    const position = NODE_POSITIONS[id];

    slot.position.copy(position);
    slot.add(procedural);
    setNodeMetadata(slot, id);

    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.72, 0.78, 64),
        ringMaterial,
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = id === 'satellite' ? -1.3 : id === 'uav' ? -1.45 : 0.02;
    ring.scale.setScalar(
        id === 'satellite'
            ? 1.9
            : id === 'caster'
              ? 1.55
              : id === 'uav'
                ? 1.8
                : id === 'usv'
                  ? 1.65
                  : 1.35,
    );
    slot.add(ring);

    return {
        id,
        slot,
        ring,
        baseScale: 1,
    };
}

function createPath(
    from: WelcomeSceneNode,
    to: WelcomeSceneNode,
    points: THREE.Vector3[],
    speed: number,
    layer: DataPath['layer'] = 'rtcm',
): { mesh: THREE.Mesh; runtime: DataPath } {
    const curve = new THREE.CatmullRomCurve3(points);
    const isGnss = layer === 'gnss';
    const material = new THREE.MeshBasicMaterial({
        color: isGnss ? 0x8a8a84 : 0x4a4a47,
        transparent: true,
        opacity: isGnss ? 0.34 : 0.52,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(
            curve,
            isGnss ? 56 : 72,
            isGnss ? 0.012 : 0.024,
            8,
            false,
        ),
        material,
    );
    const particles: DataPath['particles'] = [];
    const particleCount = isGnss ? 4 : 5;

    mesh.renderOrder = isGnss ? 3 : 4;

    for (let index = 0; index < particleCount; index += 1) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(isGnss ? 0.052 : 0.075, 12, 8),
            new THREE.MeshBasicMaterial({
                color: isGnss ? 0xf5f5f0 : 0x111111,
                transparent: true,
                opacity: isGnss ? 0.9 : 0.82,
                depthWrite: false,
            }),
        );

        particle.userData.pathOffset = index / particleCount;
        particle.renderOrder = isGnss ? 4 : 5;
        particles.push(particle);
    }

    return {
        mesh,
        runtime: {
            from,
            to,
            curve,
            mesh,
            particles,
            speed,
            layer,
        },
    };
}

function normalizeLoadedModel(
    object: THREE.Object3D,
    targetSize: number,
): void {
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    if (largestDimension <= 0) {
        return;
    }

    const scale = targetSize / largestDimension;
    object.scale.setScalar(scale);

    const scaledBounds = new THREE.Box3().setFromObject(object);
    const center = scaledBounds.getCenter(new THREE.Vector3());
    const minimum = scaledBounds.min.clone();

    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= minimum.y;
}

function disposeObject(object: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    object.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
            return;
        }

        geometries.add(child.geometry);

        if (Array.isArray(child.material)) {
            child.material.forEach((material: THREE.Material) =>
                materials.add(material),
            );
        } else {
            materials.add(child.material);
        }
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
}

function resolveNodeFromObject(
    object: THREE.Object3D | null,
): WelcomeSceneNode | null {
    let current = object;

    while (current) {
        const candidate = current.userData.welcomeSceneNode;

        if (
            candidate === 'satellite' ||
            candidate === 'base' ||
            candidate === 'caster' ||
            candidate === 'uav' ||
            candidate === 'rover' ||
            candidate === 'usv'
        ) {
            return candidate;
        }

        current = current.parent;
    }

    return null;
}

export function WelcomeThreeScene({
    activeNode,
    onActiveNodeChange,
    className,
}: WelcomeThreeSceneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const activeNodeRef = useRef(activeNode);
    const onActiveNodeChangeRef = useRef(onActiveNodeChange);
    const [webGlAvailable, setWebGlAvailable] = useState(true);

    useEffect(() => {
        activeNodeRef.current = activeNode;
    }, [activeNode]);

    useEffect(() => {
        onActiveNodeChangeRef.current = onActiveNodeChange;
    }, [onActiveNodeChange]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        let renderer: THREE.WebGLRenderer;
        const initialProfile = getResponsiveSceneProfile(
            Math.max(container.clientWidth, 1),
        );

        try {
            renderer = new THREE.WebGLRenderer({
                antialias: container.clientWidth >= 480,
                alpha: true,
                powerPreference: 'high-performance',
            });
        } catch (error) {
            console.error(
                'Unable to initialize the Welcome WebGL scene.',
                error,
            );

            const fallbackTimer = window.setTimeout(() => {
                setWebGlAvailable(false);
            }, 0);

            return () => window.clearTimeout(fallbackTimer);
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
        const world = new THREE.Group();
        const clock = new THREE.Clock();
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2(3, 3);
        const pointerTarget = new THREE.Vector2(0, 0);
        const pointerSmoothed = new THREE.Vector2(0, 0);
        const lookAtTarget = new THREE.Vector3();
        const cameraDesired = new THREE.Vector3();
        const cameraTargetDesired = new THREE.Vector3();
        const architectureAnchor = new THREE.Vector3();
        const modelNodes = new Map<WelcomeSceneNode, InteractiveNode>();
        const pathRuntimes: DataPath[] = [];
        const loader = new GLTFLoader();
        const mediaQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );

        loader.setMeshoptDecoder(MeshoptDecoder);

        let animationFrame = 0;
        let disposed = false;
        let hoveredNode: WelcomeSceneNode | null = null;
        let scrollTarget = 0;
        let scrollCurrent = 0;
        let architectureFocusActive = false;
        let viewportWidth = Math.max(container.clientWidth, 1);
        let dragRotationY = 0;
        let dragRotationX = 0;
        let dragging = false;
        let dragPointerId: number | null = null;
        let previousPointerX = 0;
        let previousPointerY = 0;
        let dragDistance = 0;
        let cameraCurve = new THREE.CatmullRomCurve3(
            initialProfile.cameraPoints,
        );
        let targetCurve = new THREE.CatmullRomCurve3(
            initialProfile.targetPoints,
        );
        let reducedMotion = mediaQuery.matches;
        let pageVisible = !document.hidden;
        let baseFov = initialProfile.baseFov;
        let pointerInfluence = initialProfile.pointerInfluence;
        let heroWorldScale = initialProfile.heroWorldScale;
        let focusWorldScale = initialProfile.focusWorldScale;
        let heroWorldX = initialProfile.heroWorldX;
        let focusWorldX = initialProfile.focusWorldX;
        let heroWorldY = initialProfile.heroWorldY;
        let focusWorldY = initialProfile.focusWorldY;

        renderer.setClearColor(0xffffff, 0);
        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, initialProfile.maxPixelRatio),
        );
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.setAttribute(
            'aria-label',
            'Interactive 3D diagram of an RTK base station, NTRIP Caster, UAV and autonomous rover.',
        );
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.cursor = 'grab';
        renderer.domElement.style.touchAction = 'pan-y';
        container.appendChild(renderer.domElement);

        scene.fog = new THREE.FogExp2(0xf7f7f3, 0.032);
        scene.add(world);

        const hemisphere = new THREE.HemisphereLight(0xffffff, 0xc7c7c2, 2.25);
        scene.add(hemisphere);

        const keyLight = new THREE.DirectionalLight(0xffffff, 4.1);
        keyLight.position.set(7, 10, 8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(
            initialProfile.shadowMapSize,
            initialProfile.shadowMapSize,
        );
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 35;
        keyLight.shadow.camera.left = -12;
        keyLight.shadow.camera.right = 12;
        keyLight.shadow.camera.top = 12;
        keyLight.shadow.camera.bottom = -12;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xd8d8d5, 1.6);
        fillLight.position.set(-8, 4, -5);
        scene.add(fillLight);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(34, 24),
            new THREE.MeshStandardMaterial({
                color: 0xf2f2ee,
                roughness: 0.92,
                metalness: 0,
                transparent: true,
                opacity: 0.78,
            }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.12;
        ground.receiveShadow = true;
        world.add(ground);

        const grid = new THREE.GridHelper(32, 32, 0xbcbcb7, 0xd9d9d4);
        grid.position.y = -0.1;
        const gridMaterials = Array.isArray(grid.material)
            ? grid.material
            : [grid.material];
        gridMaterials.forEach((material: THREE.Material) => {
            material.transparent = true;
            material.opacity = 0.22;
            material.depthWrite = false;
        });
        world.add(grid);

        for (const id of INTERACTIVE_NODE_ORDER) {
            const node = createInteractiveNode(id);
            modelNodes.set(id, node);
            world.add(node.slot);
        }

        const connections = [
            // GNSS downlinks from orbit to every positioning receiver.
            createPath(
                'satellite',
                'base',
                [
                    NODE_POSITIONS.satellite.clone(),
                    new THREE.Vector3(-2.5, 4.8, -1.5),
                    NODE_POSITIONS.base
                        .clone()
                        .add(new THREE.Vector3(0, 3.0, 0)),
                ],
                0.075,
                'gnss',
            ),
            createPath(
                'satellite',
                'uav',
                [
                    NODE_POSITIONS.satellite.clone(),
                    new THREE.Vector3(2.2, 5.6, -2.6),
                    NODE_POSITIONS.uav
                        .clone()
                        .add(new THREE.Vector3(0, 0.3, 0)),
                ],
                0.095,
                'gnss',
            ),
            createPath(
                'satellite',
                'rover',
                [
                    NODE_POSITIONS.satellite.clone(),
                    new THREE.Vector3(1.9, 4.7, 0.2),
                    NODE_POSITIONS.rover
                        .clone()
                        .add(new THREE.Vector3(0, 2.0, 0)),
                ],
                0.082,
                'gnss',
            ),
            createPath(
                'satellite',
                'usv',
                [
                    NODE_POSITIONS.satellite.clone(),
                    new THREE.Vector3(2.6, 4.6, 2.0),
                    NODE_POSITIONS.usv
                        .clone()
                        .add(new THREE.Vector3(0, 1.8, 0)),
                ],
                0.088,
                'gnss',
            ),

            // RTCM correction transport through the NTRIP network.
            createPath(
                'base',
                'caster',
                [
                    NODE_POSITIONS.base
                        .clone()
                        .add(new THREE.Vector3(0, 1.15, 0)),
                    new THREE.Vector3(-2.4, 2.0, -0.8),
                    NODE_POSITIONS.caster
                        .clone()
                        .add(new THREE.Vector3(0, 1.6, 0)),
                ],
                0.11,
            ),
            createPath(
                'caster',
                'uav',
                [
                    NODE_POSITIONS.caster
                        .clone()
                        .add(new THREE.Vector3(0, 1.65, 0)),
                    new THREE.Vector3(2.0, 2.6, -1.0),
                    NODE_POSITIONS.uav
                        .clone()
                        .add(new THREE.Vector3(0, 0.1, 0)),
                ],
                0.14,
            ),
            createPath(
                'caster',
                'rover',
                [
                    NODE_POSITIONS.caster
                        .clone()
                        .add(new THREE.Vector3(0, 1.4, 0)),
                    new THREE.Vector3(2.0, 1.45, 1.25),
                    NODE_POSITIONS.rover
                        .clone()
                        .add(new THREE.Vector3(0, 1.0, 0)),
                ],
                0.09,
            ),
            createPath(
                'caster',
                'usv',
                [
                    NODE_POSITIONS.caster
                        .clone()
                        .add(new THREE.Vector3(0, 1.35, 0)),
                    new THREE.Vector3(2.5, 1.25, 2.7),
                    NODE_POSITIONS.usv
                        .clone()
                        .add(new THREE.Vector3(0, 0.9, 0)),
                ],
                0.1,
            ),
        ];

        for (const connection of connections) {
            world.add(connection.mesh);
            connection.runtime.particles.forEach((particle) =>
                world.add(particle),
            );
            pathRuntimes.push(connection.runtime);
        }

        const loadRealModel = (id: WelcomeReplaceableModelNode): void => {
            const asset = WELCOME_MODEL_ASSETS[id];

            if (!asset.url) {
                return;
            }

            loader.load(
                asset.url,
                (gltf: GLTF) => {
                    if (disposed) {
                        disposeObject(gltf.scene);

                        return;
                    }

                    const node = modelNodes.get(id);

                    if (!node) {
                        return;
                    }

                    const model = gltf.scene;
                    normalizeLoadedModel(model, asset.targetSize);
                    model.position.add(new THREE.Vector3(...asset.position));
                    model.rotation.set(...asset.rotation);
                    model.scale.multiplyScalar(asset.scale);
                    model.traverse((child: THREE.Object3D) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    setNodeMetadata(model, id);

                    const oldChildren = node.slot.children.filter(
                        (child: THREE.Object3D) => child !== node.ring,
                    );
                    oldChildren.forEach((child: THREE.Object3D) => {
                        node.slot.remove(child);
                        disposeObject(child);
                    });
                    node.slot.add(model);
                },
                undefined,
                (error: unknown) => {
                    console.warn(
                        `Unable to load ${id} GLB. The procedural fallback remains active.`,
                        error,
                    );
                },
            );
        };

        (
            Object.keys(WELCOME_MODEL_ASSETS) as WelcomeReplaceableModelNode[]
        ).forEach(loadRealModel);

        const updateScrollTarget = (): void => {
            const hero = document.querySelector<HTMLElement>(
                '[data-welcome-hero]',
            );

            const architecture = document.querySelector<HTMLElement>(
                '[data-welcome-architecture]',
            );

            if (!hero || !architecture) {
                architectureFocusActive = false;

                const maximum = Math.max(
                    1,
                    document.documentElement.scrollHeight - window.innerHeight,
                );

                scrollTarget = clamp(window.scrollY / maximum, 0, 1);

                return;
            }

            const viewportHeight = window.innerHeight;

            const heroRect = hero.getBoundingClientRect();

            const architectureRect = architecture.getBoundingClientRect();

            /*
             * The Architecture camera mode is active while the section is
             * pinned across most of the viewport. Outside this interval the
             * normal scroll camera curve remains in control.
             */
            architectureFocusActive =
                architectureRect.top <= viewportHeight * 0.18 &&
                architectureRect.bottom >= viewportHeight * 0.82;

            const heroBottom = window.scrollY + heroRect.bottom;

            const architectureTop = window.scrollY + architectureRect.top;

            const architectureBottom =
                architectureTop + architectureRect.height;

            /*
             * Hero:
             * giữ network thu nhỏ bên phải.
             *
             * Hero -> Architecture:
             * camera tiến vào giữa toàn network.
             */
            const transitionStart = heroBottom - viewportHeight * 0.3;

            const transitionEnd = architectureTop + viewportHeight * 0.08;

            /*
             * Camera curve có 9 điểm:
             *
             * 0/6 Hero overview
             * 1/6 Center overview
             * 2/8 Satellite
             * 3/8 Base
             * 4/8 Caster
             * 5/8 UAV
             * 6/8 Rover
             * 7/8 USV
             * 8/8 Exit overview
             */
            const centerStage = 1 / 8;
            const lastNodeStage = 7 / 8;

            if (window.scrollY <= transitionStart) {
                scrollTarget = 0;

                return;
            }

            if (window.scrollY <= transitionEnd) {
                const progress = clamp(
                    (window.scrollY - transitionStart) /
                        Math.max(1, transitionEnd - transitionStart),
                    0,
                    1,
                );

                scrollTarget = THREE.MathUtils.lerp(0, centerStage, progress);

                return;
            }

            /*
             * Architecture được pin trong 500svh.
             * Trong thời gian này camera lia tuần tự
             * từ center → Satellite → Base → Caster → UAV → Rover → USV.
             */
            if (window.scrollY < architectureBottom - viewportHeight) {
                const availableScroll = Math.max(
                    1,
                    architectureRect.height - viewportHeight,
                );

                const architectureProgress = clamp(
                    (window.scrollY - architectureTop) / availableScroll,
                    0,
                    1,
                );

                const easedProgress = THREE.MathUtils.smoothstep(
                    architectureProgress,
                    0.04,
                    0.94,
                );

                scrollTarget = THREE.MathUtils.lerp(
                    centerStage,
                    lastNodeStage,
                    easedProgress,
                );

                return;
            }

            /*
             * Sau bước USV:
             * toàn bộ Architecture được thả,
             * camera lùi lại overview.
             */
            const exitStart = architectureBottom - viewportHeight;

            const exitEnd = architectureBottom - viewportHeight * 0.15;

            const exitProgress = clamp(
                (window.scrollY - exitStart) / Math.max(1, exitEnd - exitStart),
                0,
                1,
            );

            scrollTarget = THREE.MathUtils.lerp(lastNodeStage, 1, exitProgress);
        };

        const updateSize = (): void => {
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);

            viewportWidth = width;
            const profile = getResponsiveSceneProfile(width);

            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            cameraCurve = new THREE.CatmullRomCurve3(profile.cameraPoints);
            targetCurve = new THREE.CatmullRomCurve3(profile.targetPoints);
            baseFov = profile.baseFov;
            pointerInfluence = profile.pointerInfluence;
            heroWorldScale = profile.heroWorldScale;
            focusWorldScale = profile.focusWorldScale;
            heroWorldX = profile.heroWorldX;
            focusWorldX = profile.focusWorldX;
            heroWorldY = profile.heroWorldY;
            focusWorldY = profile.focusWorldY;
            grid.visible = profile.showGrid;

            if (keyLight.shadow.mapSize.x !== profile.shadowMapSize) {
                keyLight.shadow.mapSize.set(
                    profile.shadowMapSize,
                    profile.shadowMapSize,
                );
                keyLight.shadow.map?.dispose();
            }

            pathRuntimes.forEach((path) => {
                path.particles.forEach((particle, index) => {
                    particle.visible = index < profile.particleLimit;
                });
            });

            renderer.setPixelRatio(
                Math.min(window.devicePixelRatio, profile.maxPixelRatio),
            );
            renderer.setSize(width, height, false);
        };

        const updatePointer = (event: PointerEvent): void => {
            const bounds = renderer.domElement.getBoundingClientRect();

            pointerTarget.x =
                ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointerTarget.y =
                -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        };

        const updateHoveredNode = (): void => {
            raycaster.setFromCamera(pointer, camera);
            const intersections = raycaster.intersectObjects(
                Array.from(modelNodes.values()).map((node) => node.slot),
                true,
            );
            const nextHovered = resolveNodeFromObject(
                intersections[0]?.object ?? null,
            );

            if (nextHovered === hoveredNode) {
                return;
            }

            hoveredNode = nextHovered;
            renderer.domElement.style.cursor = hoveredNode
                ? 'pointer'
                : dragging
                  ? 'grabbing'
                  : 'grab';
        };

        const handlePointerMove = (event: PointerEvent): void => {
            updatePointer(event);

            if (
                dragging &&
                event.pointerType === 'mouse' &&
                dragPointerId === event.pointerId
            ) {
                const deltaX = event.clientX - previousPointerX;
                const deltaY = event.clientY - previousPointerY;

                dragDistance += Math.hypot(deltaX, deltaY);
                dragRotationY += deltaX * 0.005;
                dragRotationX = clamp(
                    dragRotationX + deltaY * 0.0025,
                    -0.18,
                    0.18,
                );
                previousPointerX = event.clientX;
                previousPointerY = event.clientY;
            }
        };

        const handlePointerDown = (event: PointerEvent): void => {
            if (
                architectureFocusActive ||
                event.pointerType !== 'mouse' ||
                event.button !== 0
            ) {
                return;
            }

            dragging = true;
            dragPointerId = event.pointerId;
            previousPointerX = event.clientX;
            previousPointerY = event.clientY;
            dragDistance = 0;
            renderer.domElement.setPointerCapture(event.pointerId);
            renderer.domElement.style.cursor = 'grabbing';
        };

        const endPointerDrag = (event: PointerEvent): void => {
            if (dragPointerId !== event.pointerId) {
                return;
            }

            dragging = false;
            dragPointerId = null;

            if (renderer.domElement.hasPointerCapture(event.pointerId)) {
                renderer.domElement.releasePointerCapture(event.pointerId);
            }

            renderer.domElement.style.cursor = hoveredNode ? 'pointer' : 'grab';
        };

        const handlePointerLeave = (): void => {
            pointerTarget.set(0, 0);
            pointer.set(3, 3);
            hoveredNode = null;
            renderer.domElement.style.cursor = 'grab';
        };

        const handleClick = (): void => {
            if (dragDistance > 5) {
                return;
            }

            if (hoveredNode) {
                onActiveNodeChangeRef.current(hoveredNode);
            }
        };

        const handleVisibilityChange = (): void => {
            pageVisible = !document.hidden;
        };

        const handleReducedMotionChange = (
            event: MediaQueryListEvent,
        ): void => {
            reducedMotion = event.matches;
        };

        window.addEventListener('scroll', updateScrollTarget, {
            passive: true,
        });
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        mediaQuery.addEventListener('change', handleReducedMotionChange);
        renderer.domElement.addEventListener('pointermove', handlePointerMove);
        renderer.domElement.addEventListener('pointerdown', handlePointerDown);
        renderer.domElement.addEventListener('pointerup', endPointerDrag);
        renderer.domElement.addEventListener('pointercancel', endPointerDrag);
        renderer.domElement.addEventListener(
            'pointerleave',
            handlePointerLeave,
        );
        renderer.domElement.addEventListener('click', handleClick);

        updateScrollTarget();
        updateSize();
        scrollCurrent = scrollTarget;
        camera.position.copy(cameraCurve.getPointAt(scrollCurrent));
        lookAtTarget.copy(targetCurve.getPointAt(scrollCurrent));
        const initialFocusBlend = THREE.MathUtils.smoothstep(
            scrollCurrent,
            0.08,
            0.2,
        );
        world.scale.setScalar(
            THREE.MathUtils.lerp(
                heroWorldScale,
                focusWorldScale,
                initialFocusBlend,
            ),
        );
        world.position.set(
            THREE.MathUtils.lerp(heroWorldX, focusWorldX, initialFocusBlend),
            THREE.MathUtils.lerp(heroWorldY, focusWorldY, initialFocusBlend),
            0,
        );
        camera.lookAt(lookAtTarget);

        const render = (): void => {
            animationFrame = window.requestAnimationFrame(render);

            if (!pageVisible) {
                return;
            }

            const elapsed = clock.getElapsedTime();
            const damping = reducedMotion ? 1 : 0.065;

            scrollCurrent += (scrollTarget - scrollCurrent) * damping;
            pointerSmoothed.lerp(pointerTarget, reducedMotion ? 1 : 0.055);
            pointer.lerp(pointerTarget, reducedMotion ? 1 : 0.2);

            cameraDesired.copy(cameraCurve.getPointAt(scrollCurrent));
            cameraTargetDesired.copy(targetCurve.getPointAt(scrollCurrent));

            let architectureFocusFov: number | null = null;

            if (architectureFocusActive) {
                const focusedNode = modelNodes.get(activeNodeRef.current);

                if (focusedNode) {
                    world.updateMatrixWorld(true);
                    focusedNode.slot.getWorldPosition(architectureAnchor);

                    architectureAnchor.y +=
                        ARCHITECTURE_FOCUS_SETTINGS[activeNodeRef.current]
                            .targetHeight * world.scale.y;

                    const architectureFrame = getArchitectureFocusFrame(
                        activeNodeRef.current,
                        architectureAnchor,
                        viewportWidth,
                    );

                    cameraDesired.copy(architectureFrame.position);
                    cameraTargetDesired.copy(architectureFrame.target);
                    architectureFocusFov = architectureFrame.fov;
                }
            }

            if (
                !architectureFocusActive &&
                !reducedMotion &&
                pointerInfluence > 0
            ) {
                cameraDesired.x += pointerSmoothed.x * 0.45 * pointerInfluence;
                cameraDesired.y += pointerSmoothed.y * 0.25 * pointerInfluence;
                cameraTargetDesired.x +=
                    pointerSmoothed.x * 0.2 * pointerInfluence;
            }

            camera.position.lerp(cameraDesired, reducedMotion ? 1 : 0.065);
            lookAtTarget.lerp(cameraTargetDesired, reducedMotion ? 1 : 0.075);
            camera.lookAt(lookAtTarget);

            const focusBlend = THREE.MathUtils.smoothstep(
                scrollCurrent,
                0.08,
                0.2,
            );
            const desiredWorldScale = THREE.MathUtils.lerp(
                heroWorldScale,
                focusWorldScale,
                focusBlend,
            );
            const desiredWorldX = THREE.MathUtils.lerp(
                heroWorldX,
                focusWorldX,
                focusBlend,
            );

            const desiredWorldY = THREE.MathUtils.lerp(
                heroWorldY,
                focusWorldY,
                focusBlend,
            );
            const nextWorldScale = THREE.MathUtils.lerp(
                world.scale.x,
                desiredWorldScale,
                reducedMotion ? 1 : 0.08,
            );

            world.scale.setScalar(nextWorldScale);

            world.position.x = THREE.MathUtils.lerp(
                world.position.x,
                desiredWorldX,
                reducedMotion ? 1 : 0.08,
            );

            world.position.y = THREE.MathUtils.lerp(
                world.position.y,
                desiredWorldY,
                reducedMotion ? 1 : 0.08,
            );

            const zoomPulse = Math.sin(scrollCurrent * Math.PI * 5) * 1.15;
            const desiredFov =
                architectureFocusFov ??
                clamp(baseFov - zoomPulse, baseFov - 5, baseFov + 3);
            camera.fov +=
                (desiredFov - camera.fov) * (reducedMotion ? 1 : 0.06);
            camera.updateProjectionMatrix();

            const desiredWorldRotationY = architectureFocusActive
                ? 0
                : dragRotationY;
            const desiredWorldRotationX = architectureFocusActive
                ? 0
                : dragRotationX;

            world.rotation.y +=
                (desiredWorldRotationY - world.rotation.y) *
                (reducedMotion ? 1 : 0.08);
            world.rotation.x +=
                (desiredWorldRotationX - world.rotation.x) *
                (reducedMotion ? 1 : 0.08);

            if (!dragging) {
                updateHoveredNode();
            }

            for (const node of modelNodes.values()) {
                const emphasized =
                    node.id === activeNodeRef.current ||
                    node.id === hoveredNode;
                const targetScale = architectureFocusActive
                    ? node.id === activeNodeRef.current
                        ? 1.055
                        : 0.94
                    : emphasized
                      ? 1.075
                      : node.baseScale;
                const nextScale = THREE.MathUtils.lerp(
                    node.slot.scale.x,
                    targetScale,
                    reducedMotion ? 1 : 0.1,
                );

                node.slot.scale.setScalar(nextScale);
                const targetRingOpacity = architectureFocusActive
                    ? node.id === activeNodeRef.current
                        ? 0.58
                        : 0.045
                    : emphasized
                      ? 0.52
                      : 0.12;

                node.ring.material.opacity = THREE.MathUtils.lerp(
                    node.ring.material.opacity,
                    targetRingOpacity,
                    reducedMotion ? 1 : 0.12,
                );

                if (
                    architectureFocusActive &&
                    node.id === activeNodeRef.current
                ) {
                    node.ring.rotation.z = reducedMotion ? 0 : elapsed * 0.22;
                }

                if (!reducedMotion && node.id === 'satellite') {
                    node.slot.position.x =
                        NODE_POSITIONS.satellite.x +
                        Math.sin(elapsed * 0.18) * 0.18;
                    node.slot.position.z =
                        NODE_POSITIONS.satellite.z +
                        Math.cos(elapsed * 0.18) * 0.14;
                    node.slot.rotation.y = elapsed * 0.08;
                }

                if (!reducedMotion && node.id === 'uav') {
                    node.slot.position.y =
                        NODE_POSITIONS.uav.y + Math.sin(elapsed * 1.25) * 0.1;
                }

                if (!reducedMotion && node.id === 'usv') {
                    node.slot.position.y =
                        NODE_POSITIONS.usv.y + Math.sin(elapsed * 0.9) * 0.055;
                    node.slot.rotation.z = Math.sin(elapsed * 0.72) * 0.018;
                }
            }

            for (const path of pathRuntimes) {
                const activePath =
                    path.from === activeNodeRef.current ||
                    path.to === activeNodeRef.current ||
                    (activeNodeRef.current === 'caster' &&
                        path.layer === 'rtcm');
                const pathOpacity = architectureFocusActive
                    ? activePath
                        ? path.layer === 'gnss'
                            ? 0.76
                            : 0.92
                        : path.layer === 'gnss'
                          ? 0.08
                          : 0.14
                    : activePath
                      ? path.layer === 'gnss'
                          ? 0.62
                          : 0.82
                      : path.layer === 'gnss'
                        ? 0.24
                        : 0.42;

                path.mesh.material.opacity = THREE.MathUtils.lerp(
                    path.mesh.material.opacity,
                    pathOpacity,
                    reducedMotion ? 1 : 0.1,
                );

                path.particles.forEach((particle) => {
                    const offset = Number(particle.userData.pathOffset ?? 0);
                    const progress = (elapsed * path.speed + offset) % 1;
                    particle.position.copy(path.curve.getPointAt(progress));
                    const particleOpacity = architectureFocusActive
                        ? activePath
                            ? path.layer === 'gnss'
                                ? 0.92
                                : 1
                            : 0.1
                        : activePath
                          ? path.layer === 'gnss'
                              ? 0.86
                              : 0.95
                          : path.layer === 'gnss'
                            ? 0.48
                            : 0.62;
                    const particleScale = architectureFocusActive
                        ? activePath
                            ? path.layer === 'gnss'
                                ? 1.28
                                : 1.18
                            : 0.68
                        : path.layer === 'gnss'
                          ? 1.08
                          : 1;

                    particle.material.opacity = THREE.MathUtils.lerp(
                        particle.material.opacity,
                        particleOpacity,
                        reducedMotion ? 1 : 0.1,
                    );
                    particle.scale.setScalar(
                        THREE.MathUtils.lerp(
                            particle.scale.x,
                            particleScale,
                            reducedMotion ? 1 : 0.1,
                        ),
                    );
                });
            }

            renderer.render(scene, camera);
        };

        render();

        return () => {
            disposed = true;
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('scroll', updateScrollTarget);
            resizeObserver.disconnect();
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            mediaQuery.removeEventListener('change', handleReducedMotionChange);
            renderer.domElement.removeEventListener(
                'pointermove',
                handlePointerMove,
            );
            renderer.domElement.removeEventListener(
                'pointerdown',
                handlePointerDown,
            );
            renderer.domElement.removeEventListener(
                'pointerup',
                endPointerDrag,
            );
            renderer.domElement.removeEventListener(
                'pointercancel',
                endPointerDrag,
            );
            renderer.domElement.removeEventListener(
                'pointerleave',
                handlePointerLeave,
            );
            renderer.domElement.removeEventListener('click', handleClick);

            disposeObject(world);
            renderer.dispose();
            renderer.forceContextLoss();

            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            aria-hidden={!webGlAvailable}
        >
            {!webGlAvailable && (
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05),transparent_62%)]">
                    <p className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs text-black/55 backdrop-blur-xl">
                        3D preview is unavailable on this device.
                    </p>
                </div>
            )}
        </div>
    );
}
