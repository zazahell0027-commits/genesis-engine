import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CountryState, MapArtifact, MapEffect, PresetSummary } from "@genesis/shared";
import { STRATEGIC_CITIES } from "../assets/strategicCities";
import {
  DEFAULT_VIEWBOX,
  EUROPE_VIEWBOX,
  MAX_VIEWBOX_HEIGHT,
  MAX_VIEWBOX_WIDTH,
  MIN_VIEWBOX_HEIGHT,
  MIN_VIEWBOX_WIDTH,
  clamp,
  easeOutCubic,
  lerp,
  normalizeViewBox,
  wrap
} from "../features/map/camera";
import { deriveZoomBand, getLodPolicy, shouldPreferSelectedCountryProvinces, type ZoomBand } from "../features/map/pipeline";
import { getProvinceDisplayName, selectCountryLabelFeatures, selectProvinceLabelFeatures } from "../features/map/labeling";
import { MapChrome, type MapSettingsState, type OverlayMode } from "../features/map/MapChrome";
import { MapStage } from "../features/map/MapStage";
import { MARKER_OFFSETS, hash } from "../features/map/presentation";
import { selectVisibleArtifactMarkers, selectVisibleCityMarkers, selectVisibleEffectMarkers, selectVisibleProvinceFeatures } from "../features/map/scene";
import type {
  ArtifactMarker,
  CityMarker,
  EffectMarker,
  Feature,
  GeoFeatureCollection,
  GeoGeometry,
  GeoFeatureSource,
  ProvinceFeature,
  Tooltip,
  ViewBox
} from "../features/map/types";
import { useUiLocale } from "../i18n";

type Props = {
  countries: CountryState[];
  preset: PresetSummary;
  selectedCountryId: string | null;
  selectedProvinceId?: string | null;
  mapEffects?: MapEffect[];
  mapArtifacts?: MapArtifact[];
  highlightedCountryIds?: string[];
  focusCountryIds?: string[];
  focusProvinceIds?: string[];
  focusToken?: number;
  onSelectCountry: (countryId: string) => void;
  onSelectProvince?: (provinceId: string, countryId: string) => void;
};

const DEFAULT_MAP_SETTINGS: MapSettingsState = {
  showOwnerColors: true,
  showCountryLabels: true,
  showInvisible: false,
  showMapElements: true,
  showRegionMarkers: false,
  showRegionLabels: true,
  zoomSensitivity: 1,
  borderScale: 1,
  markerScaleRelative: 1,
  markerScaleAbsolute: 1,
  invertScroll: false,
  disableMomentum: false,
  disableEventAnimations: false,
  disableCameraMoves: false,
  globeMode: true
};

