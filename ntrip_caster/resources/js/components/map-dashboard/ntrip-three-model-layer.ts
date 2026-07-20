import maplibregl, {
    type CustomLayerInterface,
    type CustomRenderMethodInput,
    type Map as MapLibreMap,
    type MapMouseEvent,
} from 'maplibre-gl';

import * as THREE from 'three';

export type NtripMapModelKind = 'station' | 'rover';

export type NtripEntityScreenBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

export type NtripMapModelEntity = {
    id: string;
    kind: NtripMapModelKind;

    longitude: number;
    latitude: number;
    altitude?: number;

    /** Optional rotation inside the billboard plane, in degrees. */
    heading?: number;

    /** Visible image height in map metres. */
    scaleMeters?: number;

    selected?: boolean;
};

export type NtripThreeModelLayerOptions = {
    onHoverEntity?: (entityId: string | null) => void;
    onSelectEntity?: (entityId: string) => void;
};

type ImageResource = {
    texture: THREE.Texture;
    material: THREE.MeshBasicMaterial;
    aspectRatio: number;
};

type ScreenPoint = {
    x: number;
    y: number;
};

type RenderedEntity = {
    kind: NtripMapModelKind;
    group: THREE.Group;
    image: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    hitPolygon: ScreenPoint[];
};

const IMAGE_URLS: Record<NtripMapModelKind, string> = {
    station: '/images/ntrip/station-2.5d.png',
    rover: '/images/ntrip/rover-2.5d.png',
};

const DEFAULT_SCALE_METERS: Record<NtripMapModelKind, number> = {
    station: 25,
    rover: 10,
};

const DEFAULT_ASPECT_RATIO: Record<NtripMapModelKind, number> = {
    station: 0.72,
    rover: 1,
};

const MIN_RENDER_ZOOM = 10;

const MIN_BILLBOARD_TILT_DEGREES = 20;
const MAX_BILLBOARD_TILT_DEGREES = 78;
const BILLBOARD_TILT_BIAS_DEGREES = 10;

const SELECTED_SCALE = 1.05;
const GROUND_OFFSET_METERS = 0.08;

const MAX_TEXTURE_ANISOTROPY = 4;
const ALPHA_TEST = 0.035;

/*
 * Glow size is relative to the image itself, not to MapLibre zoom.
 */
const GLOW_WIDTH_RATIO = 0.9;
const GLOW_HEIGHT_RATIO = 0.2;
const GLOW_Y_OFFSET_RATIO = 0.055;

function isValidEntity(entity: NtripMapModelEntity): boolean {
    return (
        Number.isFinite(entity.longitude) &&
        Number.isFinite(entity.latitude) &&
        entity.longitude >= -180 &&
        entity.longitude <= 180 &&
        entity.latitude >= -90 &&
        entity.latitude <= 90
    );
}

function getImageDimensions(texture: THREE.Texture): {
    width: number;
    height: number;
} | null {
    const image = texture.image as
        | {
              width?: number;
              height?: number;
              naturalWidth?: number;
              naturalHeight?: number;
          }
        | undefined;

    if (!image) {
        return null;
    }

    const width = image.naturalWidth ?? image.width ?? 0;
    const height = image.naturalHeight ?? image.height ?? 0;

    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return null;
    }

    return {
        width,
        height,
    };
}

