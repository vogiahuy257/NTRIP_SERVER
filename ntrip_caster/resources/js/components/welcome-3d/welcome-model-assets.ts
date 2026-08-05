export type WelcomeSceneNode =
    'satellite' | 'base' | 'caster' | 'uav' | 'rover' | 'usv';

export type WelcomeReplaceableModelNode = WelcomeSceneNode;

type WelcomeModelAsset = {
    /**
     * Public GLB URL.
     *
     * Keep null to use the built-in procedural fallback.
     */
    url: string | null;

    /** Longest model dimension after automatic normalization. */
    targetSize: number;

    /** Optional local correction after normalization. */
    position: readonly [number, number, number];
    rotation: readonly [number, number, number];
    scale: number;
};

/**
 * Every scene node may use an external GLB.
 * Set url to null to retain its procedural fallback.
 */
export const WELCOME_MODEL_ASSETS: Record<
    WelcomeReplaceableModelNode,
    WelcomeModelAsset
> = {
    satellite: {
        url: '/models/satellite.glb',
        targetSize: 3.2,
        position: [0, 0, 0],
        rotation: [Math.PI / 2, Math.PI / 6, 0],
        scale: 1,
    },

    base: {
        url: '/models/rtk-base.glb',
        targetSize: 2.6,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
    },

    caster: {
        url: '/models/ntrip-caster.glb',
        targetSize: 3.4,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
    },

    uav: {
        url: '/models/uav-zd550.glb',
        targetSize: 3.7,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
    },

    rover: {
        url: '/models/rover.glb',
        targetSize: 3.2,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
    },

    usv: {
        url: '/models/usv.glb',
        targetSize: 3.6,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
    },
};
