import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
    GLTFLoader,
    type GLTF,
} from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import {
    WELCOME_MODEL_ASSETS,
    type WelcomeReplaceableModelNode,
    type WelcomeSceneNode,
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
    curve: THREE.CatmullRomCurve3;
    particles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>[];
    speed: number;
};

const NODE_POSITIONS: Record<WelcomeSceneNode, THREE.Vector3> = {
    base: new THREE.Vector3(-4.25, -0.1, 0.25),
    caster: new THREE.Vector3(0, 0.15, -0.2),
    uav: new THREE.Vector3(4.15, 1.55, -1.15),
    rover: new THREE.Vector3(4.15, -0.3, 2.25),
};

const CAMERA_DESKTOP = [
    new THREE.Vector3(8.4, 4.8, 12.8),
    new THREE.Vector3(-1.8, 3.2, 9.2),
    new THREE.Vector3(0.2, 5.8, 10.8),
    new THREE.Vector3(7.4, 3.8, 8.6),
    new THREE.Vector3(0.4, 7.6, 14.2),
];

const CAMERA_MOBILE = [
    new THREE.Vector3(8.9, 5.7, 15.5),
    new THREE.Vector3(0.2, 4.4, 12.8),
    new THREE.Vector3(0.4, 6.8, 13.9),
    new THREE.Vector3(7.8, 4.8, 12.2),
    new THREE.Vector3(0.4, 8.8, 17.4),
];

const CAMERA_TARGETS = [
    new THREE.Vector3(0.4, 0.35, 0.2),
    NODE_POSITIONS.base.clone().add(new THREE.Vector3(0, 0.8, 0)),
    NODE_POSITIONS.caster.clone().add(new THREE.Vector3(0, 0.75, 0)),
    new THREE.Vector3(3.7, 0.55, 0.45),
    new THREE.Vector3(0.2, 0.45, 0.25),
];

