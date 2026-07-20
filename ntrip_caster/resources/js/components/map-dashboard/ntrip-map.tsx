import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';

import maplibregl from 'maplibre-gl';

import type {
    Map as MapLibreMap,
    StyleSpecification,
} from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import type { DashboardStation } from '@/types/ntrip-dashboard';

import {
    NtripThreeModelLayer,
    type NtripMapModelEntity,
} from '@/components/map-dashboard/ntrip-three-model-layer';

export type StationMapAnchor = {
    stationId: DashboardStation['id'];
    x: number;
    y: number;
    side: 'left' | 'right';
};

export type NtripMapHandle = {
    zoomIn: () => void;
    zoomOut: () => void;
    fitStations: () => void;
    focusSelected: () => void;
};

type NtripMapProps = {
    stations: DashboardStation[];
    selectedStationId: DashboardStation['id'] | null;
    activeStationId: DashboardStation['id'] | null;
    onSelectStation: (stationId: DashboardStation['id']) => void;
    onHoverStation: (stationId: DashboardStation['id'] | null) => void;
    onStationAnchorChange: (anchor: StationMapAnchor | null) => void;
};

const STATION_MODEL_SCALE_METERS = 35;

const DEVELOPMENT_MAP_STYLE: StyleSpecification = {
    version: 8,

    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
        },
    },

    layers: [
        {
            id: 'osm',
            type: 'raster',
            source: 'osm',

            paint: {
                'raster-saturation': -0.68,
                'raster-contrast': -0.08,
                'raster-brightness-min': 0.18,
                'raster-brightness-max': 0.95,
            },
        },
    ],
};

function hasValidCoordinates(station: DashboardStation): boolean {
    return (
        Number.isFinite(station.longitude) &&
        Number.isFinite(station.latitude) &&
        station.longitude >= -180 &&
        station.longitude <= 180 &&
        station.latitude >= -90 &&
        station.latitude <= 90
    );
}

function buildStationEntityId(
    stationId: DashboardStation['id'],
): string {
    return `station:${stationId}`;
}

function buildStationModelEntities(
    stations: DashboardStation[],
    selectedStationId: DashboardStation['id'] | null,
): NtripMapModelEntity[] {
    return stations.filter(hasValidCoordinates).map((station) => ({
        id: buildStationEntityId(station.id),
        kind: 'station',
        longitude: station.longitude,
        latitude: station.latitude,
        altitude: 0,
        scaleMeters: STATION_MODEL_SCALE_METERS,
        selected:
            selectedStationId !== null &&
            String(station.id) === String(selectedStationId),
    }));
}