const COUNTRY_ALIASES: Record<string, string> = {
  "czechia": "czech republic",
  "republic of the congo": "democratic republic of the congo",
  "united kingdom of great britain and northern ireland": "united kingdom",
  "federated states of micronesia": "micronesia"
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resolveCountryId(rawValue: string | undefined): string {
  const normalized = normalize(rawValue ?? "");
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function project(lon: number, lat: number): { x: number; y: number } {
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 50 };
}

function toRings(geometry: GeoGeometry): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates as number[][][];
  return (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
}

function ringsPath(rings: number[][][]): { path: string; centroid: { x: number; y: number }; bbox: Feature["bbox"] } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let sumX = 0;
  let sumY = 0;
  let pointCount = 0;

  const path = rings
    .map((ring) => {
      if (ring.length === 0) return "";
      const [flon, flat] = ring[0];
      const first = project(flon, flat);
      const commands = [`M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`];

      minX = Math.min(minX, first.x);
      minY = Math.min(minY, first.y);
      maxX = Math.max(maxX, first.x);
      maxY = Math.max(maxY, first.y);
      sumX += first.x;
      sumY += first.y;
      pointCount += 1;

      for (let i = 1; i < ring.length; i += 1) {
        const [lon, lat] = ring[i];
        const p = project(lon, lat);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        sumX += p.x;
        sumY += p.y;
        pointCount += 1;
        commands.push(`L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
      }
      commands.push("Z");
      return commands.join(" ");
    })
    .join(" ");

  return {
    path,
    centroid: {
      x: pointCount > 0 ? sumX / pointCount : 0,
      y: pointCount > 0 ? sumY / pointCount : 0
    },
    bbox: {
      x: Number.isFinite(minX) ? minX : 0,
      y: Number.isFinite(minY) ? minY : 0,
      width: Number.isFinite(maxX - minX) ? maxX - minX : 0,
      height: Number.isFinite(maxY - minY) ? maxY - minY : 0
    }
  };
}

function isEffectVisibleInMode(effect: MapEffect, mode: OverlayMode): boolean {
  if (mode === "balanced") return true;
  if (mode === "tension") return effect.kind === "crisis" || effect.kind === "stability";
  if (mode === "army") return effect.kind === "army";
  if (mode === "fortification") return effect.kind === "fortification";
  return effect.kind === "industry";
}

function isArtifactVisibleInMode(artifact: MapArtifact, mode: OverlayMode): boolean {
  if (mode === "balanced" || mode === "tension") return true;
  if (mode === "army") return artifact.kind === "unit";
  if (mode === "fortification") return artifact.kind === "fort";
  return artifact.kind === "industry_site";
}

function buildCountryFeatures(geoData: GeoFeatureCollection): Feature[] {
  return geoData.features
    .map((feature, index) => {
      const rings = toRings(feature.geometry);
      if (rings.length === 0) return null;

      const name = String(feature.properties.name ?? feature.properties.admin ?? "Unknown");
      const projected = ringsPath(rings);
      return {
        id: index,
        countryId: normalize(name),
        name,
        path: projected.path,
        centroid: projected.centroid,
        bbox: projected.bbox
      } as Feature;
    })
    .filter((item): item is Feature => Boolean(item));
}

function buildProvinceFeatures(provinceGeoData: GeoFeatureCollection): ProvinceFeature[] {
  return provinceGeoData.features
    .map((feature, index) => {
      const rings = toRings(feature.geometry);
      if (rings.length === 0) return null;

      const provinceNameNative = feature.properties.name
        ? String(feature.properties.name)
        : undefined;
      const provinceNameEn = feature.properties.name_en
        ? String(feature.properties.name_en)
        : feature.properties.NAME_1
          ? String(feature.properties.NAME_1)
          : undefined;
      const provinceName = provinceNameEn ?? provinceNameNative ?? "Province";
      const provinceId = normalize(String(feature.properties.id ?? `${provinceName}-${index}`));
      const parentCountryId = resolveCountryId(feature.properties.countryId ?? feature.properties.country);
      if (!parentCountryId) return null;

      const projected = ringsPath(rings);
      return {
        id: 100000 + index,
        countryId: parentCountryId,
        name: provinceName,
        path: projected.path,
        centroid: projected.centroid,
        bbox: projected.bbox,
        provinceId,
        provinceName,
        provinceNameNative,
        provinceNameEn,
        parentCountryId
      } as ProvinceFeature;
    })
    .filter((item): item is ProvinceFeature => Boolean(item));
}

export function WorldGeoMap({
  countries,
  preset,
  selectedCountryId,
  selectedProvinceId,
  mapEffects,
  mapArtifacts,
  highlightedCountryIds,
  focusCountryIds,
  focusProvinceIds,
  focusToken,
  onSelectCountry,
  onSelectProvince
}: Props): React.JSX.Element {
  const { locale } = useUiLocale();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    viewBox: ViewBox;
    startGlobeRotation: number;
  } | null>(null);
  const pointerMotionRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const viewBoxFrameRef = useRef<number | null>(null);
  const pendingViewBoxRef = useRef<ViewBox | null>(null);
  const globeRotationRef = useRef(0);
  const globeRotationFrameRef = useRef<number | null>(null);
  const pendingGlobeRotationRef = useRef<number | null>(null);
  const tooltipFrameRef = useRef<number | null>(null);
  const pendingTooltipRef = useRef<Tooltip | null>(null);
  const viewBoxRef = useRef<ViewBox>(DEFAULT_VIEWBOX);

  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("balanced");
  const [showSettings, setShowSettings] = useState(false);
  const [mapSettings, setMapSettings] = useState<MapSettingsState>(DEFAULT_MAP_SETTINGS);
  const [globeRotation, setGlobeRotation] = useState(0);
  const [countryFeatures, setCountryFeatures] = useState<Feature[]>([]);
  const [provinceFeatures, setProvinceFeatures] = useState<ProvinceFeature[]>([]);
  const [mapLoadState, setMapLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadMapData(): Promise<void> {
      setMapLoadState("loading");
      try {
        const baseUrl = import.meta.env.BASE_URL || "/";
        const [worldResponse, provincesResponse] = await Promise.all([
          fetch(`${baseUrl}maps/world_countries_slim.json`),
          fetch(`${baseUrl}maps/europe_provinces.json`)
        ]);
        if (!worldResponse.ok || !provincesResponse.ok) {
          throw new Error("GeoJSON files are not available");
        }
        if (cancelled) return;

        const [worldGeo, europeGeo] = await Promise.all([
          worldResponse.json() as Promise<GeoFeatureCollection>,
          provincesResponse.json() as Promise<GeoFeatureCollection>
        ]);
        setCountryFeatures(buildCountryFeatures(worldGeo));
        setProvinceFeatures(buildProvinceFeatures(europeGeo));
        setMapLoadState("ready");
      } catch {
        if (cancelled) return;
        setCountryFeatures([]);
        setProvinceFeatures([]);
        setMapLoadState("error");
      }
    }

    void loadMapData();

    return () => {
      cancelled = true;
    };
  }, []);

  const zoomBand: ZoomBand = deriveZoomBand(viewBox.width);
  const isGlobeMode = mapSettings.globeMode && zoomBand === "far";
  const shouldTileFlat = !isGlobeMode
    && (zoomBand === "far" || zoomBand === "global")
    && viewBox.width < 92
    && (viewBox.x + viewBox.width > MAX_VIEWBOX_WIDTH);
  const isDetailZoom = zoomBand === "detail";
  const mapReady = mapLoadState === "ready";

  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries]
  );
  const featuresByCountry = useMemo(
    () => new Map(countryFeatures.map((feature) => [feature.countryId, feature])),
    [countryFeatures]
  );
  const provinceById = useMemo(
    () => new Map(provinceFeatures.map((feature) => [feature.provinceId, feature])),
    [provinceFeatures]
  );
  const selectedCountry = selectedCountryId ? countriesById.get(selectedCountryId) ?? null : null;
  const highlightedSet = useMemo(() => new Set(highlightedCountryIds ?? []), [highlightedCountryIds]);
  const focusSet = useMemo(() => new Set(focusCountryIds ?? []), [focusCountryIds]);
  const resolvedEffects = mapEffects ?? [];
  const resolvedArtifacts = mapArtifacts ?? [];
  const markerScaleBase = clamp((viewBox.width / 35) * mapSettings.markerScaleRelative * mapSettings.markerScaleAbsolute, 0.22, 2.2);
  const borderScale = clamp(mapSettings.borderScale, 0.25, 3);

  const lodPolicy = getLodPolicy({
    zoomBand,
    viewWidth: viewBox.width,
    selectedCountryId,
    showInvisible: mapSettings.showInvisible,
    showMapElements: mapSettings.showMapElements,
    showRegionMarkers: mapSettings.showRegionMarkers,
    showRegionLabels: mapSettings.showRegionLabels,
    showCountryLabels: mapSettings.showCountryLabels
  });

  const showCountryLabels = lodPolicy.showCountryLabels;
  const showRegionLabels = lodPolicy.showRegionLabels;
  const showProvinceLayer = lodPolicy.showProvinceLayer;
  const showFrontlineLayer = lodPolicy.showFrontlineLayer;
  const showEffectsLayer = lodPolicy.showEffectsLayer;
  const showArtifactsLayer = lodPolicy.showArtifactsLayer;
  const showCitiesLayer = lodPolicy.showCitiesLayer;

  const labelDensityLimit = lodPolicy.labelDensityLimit;
  const labelMinWidth = lodPolicy.labelMinWidth;
  const labelMinHeight = lodPolicy.labelMinHeight;
  const countryLabelZoomFactor = lodPolicy.countryLabelZoomFactor;

  const countryLabelFeatures = useMemo(
    () => selectCountryLabelFeatures({
      countryFeatures,
      countriesById,
      selectedCountryId,
      zoomBand,
      viewWidth: viewBox.width,
      labelDensityLimit,
      labelMinWidth,
      labelMinHeight
    }),
    [countryFeatures, countriesById, selectedCountryId, zoomBand, viewBox.width, labelDensityLimit, labelMinWidth, labelMinHeight]
  );

  const visibleProvinceFeatures = useMemo(() => (
    selectVisibleProvinceFeatures({
      provinceFeatures: provinceFeatures.filter((feature) => countriesById.has(feature.parentCountryId)),
      showProvinceLayer,
      selectedCountryId,
      showInvisible: mapSettings.showInvisible,
      preferSelectedCountry: shouldPreferSelectedCountryProvinces(viewBox.width),
      isDetailZoom,
      viewBox
    })
  ), [showProvinceLayer, provinceFeatures, countriesById, viewBox, isDetailZoom, selectedCountryId, mapSettings.showInvisible]);

  const provinceLabelFeatures = useMemo(() => {
    if (!showRegionLabels) return [] as Array<{ x: number; y: number; label: string; feature: ProvinceFeature }>;
    return selectProvinceLabelFeatures({
      provinceFeatures: visibleProvinceFeatures,
      selectedCountryId,
      zoomBand,
      locale,
      showInvisible: mapSettings.showInvisible
    });
  }, [locale, mapSettings.showInvisible, showRegionLabels, visibleProvinceFeatures, selectedCountryId, zoomBand]);

  const effectMarkers = useMemo(() => {
    const grouped = new Map<string, MapEffect[]>();

    for (const effect of resolvedEffects) {
      if (!isEffectVisibleInMode(effect, overlayMode)) continue;
      if (!mapSettings.showInvisible && effect.intensity <= 0) continue;
      const feature = featuresByCountry.get(effect.countryId);
      if (!feature) continue;
      const key = `${effect.countryId}:${effect.kind}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(effect);
      grouped.set(key, bucket);
    }

    const raw = [...grouped.entries()].map(([key, effects]) => {
      const effect = effects[effects.length - 1];
      const feature = featuresByCountry.get(effect.countryId);
      const offset = MARKER_OFFSETS[hash(key) % MARKER_OFFSETS.length] ?? { x: 0, y: 0 };
      const intensity = effects.reduce((sum, entry) => sum + entry.intensity, 0);
      const latestTick = Math.max(...effects.map((entry) => entry.tick));
      return {
        id: key,
        kind: effect.kind,
        countryId: effect.countryId,
        label: effect.label,
        intensity,
        latestTick,
        x: (feature?.centroid.x ?? 0) + offset.x * 0.36,
        y: (feature?.centroid.y ?? 0) + offset.y * 0.36
      } satisfies EffectMarker;
    });

    return selectVisibleEffectMarkers({
      raw,
      zoomBand,
      selectedCountryId,
      showInvisible: mapSettings.showInvisible,
      minDistance: lodPolicy.effectMinDistance,
      maxCount: lodPolicy.effectMaxCount
    });
  }, [resolvedEffects, featuresByCountry, overlayMode, zoomBand, lodPolicy.effectMinDistance, lodPolicy.effectMaxCount, mapSettings.showInvisible]);
  const latestEffectTick = effectMarkers.reduce((maxTick, marker) => Math.max(maxTick, marker.latestTick), -1);

  const artifactMarkers = useMemo(() => {
    const raw = resolvedArtifacts
      .filter((artifact) => isArtifactVisibleInMode(artifact, overlayMode))
      .map((artifact) => {
        const province = artifact.provinceId ? provinceById.get(artifact.provinceId) : null;
        const countryFeature = featuresByCountry.get(artifact.countryId);
        const anchor = province ?? countryFeature;
        if (!anchor) return null;
        const offset = MARKER_OFFSETS[hash(`${artifact.id}:${artifact.strength}`) % MARKER_OFFSETS.length] ?? { x: 0, y: 0 };
        return {
          id: artifact.id,
          kind: artifact.kind,
          countryId: artifact.countryId,
          label: artifact.label,
          strength: artifact.strength,
          x: anchor.centroid.x + offset.x * 0.28,
          y: anchor.centroid.y + offset.y * 0.28
        } satisfies ArtifactMarker;
      })
      .filter((marker): marker is ArtifactMarker => Boolean(marker));

    return selectVisibleArtifactMarkers({
      raw,
      zoomBand,
      selectedCountryId,
      showInvisible: mapSettings.showInvisible,
      minDistance: lodPolicy.artifactMinDistance,
      maxCount: lodPolicy.artifactMaxCount
    });
  }, [resolvedArtifacts, overlayMode, provinceById, featuresByCountry, zoomBand, lodPolicy.artifactMinDistance, lodPolicy.artifactMaxCount, mapSettings.showInvisible]);

  const cityMarkers = useMemo(() => {
    if (!showCitiesLayer) return [] as CityMarker[];

    const paddedView = {
      minX: viewBox.x - viewBox.width * 0.08,
      maxX: viewBox.x + viewBox.width * 1.08,
      minY: viewBox.y - viewBox.height * 0.08,
      maxY: viewBox.y + viewBox.height * 1.08
    };

    const raw = STRATEGIC_CITIES
      .filter((city) => countriesById.has(city.countryId))
      .map((city) => {
        const projected = project(city.lon, city.lat);
        return {
          id: city.id,
          countryId: city.countryId,
          tier: city.tier,
          label: city.name,
          x: projected.x,
          y: projected.y
        } satisfies CityMarker;
      })
      .filter((marker) => (
        marker.x >= paddedView.minX &&
        marker.x <= paddedView.maxX &&
        marker.y >= paddedView.minY &&
        marker.y <= paddedView.maxY
      ))
    return selectVisibleCityMarkers({
      raw,
      zoomBand,
      selectedCountryId,
      showInvisible: mapSettings.showInvisible,
      minDistance: lodPolicy.cityMinDistance,
      maxCount: lodPolicy.cityMaxCount
    });
  }, [countriesById, viewBox, showCitiesLayer, zoomBand, mapSettings.showInvisible, selectedCountryId, lodPolicy.cityMinDistance, lodPolicy.cityMaxCount]);

  const frontlineLinks = useMemo(() => {
    const links = new Map<string, { from: Feature; to: Feature; intensity: number }>();

    for (const effect of resolvedEffects) {
      if (!effect.sourceCountryId || effect.sourceCountryId === effect.countryId) continue;
      if (effect.kind !== "army" && effect.kind !== "crisis" && effect.kind !== "fortification") continue;

      const from = featuresByCountry.get(effect.sourceCountryId);
      const to = featuresByCountry.get(effect.countryId);
      if (!from || !to) continue;
      const key = `${from.countryId}->${to.countryId}`;
      const current = links.get(key);
      if (current) {
        current.intensity = Math.max(current.intensity, effect.intensity);
      } else {
        links.set(key, { from, to, intensity: effect.intensity });
      }
    }

    return [...links.values()];
  }, [resolvedEffects, featuresByCountry]);

  function cancelAnimation(): void {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function cancelViewBoxFrame(): void {
    if (viewBoxFrameRef.current !== null) {
      window.cancelAnimationFrame(viewBoxFrameRef.current);
      viewBoxFrameRef.current = null;
    }
    pendingViewBoxRef.current = null;
  }

  function cancelGlobeRotationFrame(): void {
    if (globeRotationFrameRef.current !== null) {
      window.cancelAnimationFrame(globeRotationFrameRef.current);
      globeRotationFrameRef.current = null;
    }
    pendingGlobeRotationRef.current = null;
  }

  function cancelTooltipFrame(): void {
    if (tooltipFrameRef.current !== null) {
      window.cancelAnimationFrame(tooltipFrameRef.current);
      tooltipFrameRef.current = null;
    }
  }

  function scheduleViewBox(next: ViewBox): void {
    viewBoxRef.current = next;
    pendingViewBoxRef.current = next;

    if (viewBoxFrameRef.current !== null) return;

    viewBoxFrameRef.current = window.requestAnimationFrame(() => {
      viewBoxFrameRef.current = null;
      const pending = pendingViewBoxRef.current;
      pendingViewBoxRef.current = null;
      if (pending) {
        setViewBox(pending);
      }
    });
  }

  function setGlobeRotationImmediate(next: number): void {
    cancelGlobeRotationFrame();
    globeRotationRef.current = next;
    setGlobeRotation(next);
  }

  function scheduleGlobeRotation(next: number): void {
    globeRotationRef.current = next;
    pendingGlobeRotationRef.current = next;

    if (globeRotationFrameRef.current !== null) return;

    globeRotationFrameRef.current = window.requestAnimationFrame(() => {
      globeRotationFrameRef.current = null;
      const pending = pendingGlobeRotationRef.current;
      pendingGlobeRotationRef.current = null;
      if (pending !== null) {
        setGlobeRotation(pending);
      }
    });
  }

  function setViewBoxImmediate(next: ViewBox): void {
    cancelViewBoxFrame();
    const normalized = normalizeViewBox(next);
    viewBoxRef.current = normalized;
    setViewBox(normalized);
  }

  function animateToViewBox(target: ViewBox, duration = 430): void {
    if (mapSettings.disableCameraMoves) {
      setViewBoxImmediate(target);
      return;
    }

    cancelAnimation();
    const from = viewBoxRef.current;
    const to = normalizeViewBox(target);
    const start = performance.now();

    function step(now: number): void {
      const elapsed = now - start;
      const progress = clamp(elapsed / duration, 0, 1);
      const eased = easeOutCubic(progress);
      const interpolated = normalizeViewBox({
        x: lerp(from.x, to.x, eased),
        y: lerp(from.y, to.y, eased),
        width: lerp(from.width, to.width, eased),
        height: lerp(from.height, to.height, eased)
      });

      viewBoxRef.current = interpolated;
      setViewBox(interpolated);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(step);
  }

  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  useEffect(() => {
    globeRotationRef.current = globeRotation;
  }, [globeRotation]);

  useEffect(() => () => {
    cancelAnimation();
    cancelViewBoxFrame();
    cancelGlobeRotationFrame();
    cancelTooltipFrame();
  }, []);

  useEffect(() => {
    if (!isGlobeMode && Math.abs(globeRotation) > 0.01) {
      setGlobeRotationImmediate(0);
    }
  }, [isGlobeMode, globeRotation]);

  useEffect(() => {
    const countryTargets = (focusCountryIds ?? [])
      .map((countryId) => featuresByCountry.get(countryId) ?? null)
      .filter((feature): feature is Feature => Boolean(feature));
    const provinceTargets = (focusProvinceIds ?? [])
      .map((provinceId) => provinceById.get(provinceId) ?? null)
      .filter((feature): feature is ProvinceFeature => Boolean(feature));
    const targets = [...provinceTargets, ...countryTargets];
    if (targets.length === 0) return;

    const minX = Math.min(...targets.map((feature) => feature.bbox.x));
    const minY = Math.min(...targets.map((feature) => feature.bbox.y));
    const maxX = Math.max(...targets.map((feature) => feature.bbox.x + feature.bbox.width));
    const maxY = Math.max(...targets.map((feature) => feature.bbox.y + feature.bbox.height));
    const width = clamp((maxX - minX) * 1.95, 7.5, 70);
    const height = clamp((maxY - minY) * 1.95, 4.2, 34);
    animateToViewBox({
      x: minX + (maxX - minX) / 2 - width / 2,
      y: minY + (maxY - minY) / 2 - height / 2,
      width,
      height
    }, 500);
  }, [focusToken, focusCountryIds, focusProvinceIds, featuresByCountry, provinceById, mapSettings.disableCameraMoves]);

  function toLocalPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function clearTooltip(): void {
    pendingTooltipRef.current = null;
    cancelTooltipFrame();
    setTooltip((current) => (current ? null : current));
  }

  function showTooltipFromClientPoint(clientX: number, clientY: number, title: string, subtitle: string): void {
    const point = toLocalPosition(clientX, clientY);
    if (!point) {
      clearTooltip();
      return;
    }
    pendingTooltipRef.current = {
      x: point.x,
      y: point.y,
      title,
      subtitle
    };

    if (tooltipFrameRef.current !== null) return;

    tooltipFrameRef.current = window.requestAnimationFrame(() => {
      tooltipFrameRef.current = null;
      const next = pendingTooltipRef.current;
      if (!next) return;
      setTooltip((current) => {
        if (
          current
          && current.title === next.title
          && current.subtitle === next.subtitle
          && Math.abs(current.x - next.x) < 3
          && Math.abs(current.y - next.y) < 3
        ) {
          return current;
        }
        return next;
      });
    });
  }

  function provinceDisplayName(feature: ProvinceFeature): string {
    return getProvinceDisplayName(feature, locale);
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    cancelAnimation();

    const rawDelta = mapSettings.invertScroll ? -event.deltaY : event.deltaY;
    const wheelDelta = clamp(rawDelta, -140, 140);

    if (isGlobeMode) {
      if (wheelDelta < 0) {
        animateToViewBox({ x: 10, y: 5, width: 80, height: 40 }, 360);
        return;
      }

      scheduleGlobeRotation(wrap(globeRotationRef.current + wheelDelta * 0.018, -100, 100));
      return;
    }

    const current = viewBoxRef.current;
    const sensitivity = clamp(mapSettings.zoomSensitivity, 0.5, 3);
    const nextScale = Math.exp(wheelDelta * (0.0018 * sensitivity));
    const pointX = ((event.clientX - rect.left) / rect.width) * current.width + current.x;
    const pointY = ((event.clientY - rect.top) / rect.height) * current.height + current.y;
    const nextWidth = clamp(current.width * nextScale, MIN_VIEWBOX_WIDTH, MAX_VIEWBOX_WIDTH);
    const nextHeight = clamp(current.height * nextScale, MIN_VIEWBOX_HEIGHT, MAX_VIEWBOX_HEIGHT);
    const widthRatio = nextWidth / current.width;
    const heightRatio = nextHeight / current.height;
    const nextViewBox = normalizeViewBox({
      x: pointX - (pointX - current.x) * widthRatio,
      y: pointY - (pointY - current.y) * heightRatio,
      width: nextWidth,
      height: nextHeight
    });

    viewBoxRef.current = nextViewBox;
    scheduleViewBox(nextViewBox);
    if (
      mapSettings.globeMode
      && wheelDelta > 0
      && nextViewBox.width >= 93
    ) {
      setGlobeRotationImmediate(0);
      setViewBoxImmediate(DEFAULT_VIEWBOX);
    }

  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    cancelAnimation();
    pointerMotionRef.current = { dx: 0, dy: 0 };
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      viewBox: viewBoxRef.current,
      startGlobeRotation: globeRotation
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (!dragRef.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();

    if (isGlobeMode) {
      const delta = (event.clientX - dragRef.current.startX) / rect.width;
      scheduleGlobeRotation(wrap(dragRef.current.startGlobeRotation + delta * 100, -100, 100));
      return;
    }

    const deltaX = ((event.clientX - dragRef.current.startX) / rect.width) * dragRef.current.viewBox.width;
    const deltaY = ((event.clientY - dragRef.current.startY) / rect.height) * dragRef.current.viewBox.height;
    pointerMotionRef.current = { dx: deltaX, dy: deltaY };
    const nextViewBox = normalizeViewBox({
      x: dragRef.current.viewBox.x - deltaX,
      y: dragRef.current.viewBox.y - deltaY,
      width: dragRef.current.viewBox.width,
      height: dragRef.current.viewBox.height
    });
    viewBoxRef.current = nextViewBox;
    scheduleViewBox(nextViewBox);

  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>): void {
    if (isGlobeMode || mapSettings.disableMomentum) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    const maxMomentumX = viewBoxRef.current.width * 0.1;
    const maxMomentumY = viewBoxRef.current.height * 0.1;
    const momentumX = clamp(pointerMotionRef.current.dx * 0.18, -maxMomentumX, maxMomentumX);
    const momentumY = clamp(pointerMotionRef.current.dy * 0.18, -maxMomentumY, maxMomentumY);
    if (Math.abs(momentumX) > 0.02 || Math.abs(momentumY) > 0.02) {
      animateToViewBox({
        x: viewBoxRef.current.x - momentumX,
        y: viewBoxRef.current.y - momentumY,
        width: viewBoxRef.current.width,
        height: viewBoxRef.current.height
      }, 240);
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleDoubleClick(event: React.MouseEvent<SVGSVGElement>): void {
    event.preventDefault();
    if (isGlobeMode) {
      animateToViewBox({ x: 10, y: 5, width: 80, height: 40 }, 360);
      return;
    }

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = viewBoxRef.current;
    const pointX = ((event.clientX - rect.left) / rect.width) * current.width + current.x;
    const pointY = ((event.clientY - rect.top) / rect.height) * current.height + current.y;
    const nextWidth = clamp(current.width * 0.72, MIN_VIEWBOX_WIDTH, MAX_VIEWBOX_WIDTH);
    const nextHeight = clamp(current.height * 0.72, MIN_VIEWBOX_HEIGHT, MAX_VIEWBOX_HEIGHT);
    const widthRatio = nextWidth / current.width;
    const heightRatio = nextHeight / current.height;
    animateToViewBox({
      x: pointX - (pointX - current.x) * widthRatio,
      y: pointY - (pointY - current.y) * heightRatio,
      width: nextWidth,
      height: nextHeight
    }, 320);
  }

  function recenter(): void {
    setGlobeRotationImmediate(0);
    animateToViewBox(DEFAULT_VIEWBOX, 450);
  }

  function focusEurope(): void {
    setGlobeRotationImmediate(0);
    animateToViewBox(EUROPE_VIEWBOX, 450);
  }

  function focusOnSelected(): void {
    if (!selectedCountry) return;
    const feature = countryFeatures.find((item) => item.countryId === selectedCountry.id);
    if (!feature) return;

    const province = selectedProvinceId ? provinceById.get(selectedProvinceId) ?? null : null;
    const anchor = province ?? feature;
    const width = province
      ? clamp(anchor.bbox.width * 2.2, MIN_VIEWBOX_WIDTH, 12)
      : clamp(anchor.bbox.width * 2.25, 7, 30);
    const height = province
      ? clamp(anchor.bbox.height * 2.25, MIN_VIEWBOX_HEIGHT, 7.6)
      : clamp(anchor.bbox.height * 2.35, 4, 18);
    animateToViewBox({
      x: anchor.centroid.x - width / 2,
      y: anchor.centroid.y - height / 2,
      width,
      height
    }, 460);
  }

  function toggleGlobeMode(): void {
    const nextGlobeMode = !mapSettings.globeMode;
    setMapSettings((current) => ({ ...current, globeMode: nextGlobeMode }));
    if (nextGlobeMode) {
      setGlobeRotationImmediate(0);
      setViewBoxImmediate(DEFAULT_VIEWBOX);
    }
  }

  return (
    <div className={`world-map-shell zoom-${zoomBand}${isGlobeMode ? " is-globe-mode" : ""}${mapSettings.disableEventAnimations ? " no-event-anim" : ""}`}>
      <MapChrome
        overlayMode={overlayMode}
        onOverlayModeChange={setOverlayMode}
        onRecenter={recenter}
        onFocusEurope={focusEurope}
        onFocusSelected={focusOnSelected}
        onToggleGlobeMode={toggleGlobeMode}
        canFocusSelected={Boolean(selectedCountry && mapReady)}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((current) => !current)}
        onCloseSettings={() => setShowSettings(false)}
        showProvinceLayer={showProvinceLayer}
        mapSettings={mapSettings}
        setMapSettings={setMapSettings}
      />

      <div className="world-map-wrap" ref={wrapperRef}>
        <MapStage
          viewBox={viewBox}
          preset={preset}
          zoomBand={zoomBand}
          isGlobeMode={isGlobeMode}
          shouldTileFlat={shouldTileFlat}
          globeRotation={globeRotation}
          borderScale={borderScale}
          markerScaleBase={markerScaleBase}
          overlayMode={overlayMode}
          mapReady={mapReady}
          selectedCountryId={selectedCountryId}
          selectedProvinceId={selectedProvinceId ?? null}
          countryFeatures={countryFeatures}
          visibleProvinceFeatures={visibleProvinceFeatures}
          countryLabelFeatures={countryLabelFeatures}
          provinceLabelFeatures={provinceLabelFeatures}
          showProvinceLayer={showProvinceLayer}
          showCountryLabels={showCountryLabels}
          showRegionLabels={showRegionLabels}
          showFrontlineLayer={showFrontlineLayer}
          showEffectsLayer={showEffectsLayer}
          showArtifactsLayer={showArtifactsLayer}
          showCitiesLayer={showCitiesLayer}
          latestEffectTick={latestEffectTick}
          countriesById={countriesById}
          effectMarkers={effectMarkers}
          artifactMarkers={artifactMarkers}
          cityMarkers={cityMarkers}
          frontlineLinks={frontlineLinks}
          highlightedSet={highlightedSet}
          focusSet={focusSet}
          countryLabelZoomFactor={countryLabelZoomFactor}
          showOwnerColors={mapSettings.showOwnerColors}
          localeProvinceName={provinceDisplayName}
          onSelectCountry={onSelectCountry}
          onSelectProvince={onSelectProvince}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onPointerLeave={() => {
            dragRef.current = null;
            pointerMotionRef.current = { dx: 0, dy: 0 };
            clearTooltip();
          }}
          showTooltipFromClientPoint={showTooltipFromClientPoint}
          clearTooltip={clearTooltip}
          mapLoadState={mapLoadState}
        />
      </div>

      {tooltip && (
        <div className="world-map-tooltip" style={{ left: tooltip.x + 18, top: tooltip.y + 18 }}>
          <strong>{tooltip.title}</strong>
          <span>{tooltip.subtitle}</span>
        </div>
      )}
    </div>
  );
}