const INTERACTIVE_NODE_ORDER: WelcomeSceneNode[] = [
    'base',
    'caster',
    'uav',
    'rover',
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

    addMesh(
        group,
        new THREE.BoxGeometry(0.9, 0.55, 0.7),
        dark,
        [0, 1.35, 0],
    );
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

    addMesh(
        group,
        new THREE.BoxGeometry(1.7, 3.25, 1.45),
        dark,
        [0, 1.65, 0],
    );

    for (let index = 0; index < 6; index += 1) {
        addMesh(
            group,
            new THREE.BoxGeometry(1.48, 0.28, 0.08),
            panel,
            [0, 0.55 + index * 0.46, 0.765],
        );
        addMesh(
            group,
            new THREE.SphereGeometry(0.045, 12, 8),
            light,
            [-0.55, 0.55 + index * 0.46, 0.82],
        );
    }

    addMesh(
        group,
        new THREE.BoxGeometry(1.95, 0.16, 1.7),
        panel,
        [0, 0.05, 0],
    );

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

    addMesh(
        group,
        new THREE.BoxGeometry(1.15, 0.46, 0.85),
        dark,
        [0, 0.1, 0],
    );
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

    addMesh(
        group,
        new THREE.BoxGeometry(2.2, 0.65, 1.35),
        dark,
        [0, 0.58, 0],
    );
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

function createProceduralNode(id: WelcomeSceneNode): THREE.Group {
    switch (id) {
        case 'base':
            return createBaseStation();
        case 'caster':
            return createCasterServer();
        case 'uav':
            return createUav();
        case 'rover':
            return createRover();
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
    ring.position.y = id === 'uav' ? -1.45 : 0.02;
    ring.scale.setScalar(id === 'caster' ? 1.55 : id === 'uav' ? 1.8 : 1.35);
    slot.add(ring);

    return {
        id,
        slot,
        ring,
        baseScale: 1,
    };
}

function createPath(
    points: THREE.Vector3[],
    speed: number,
): { mesh: THREE.Mesh; runtime: DataPath } {
    const curve = new THREE.CatmullRomCurve3(points);
    const material = new THREE.MeshStandardMaterial({
        color: 0x6f6f6f,
        emissive: 0x222222,
        emissiveIntensity: 0.18,
        roughness: 0.75,
        metalness: 0.1,
        transparent: true,
        opacity: 0.42,
    });
    const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.018, 8, false),
        material,
    );
    const particles: DataPath['particles'] = [];

    for (let index = 0; index < 5; index += 1) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 12, 8),
            new THREE.MeshStandardMaterial({
                color: 0x111111,
                emissive: 0x444444,
                emissiveIntensity: 0.28,
                roughness: 0.4,
            }),
        );

        particle.userData.pathOffset = index / 5;
        particles.push(particle);
    }

    return {
        mesh,
        runtime: {
            curve,
            particles,
            speed,
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
            candidate === 'base' ||
            candidate === 'caster' ||
            candidate === 'uav' ||
            candidate === 'rover'
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

        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
            });
        } catch (error) {
            console.error('Unable to initialize the Welcome WebGL scene.', error);
            setWebGlAvailable(false);

            return;
        }

        setWebGlAvailable(true);

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
        const modelNodes = new Map<WelcomeSceneNode, InteractiveNode>();
        const pathRuntimes: DataPath[] = [];
        const loader = new GLTFLoader();
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        loader.setMeshoptDecoder(MeshoptDecoder);

        let animationFrame = 0;
        let disposed = false;
        let hoveredNode: WelcomeSceneNode | null = null;
        let scrollTarget = 0;
        let scrollCurrent = 0;
        let dragRotationY = 0;
        let dragRotationX = 0;
        let dragging = false;
        let dragPointerId: number | null = null;
        let previousPointerX = 0;
        let previousPointerY = 0;
        let dragDistance = 0;
        let cameraCurve = new THREE.CatmullRomCurve3(CAMERA_DESKTOP);
        const targetCurve = new THREE.CatmullRomCurve3(CAMERA_TARGETS);
        let reducedMotion = mediaQuery.matches;
        let pageVisible = !document.hidden;

        renderer.setClearColor(0xffffff, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        keyLight.shadow.mapSize.set(2048, 2048);
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
            createPath(
                [
                    NODE_POSITIONS.base.clone().add(new THREE.Vector3(0, 1.15, 0)),
                    new THREE.Vector3(-2.4, 2.0, -0.8),
                    NODE_POSITIONS.caster.clone().add(new THREE.Vector3(0, 1.6, 0)),
                ],
                0.11,
            ),
            createPath(
                [
                    NODE_POSITIONS.caster.clone().add(new THREE.Vector3(0, 1.65, 0)),
                    new THREE.Vector3(2.0, 2.6, -1.0),
                    NODE_POSITIONS.uav.clone().add(new THREE.Vector3(0, 0.1, 0)),
                ],
                0.14,
            ),
            createPath(
                [
                    NODE_POSITIONS.caster.clone().add(new THREE.Vector3(0, 1.4, 0)),
                    new THREE.Vector3(2.0, 1.45, 1.25),
                    NODE_POSITIONS.rover.clone().add(new THREE.Vector3(0, 1.0, 0)),
                ],
                0.09,
            ),
        ];

        for (const connection of connections) {
            world.add(connection.mesh);
            connection.runtime.particles.forEach((particle) => world.add(particle));
            pathRuntimes.push(connection.runtime);
        }

        const loadRealModel = (
            id: WelcomeReplaceableModelNode,
        ): void => {
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
                    model.position.add(
                        new THREE.Vector3(...asset.position),
                    );
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

        (['base', 'uav'] as const).forEach(loadRealModel);

        const updateScrollTarget = (): void => {
            const maximum = Math.max(
                1,
                document.documentElement.scrollHeight - window.innerHeight,
            );

            scrollTarget = clamp(window.scrollY / maximum, 0, 1);
        };

        const updateSize = (): void => {
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);
            const mobile = width < 768;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            cameraCurve = new THREE.CatmullRomCurve3(
                mobile ? CAMERA_MOBILE : CAMERA_DESKTOP,
            );
            world.scale.setScalar(mobile ? 0.86 : 1);
            world.position.y = mobile ? -0.55 : -0.2;
            renderer.setPixelRatio(
                Math.min(window.devicePixelRatio, mobile ? 1.45 : 2),
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
            if (event.pointerType !== 'mouse' || event.button !== 0) {
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

            renderer.domElement.style.cursor = hoveredNode
                ? 'pointer'
                : 'grab';
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
        window.addEventListener('resize', updateSize);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        mediaQuery.addEventListener('change', handleReducedMotionChange);
        renderer.domElement.addEventListener('pointermove', handlePointerMove);
        renderer.domElement.addEventListener('pointerdown', handlePointerDown);
        renderer.domElement.addEventListener('pointerup', endPointerDrag);
        renderer.domElement.addEventListener('pointercancel', endPointerDrag);
        renderer.domElement.addEventListener('click', handleClick);

        updateScrollTarget();
        updateSize();
        scrollCurrent = scrollTarget;
        camera.position.copy(cameraCurve.getPointAt(scrollCurrent));
        lookAtTarget.copy(targetCurve.getPointAt(scrollCurrent));
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

            if (!reducedMotion) {
                cameraDesired.x += pointerSmoothed.x * 0.45;
                cameraDesired.y += pointerSmoothed.y * 0.25;
                cameraTargetDesired.x += pointerSmoothed.x * 0.2;
            }

            camera.position.lerp(cameraDesired, reducedMotion ? 1 : 0.065);
            lookAtTarget.lerp(
                cameraTargetDesired,
                reducedMotion ? 1 : 0.075,
            );
            camera.lookAt(lookAtTarget);

            const zoomPulse = Math.sin(scrollCurrent * Math.PI * 2) * 1.8;
            camera.fov +=
                (clamp(35 - zoomPulse, 29, 38) - camera.fov) *
                (reducedMotion ? 1 : 0.06);
            camera.updateProjectionMatrix();

            world.rotation.y +=
                (dragRotationY - world.rotation.y) *
                (reducedMotion ? 1 : 0.08);
            world.rotation.x +=
                (dragRotationX - world.rotation.x) *
                (reducedMotion ? 1 : 0.08);

            if (!dragging) {
                updateHoveredNode();
            }

            for (const node of modelNodes.values()) {
                const emphasized =
                    node.id === activeNodeRef.current || node.id === hoveredNode;
                const targetScale = emphasized ? 1.075 : node.baseScale;
                const nextScale = THREE.MathUtils.lerp(
                    node.slot.scale.x,
                    targetScale,
                    reducedMotion ? 1 : 0.1,
                );

                node.slot.scale.setScalar(nextScale);
                node.ring.material.opacity = THREE.MathUtils.lerp(
                    node.ring.material.opacity,
                    emphasized ? 0.52 : 0.12,
                    reducedMotion ? 1 : 0.12,
                );

                if (!reducedMotion && node.id === 'uav') {
                    node.slot.position.y =
                        NODE_POSITIONS.uav.y + Math.sin(elapsed * 1.25) * 0.1;
                }
            }

            for (const path of pathRuntimes) {
                path.particles.forEach((particle) => {
                    const offset = Number(particle.userData.pathOffset ?? 0);
                    const progress = (elapsed * path.speed + offset) % 1;
                    particle.position.copy(path.curve.getPointAt(progress));
                });
            }

            renderer.render(scene, camera);
        };

        render();

        return () => {
            disposed = true;
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('scroll', updateScrollTarget);
            window.removeEventListener('resize', updateSize);
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
            renderer.domElement.removeEventListener('pointerup', endPointerDrag);
            renderer.domElement.removeEventListener(
                'pointercancel',
                endPointerDrag,
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