export const NtripMap = forwardRef<NtripMapHandle, NtripMapProps>(
    function NtripMap(
        {
            stations,
            selectedStationId,
            activeStationId,
            onSelectStation,
            onHoverStation,
            onStationAnchorChange,
        },
        forwardedRef,
    ) {
        const containerRef = useRef<HTMLDivElement | null>(null);

        const mapRef = useRef<MapLibreMap | null>(null);

        const threeLayerRef =
            useRef<NtripThreeModelLayer | null>(null);

        const stationsRef = useRef(stations);

        const selectedStationIdRef = useRef(selectedStationId);

        const activeStationIdRef = useRef(activeStationId);

        const onSelectStationRef = useRef(onSelectStation);

        const onHoverStationRef = useRef(onHoverStation);

        const onStationAnchorChangeRef =
            useRef(onStationAnchorChange);

        const anchorFrameRef = useRef<number | null>(null);

        const initialFitCompletedRef = useRef(false);

        const [loadTimedOut, setLoadTimedOut] = useState(false);

        stationsRef.current = stations;
        selectedStationIdRef.current = selectedStationId;
        activeStationIdRef.current = activeStationId;

        onSelectStationRef.current = onSelectStation;
        onHoverStationRef.current = onHoverStation;
        onStationAnchorChangeRef.current =
            onStationAnchorChange;

        const getSelectedStation = (): DashboardStation | null => {
            if (selectedStationIdRef.current === null) {
                return null;
            }

            return (
                stationsRef.current.find(
                    (station) =>
                        String(station.id) ===
                        String(selectedStationIdRef.current),
                ) ?? null
            );
        };

        const findStationByEntityId = (
            entityId: string | null,
        ): DashboardStation | null => {
            if (!entityId) {
                return null;
            }

            return (
                stationsRef.current.find(
                    (station) =>
                        buildStationEntityId(station.id) ===
                        entityId,
                ) ?? null
            );
        };

        const synchronizeThreeStations = (): void => {
            threeLayerRef.current?.setEntities(
                buildStationModelEntities(
                    stationsRef.current,
                    selectedStationIdRef.current,
                ),
            );
        };

        const publishActiveStationAnchor = (): void => {
            const map = mapRef.current;
            const currentActiveStationId =
                activeStationIdRef.current;

            if (!map || currentActiveStationId === null) {
                onStationAnchorChangeRef.current(null);
                return;
            }

            const station = stationsRef.current.find(
                (item) =>
                    String(item.id) ===
                    String(currentActiveStationId),
            );

            if (!station || !hasValidCoordinates(station)) {
                onStationAnchorChangeRef.current(null);
                return;
            }

            const containerBounds = map
                .getContainer()
                .getBoundingClientRect();

            const entityId = buildStationEntityId(station.id);

            const imageBounds =
                threeLayerRef.current?.getEntityScreenBounds(
                    entityId,
                );

            /*
            * Khoảng cách giữa ảnh station và detail card.
            */
            const gap = 0;

            /*
            * Ước lượng chiều rộng card để quyết định mở trái hay phải.
            */
            const estimatedCardWidth = 0;

            if (imageBounds) {
                const imageRightOnScreen =
                    containerBounds.left + imageBounds.right;

                const hasEnoughSpaceOnRight =
                    imageRightOnScreen +
                        gap +
                        estimatedCardWidth <
                    window.innerWidth - 12;

                const side: 'left' | 'right' =
                    hasEnoughSpaceOnRight ? 'right' : 'left';

                const localX =
                    side === 'right'
                        ? imageBounds.right + gap
                        : imageBounds.left - gap;

                /*
                * Neo card gần phần trên của hình,
                * nhưng không đặt trực tiếp tại chân station.
                */
                const localY =
                    imageBounds.top +
                    Math.min(
                        Math.max(imageBounds.height * 0.22, 20),
                        48,
                    );

                onStationAnchorChangeRef.current({
                    stationId: station.id,
                    x: containerBounds.left + localX,
                    y: containerBounds.top + localY,
                    side,
                });

                return;
            }

            /*
            * Fallback khi ảnh chưa load hoặc chưa được render.
            */
            const point = map.project([
                station.longitude,
                station.latitude,
            ]);

            const fallbackX =
                containerBounds.left + point.x + gap;

            const fallbackY =
                containerBounds.top + point.y - 80;

            onStationAnchorChangeRef.current({
                stationId: station.id,
                x: fallbackX,
                y: fallbackY,
                side:
                    fallbackX > window.innerWidth * 0.68
                        ? 'left'
                        : 'right',
            });
        };

        const scheduleActiveStationAnchor = (): void => {
            if (anchorFrameRef.current !== null) {
                return;
            }

            anchorFrameRef.current =
                window.requestAnimationFrame(() => {
                    anchorFrameRef.current = null;
                    publishActiveStationAnchor();
                });
        };

        const fitStations = (): void => {
            const map = mapRef.current;

            const currentStations =
                stationsRef.current.filter(hasValidCoordinates);

            if (!map || currentStations.length === 0) {
                return;
            }

            map.resize();

            const container = map.getContainer();
            const width = container.clientWidth;
            const height = container.clientHeight;

            if (width < 160 || height < 160) {
                return;
            }

            if (currentStations.length === 1) {
                map.easeTo({
                    center: [
                        currentStations[0].longitude,
                        currentStations[0].latitude,
                    ],
                    zoom: 14,
                    duration: 700,
                });

                return;
            }

            const bounds = currentStations.reduce(
                (result, station) =>
                    result.extend([
                        station.longitude,
                        station.latitude,
                    ]),
                new maplibregl.LngLatBounds(),
            );

            const desktop = width >= 1280;

            const top = Math.min(
                152,
                Math.round(height * 0.16),
            );

            const right = desktop
                ? Math.min(296, Math.round(width * 0.176))
                : 19;

            const bottom =
                height >= 720
                    ? Math.min(
                          264,
                          Math.round(height * 0.24),
                      )
                    : 19;

            const left = 19;

            const usableWidth = width - left - right;
            const usableHeight = height - top - bottom;

            map.fitBounds(bounds, {
                padding:
                    usableWidth >= 180 &&
                    usableHeight >= 180
                        ? {
                              top,
                              right,
                              bottom,
                              left,
                          }
                        : 19,

                maxZoom: 14,
                duration: 800,
            });
        };

        const focusSelected = (): void => {
            const map = mapRef.current;
            const station = getSelectedStation();

            if (
                !map ||
                !station ||
                !hasValidCoordinates(station)
            ) {
                return;
            }

            map.resize();

            map.easeTo({
                center: [station.longitude, station.latitude],
                zoom: 18,
                duration: 650,
            });
        };

        useImperativeHandle(
            forwardedRef,
            () => ({
                zoomIn: () =>
                    mapRef.current?.zoomIn({
                        duration: 220,
                    }),

                zoomOut: () =>
                    mapRef.current?.zoomOut({
                        duration: 220,
                    }),

                fitStations,
                focusSelected,
            }),
            [],
        );

        useEffect(() => {
            const container = containerRef.current;

            if (!container || mapRef.current) {
                return;
            }

            let cancelled = false;

            let resizeObserver: ResizeObserver | null = null;

            let loadTimeoutId: number | null = null;

            const startMap = (): void => {
                if (
                    cancelled ||
                    !containerRef.current
                ) {
                    return;
                }

                const map = new maplibregl.Map({
                    container: containerRef.current,

                    style: DEVELOPMENT_MAP_STYLE,

                    center: [106.6745678, 10.9801234],

                    zoom: 12.8,
                    pitch: 60,
                    maxPitch: 70,

                    bearing: 0,
                    attributionControl: false,

                    canvasContextAttributes: {
                        antialias: true,
                        powerPreference: 'high-performance',
                    },
                });

                mapRef.current = map;

                map.addControl(
                    new maplibregl.AttributionControl({
                        compact: true,
                    }),
                    'bottom-left',
                );

                resizeObserver = new ResizeObserver(() => {
                    window.requestAnimationFrame(() => {
                        map.resize();
                    });
                });

                resizeObserver.observe(container);

                map.on(
                    'move',
                    scheduleActiveStationAnchor,
                );

                map.on(
                    'resize',
                    scheduleActiveStationAnchor,
                );

                loadTimeoutId = window.setTimeout(() => {
                    if (!map.loaded()) {
                        setLoadTimedOut(true);
                    }
                }, 8_000);

                map.once('style.load', () => {
                    if (cancelled) {
                        return;
                    }

                    const threeLayer =
                        new NtripThreeModelLayer({
                            onHoverEntity: (entityId) => {
                                const station =
                                    findStationByEntityId(
                                        entityId,
                                    );

                                onHoverStationRef.current(
                                    station?.id ?? null,
                                );
                            },

                            onSelectEntity: (entityId) => {
                                const station =
                                    findStationByEntityId(
                                        entityId,
                                    );

                                if (!station) {
                                    return;
                                }

                                onSelectStationRef.current(
                                    station.id,
                                );
                            },
                        });

                    threeLayerRef.current = threeLayer;

                    map.addLayer(threeLayer);

                    synchronizeThreeStations();
                });

                map.once('load', () => {
                    if (loadTimeoutId !== null) {
                        window.clearTimeout(
                            loadTimeoutId,
                        );
                    }

                    setLoadTimedOut(false);

                    window.requestAnimationFrame(() => {
                        map.resize();

                        window.setTimeout(() => {
                            fitStations();

                            initialFitCompletedRef.current =
                                true;
                        }, 80);
                    });
                });

                map.on('error', (event) => {
                    console.error(
                        'MapLibre error:',
                        event.error,
                    );
                });
            };

            const frameId =
                window.requestAnimationFrame(startMap);

            return () => {
                cancelled = true;

                window.cancelAnimationFrame(frameId);

                if (loadTimeoutId !== null) {
                    window.clearTimeout(loadTimeoutId);
                }

                resizeObserver?.disconnect();

                if (anchorFrameRef.current !== null) {
                    window.cancelAnimationFrame(
                        anchorFrameRef.current,
                    );

                    anchorFrameRef.current = null;
                }

                onHoverStationRef.current(null);
                onStationAnchorChangeRef.current(null);

                threeLayerRef.current = null;

                mapRef.current?.remove();
                mapRef.current = null;
            };
        }, []);

        useEffect(() => {
            synchronizeThreeStations();
            scheduleActiveStationAnchor();

            const map = mapRef.current;

            if (
                map?.loaded() &&
                !initialFitCompletedRef.current
            ) {
                window.requestAnimationFrame(() => {
                    fitStations();

                    initialFitCompletedRef.current = true;
                });
            }
        }, [stations]);

        useEffect(() => {
            scheduleActiveStationAnchor();
        }, [activeStationId]);

        useEffect(() => {
            synchronizeThreeStations();
        }, [selectedStationId]);

        useEffect(() => {
            if (
                selectedStationId !== null &&
                initialFitCompletedRef.current
            ) {
                focusSelected();
            }
        }, [selectedStationId]);

        return (
            <div className="ntrip-map absolute inset-0 z-0 size-full overflow-hidden bg-ntrip-cloud">
                <div
                    ref={containerRef}
                    className="absolute inset-0 size-full"
                />

                {loadTimedOut ? (
                    <div className="absolute inset-0 grid place-items-center bg-ntrip-cloud/94 px-6 text-center">
                        <div className="max-w-md origin-center rounded-card border border-ntrip-ink/8 bg-ntrip-cloud p-5 shadow-ntrip-panel-soft">
                            <p className="text-sm font-semibold text-ntrip-ink">
                                Map tiles could not be loaded
                            </p>

                            <p className="mt-2 text-xs leading-5 text-ntrip-ink/58">
                                Check the internet connection or replace the
                                development tile source.
                            </p>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    },
);