function pointIsInsidePolygon(
    point: ScreenPoint,
    polygon: ScreenPoint[],
): boolean {
    if (polygon.length < 3) {
        return false;
    }

    let inside = false;

    for (
        let current = 0, previous = polygon.length - 1;
        current < polygon.length;
        previous = current++
    ) {
        const currentPoint = polygon[current];
        const previousPoint = polygon[previous];

        const intersects =
            currentPoint.y > point.y !== previousPoint.y > point.y &&
            point.x <
                ((previousPoint.x - currentPoint.x) *
                    (point.y - currentPoint.y)) /
                    (previousPoint.y - currentPoint.y || 1e-9) +
                    currentPoint.x;

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

function createGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');

    canvas.width = 256;
    canvas.height = 128;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not create the station glow canvas.');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.scale(1, 0.5);

    const gradient = context.createRadialGradient(
        canvas.width / 2,
        canvas.height,
        0,
        canvas.width / 2,
        canvas.height,
        canvas.width / 2,
    );

    gradient.addColorStop(0, 'rgba(123, 255, 222, 0.9)');
    gradient.addColorStop(0.28, 'rgba(47, 191, 159, 0.62)');
    gradient.addColorStop(0.62, 'rgba(47, 191, 159, 0.22)');
    gradient.addColorStop(1, 'rgba(47, 191, 159, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height * 2);

    context.restore();

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return texture;
}

/**
 * Lightweight interactive 2.5D image layer for MapLibre.
 *
 * Interaction and selection glow are rendered in the same layer as the image:
 * - no fixed-size HTML hit target;
 * - no MapLibre circle source/layer;
 * - hover and click follow the real projected image rectangle;
 * - selected glow scales and tilts together with the image.
 */
export class NtripThreeModelLayer implements CustomLayerInterface {
    readonly id = 'ntrip-three-models';
    readonly type = 'custom' as const;
    readonly renderingMode = '3d' as const;

    private map: MapLibreMap | null = null;
    private renderer: THREE.WebGLRenderer | null = null;

    private readonly camera = new THREE.Camera();
    private readonly scene = new THREE.Scene();

    /*
     * Image geometry is bottom-center anchored.
     */
    private readonly imageGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    private readonly glowGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    private readonly glowTexture = createGlowTexture();

    private readonly glowMaterial = new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
    });

    private readonly textureLoader = new THREE.TextureLoader();

    private readonly resources = new Map<NtripMapModelKind, ImageResource>();

    private readonly loading = new Map<NtripMapModelKind, Promise<void>>();

    private readonly failed = new Set<NtripMapModelKind>();

    private readonly objects = new Map<string, RenderedEntity>();

    private entities: NtripMapModelEntity[] = [];
    private hoveredEntityId: string | null = null;
    private disposed = false;

    private readonly onHoverEntity?: (entityId: string | null) => void;

    private readonly onSelectEntity?: (entityId: string) => void;

    /*
     * Reusable matrices and vectors avoid allocations during map movement.
     */
    private readonly translationMatrix = new THREE.Matrix4();
    private readonly bearingMatrix = new THREE.Matrix4();
    private readonly tiltMatrix = new THREE.Matrix4();
    private readonly headingMatrix = new THREE.Matrix4();
    private readonly scaleMatrix = new THREE.Matrix4();
    private readonly entityMatrix = new THREE.Matrix4();

    private readonly projectedCorner = new THREE.Vector4();

    constructor(options: NtripThreeModelLayerOptions = {}) {
        this.onHoverEntity = options.onHoverEntity;
        this.onSelectEntity = options.onSelectEntity;

        this.imageGeometry.translate(0, 0.5, 0);
        this.imageGeometry.computeBoundingSphere();

        this.textureLoader.setCrossOrigin('anonymous');
    }

    onAdd(
        map: MapLibreMap,
        gl: WebGLRenderingContext | WebGL2RenderingContext,
    ): void {
        this.disposed = false;
        this.map = map;

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
        });

        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = false;

        map.on('mousemove', this.handleMouseMove);
        map.on('click', this.handleClick);
        map.on('movestart', this.handleMoveStart);

        map.getCanvas().addEventListener(
            'pointerleave',
            this.handlePointerLeave,
        );

        void this.ensureRequiredImages();
    }

    render(
        _gl: WebGLRenderingContext | WebGL2RenderingContext,
        options: CustomRenderMethodInput,
    ): void {
        const map = this.map;
        const renderer = this.renderer;

        if (
            !map ||
            !renderer ||
            map.getZoom() < MIN_RENDER_ZOOM ||
            this.objects.size === 0
        ) {
            return;
        }

        this.camera.projectionMatrix.fromArray(
            options.defaultProjectionData.mainMatrix,
        );

        this.camera.projectionMatrixInverse
            .copy(this.camera.projectionMatrix)
            .invert();

        this.camera.matrixWorld.identity();
        this.camera.matrixWorldInverse.identity();

        this.updateAllTransforms();

        renderer.resetState();
        renderer.render(this.scene, this.camera);
        renderer.resetState();
    }

    onRemove(): void {
        this.disposed = true;

        const map = this.map;

        if (map) {
            map.off('mousemove', this.handleMouseMove);
            map.off('click', this.handleClick);
            map.off('movestart', this.handleMoveStart);

            map.getCanvas().removeEventListener(
                'pointerleave',
                this.handlePointerLeave,
            );

            map.getCanvas().style.cursor = '';
        }

        for (const rendered of this.objects.values()) {
            this.scene.remove(rendered.group);
        }

        this.objects.clear();

        for (const resource of this.resources.values()) {
            resource.material.dispose();
            resource.texture.dispose();
        }

        this.resources.clear();
        this.loading.clear();
        this.failed.clear();

        this.imageGeometry.dispose();
        this.glowGeometry.dispose();

        this.glowMaterial.dispose();
        this.glowTexture.dispose();

        this.renderer?.dispose();

        this.renderer = null;
        this.map = null;
    }

    setEntities(entities: NtripMapModelEntity[]): void {
        this.entities = entities.filter(isValidEntity);

        void this.ensureRequiredImages();

        this.synchronizeObjects();
        this.map?.triggerRepaint();
    }

    getEntityScreenBounds(entityId: string): NtripEntityScreenBounds | null {
        const polygon = this.objects.get(entityId)?.hitPolygon;

        if (!polygon || polygon.length < 3) {
            return null;
        }

        const xValues = polygon.map((point) => point.x);
        const yValues = polygon.map((point) => point.y);

        const left = Math.min(...xValues);
        const right = Math.max(...xValues);
        const top = Math.min(...yValues);
        const bottom = Math.max(...yValues);

        if (
            !Number.isFinite(left) ||
            !Number.isFinite(right) ||
            !Number.isFinite(top) ||
            !Number.isFinite(bottom)
        ) {
            return null;
        }

        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
        };
    }

    private readonly handleMouseMove = (event: MapMouseEvent): void => {
        const entityId = this.findEntityAtPoint({
            x: event.point.x,
            y: event.point.y,
        });

        this.setHoveredEntity(entityId);
    };

    private readonly handleClick = (event: MapMouseEvent): void => {
        const entityId = this.findEntityAtPoint({
            x: event.point.x,
            y: event.point.y,
        });

        if (!entityId) {
            return;
        }

        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();

        this.onSelectEntity?.(entityId);
    };

    private readonly handleMoveStart = (): void => {
        this.setHoveredEntity(null);
    };

    private readonly handlePointerLeave = (): void => {
        this.setHoveredEntity(null);
    };

    private setHoveredEntity(entityId: string | null): void {
        if (this.hoveredEntityId === entityId) {
            return;
        }

        this.hoveredEntityId = entityId;

        if (this.map) {
            this.map.getCanvas().style.cursor = entityId ? 'pointer' : '';
        }

        this.onHoverEntity?.(entityId);
        this.map?.triggerRepaint();
    }

    private findEntityAtPoint(point: ScreenPoint): string | null {
        /*
         * Selected and lower-screen entities are checked first because they
         * visually sit above overlapping markers.
         */
        const candidates = this.entities
            .map((entity) => ({
                entity,
                rendered: this.objects.get(entity.id),
            }))
            .filter(
                (
                    candidate,
                ): candidate is {
                    entity: NtripMapModelEntity;
                    rendered: RenderedEntity;
                } => candidate.rendered !== undefined,
            )
            .sort((left, right) => {
                if (
                    Boolean(left.entity.selected) !==
                    Boolean(right.entity.selected)
                ) {
                    return left.entity.selected ? -1 : 1;
                }

                const leftBottom =
                    Math.max(
                        ...left.rendered.hitPolygon.map((item) => item.y),
                    ) || 0;

                const rightBottom =
                    Math.max(
                        ...right.rendered.hitPolygon.map((item) => item.y),
                    ) || 0;

                return rightBottom - leftBottom;
            });

        for (const candidate of candidates) {
            if (pointIsInsidePolygon(point, candidate.rendered.hitPolygon)) {
                return candidate.entity.id;
            }
        }

        return null;
    }

    private async ensureRequiredImages(): Promise<void> {
        const requiredKinds = new Set(
            this.entities.map((entity) => entity.kind),
        );

        await Promise.all(
            Array.from(requiredKinds, (kind) => this.ensureImageLoaded(kind)),
        );

        if (this.disposed) {
            return;
        }

        this.synchronizeObjects();
        this.map?.triggerRepaint();
    }

    private ensureImageLoaded(kind: NtripMapModelKind): Promise<void> {
        if (this.resources.has(kind) || this.failed.has(kind)) {
            return Promise.resolve();
        }

        const currentLoad = this.loading.get(kind);

        if (currentLoad) {
            return currentLoad;
        }

        const loadPromise = this.loadImage(kind).finally(() => {
            this.loading.delete(kind);
        });

        this.loading.set(kind, loadPromise);

        return loadPromise;
    }

    private async loadImage(kind: NtripMapModelKind): Promise<void> {
        try {
            const texture = await this.textureLoader.loadAsync(
                IMAGE_URLS[kind],
            );

            if (this.disposed) {
                texture.dispose();
                return;
            }

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;

            texture.generateMipmaps = true;

            texture.anisotropy = Math.min(
                MAX_TEXTURE_ANISOTROPY,
                this.renderer?.capabilities.getMaxAnisotropy() ?? 1,
            );

            texture.needsUpdate = true;

            const dimensions = getImageDimensions(texture);

            const aspectRatio = dimensions
                ? dimensions.width / dimensions.height
                : DEFAULT_ASPECT_RATIO[kind];

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: ALPHA_TEST,

                depthTest: true,
                depthWrite: false,

                side: THREE.DoubleSide,
                toneMapped: false,
            });

            this.resources.set(kind, {
                texture,
                material,
                aspectRatio,
            });
        } catch (error) {
            this.failed.add(kind);

            console.error(
                `Could not load NTRIP ${kind} 2.5D image from ${IMAGE_URLS[kind]}:`,
                error,
            );
        }
    }

    private synchronizeObjects(): void {
        const validIds = new Set(this.entities.map((entity) => entity.id));

        for (const [id, rendered] of this.objects) {
            if (validIds.has(id)) {
                continue;
            }

            this.scene.remove(rendered.group);
            this.objects.delete(id);
        }

        for (const entity of this.entities) {
            const resource = this.resources.get(entity.kind);

            if (!resource) {
                continue;
            }

            let rendered = this.objects.get(entity.id);

            if (rendered && rendered.kind !== entity.kind) {
                this.scene.remove(rendered.group);
                this.objects.delete(entity.id);
                rendered = undefined;
            }

            if (!rendered) {
                const group = new THREE.Group();

                group.name = `ntrip-2.5d-${entity.kind}-${entity.id}`;
                group.matrixAutoUpdate = false;

                const glow = new THREE.Mesh(
                    this.glowGeometry,
                    this.glowMaterial,
                );

                glow.position.set(0, -GLOW_Y_OFFSET_RATIO, -0.001);

                glow.scale.set(GLOW_WIDTH_RATIO, GLOW_HEIGHT_RATIO, 1);

                glow.matrixAutoUpdate = true;
                glow.frustumCulled = false;
                glow.renderOrder = 9;
                glow.visible = false;

                const image = new THREE.Mesh(
                    this.imageGeometry,
                    resource.material,
                );

                image.matrixAutoUpdate = true;
                image.frustumCulled = false;

                image.castShadow = false;
                image.receiveShadow = false;

                group.add(glow, image);
                this.scene.add(group);

                rendered = {
                    kind: entity.kind,
                    group,
                    image,
                    glow,
                    hitPolygon: [],
                };

                this.objects.set(entity.id, rendered);
            }

            rendered.glow.visible = Boolean(entity.selected);
            rendered.glow.renderOrder = entity.selected ? 19 : 9;
            rendered.image.renderOrder = entity.selected ? 20 : 10;
        }

        this.updateAllTransforms();
    }

    private updateAllTransforms(): void {
        const map = this.map;

        if (!map) {
            return;
        }

        const bearingRadians = THREE.MathUtils.degToRad(map.getBearing());

        const tiltDegrees = THREE.MathUtils.clamp(
            map.getPitch() + BILLBOARD_TILT_BIAS_DEGREES,
            MIN_BILLBOARD_TILT_DEGREES,
            MAX_BILLBOARD_TILT_DEGREES,
        );

        const tiltRadians = THREE.MathUtils.degToRad(-tiltDegrees);

        this.bearingMatrix.makeRotationZ(bearingRadians);
        this.tiltMatrix.makeRotationX(tiltRadians);

        for (const entity of this.entities) {
            const rendered = this.objects.get(entity.id);
            const resource = this.resources.get(entity.kind);

            if (!rendered || !resource || rendered.kind !== entity.kind) {
                continue;
            }

            this.updateObjectTransform(rendered, entity, resource.aspectRatio);
        }
    }

    private updateObjectTransform(
        rendered: RenderedEntity,
        entity: NtripMapModelEntity,
        aspectRatio: number,
    ): void {
        const altitude = (entity.altitude ?? 0) + GROUND_OFFSET_METERS;

        const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
            [entity.longitude, entity.latitude],
            altitude,
        );

        const selectedScale = entity.selected ? SELECTED_SCALE : 1;

        const heightMeters =
            (entity.scaleMeters ?? DEFAULT_SCALE_METERS[entity.kind]) *
            selectedScale;

        const heightMercator =
            coordinate.meterInMercatorCoordinateUnits() * heightMeters;

        const widthMercator = heightMercator * aspectRatio;

        const headingRadians = THREE.MathUtils.degToRad(-(entity.heading ?? 0));

        this.translationMatrix.makeTranslation(
            coordinate.x,
            coordinate.y,
            coordinate.z,
        );

        this.headingMatrix.makeRotationZ(headingRadians);

        this.scaleMatrix.makeScale(widthMercator, -heightMercator, 1);

        this.entityMatrix
            .copy(this.translationMatrix)
            .multiply(this.bearingMatrix)
            .multiply(this.tiltMatrix)
            .multiply(this.headingMatrix)
            .multiply(this.scaleMatrix);

        rendered.group.matrix.copy(this.entityMatrix);
        rendered.group.matrixWorldNeedsUpdate = true;

        this.updateHitPolygon(rendered);
    }

    private updateHitPolygon(rendered: RenderedEntity): void {
        const map = this.map;

        if (!map) {
            rendered.hitPolygon = [];
            return;
        }

        const canvas = map.getCanvas();

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (width <= 0 || height <= 0) {
            rendered.hitPolygon = [];
            return;
        }

        const localCorners = [
            [-0.5, 0],
            [0.5, 0],
            [0.5, 1],
            [-0.5, 1],
        ] as const;

        const polygon: ScreenPoint[] = [];

        for (const [x, y] of localCorners) {
            this.projectedCorner
                .set(x, y, 0, 1)
                .applyMatrix4(rendered.group.matrix)
                .applyMatrix4(this.camera.projectionMatrix);

            if (
                !Number.isFinite(this.projectedCorner.w) ||
                this.projectedCorner.w <= 0
            ) {
                rendered.hitPolygon = [];
                return;
            }

            const inverseW = 1 / this.projectedCorner.w;

            const normalizedX = this.projectedCorner.x * inverseW;

            const normalizedY = this.projectedCorner.y * inverseW;

            polygon.push({
                x: ((normalizedX + 1) / 2) * width,
                y: ((1 - normalizedY) / 2) * height,
            });
        }

        rendered.hitPolygon = polygon;
    }
}
