export type WelcomeSceneNode = 'base' | 'caster' | 'uav' | 'rover';

export type WelcomeReplaceableModelNode = 'base' | 'uav';

type WelcomeModelAsset = {
    /**
     * Public GLB URL for a real model.
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
 * Only the RTK base and UAV are replaceable with external GLB files.
 * The NTRIP Caster and rover always use the procedural scene models.
 */
export const WELCOME_MODEL_ASSETS: Record<
    WelcomeReplaceableModelNode,
    WelcomeModelAsset
> = {
    base: {
        url: '/models/rtk-base.glb',
        targetSize: 2.6,
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
};
