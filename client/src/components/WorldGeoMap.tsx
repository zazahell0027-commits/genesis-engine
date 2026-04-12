import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CountryState, MapArtifact, MapEffect, PresetSummary } from "@genesis/shared";

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

type GeoGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type GeoFeatureSource = {
  type: "Feature";
  properties: {
    name?: string;
    admin?: string;
    id?: string;
    country?: string;
    countryId?: string;
    NAME_1?: string;
    name_en?: string;
  };
  geometry: GeoGeometry;
};

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeatureSource[];
};

type Feature = {
  id: number;
  countryId: string;
  name: string;
  path: string;
  centroid: { x: number; y: number };
  bbox: { x: number; y: number; width: number; height: number };
};

type Tooltip = {
  x: number;
  y: number;
  title: string;
  subtitle: string;
};

type EffectMarker = {
  id: string;
  kind: MapEffect["kind"];
  countryId: string;
  sourceCountryId?: string;
  label: string;
  intensity: number;
  x: number;
  y: number;
};

type ArtifactMarker = {
  id: string;
  kind: MapArtifact["kind"];
  countryId: string;
  label: string;
  strength: number;
  x: number;
  y: number;
};

type ProvinceFeature = Feature & {
  provinceId: string;
  provinceName: string;
  parentCountryId: string;
};

type OverlayMode = "balanced" | "tension" | "army" | "fortification" | "industry";

const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, width: 100, height: 50 };
const COUNTRY_PALETTE = [
  "#c9b49a",
  "#b3c08f",
  "#d8c58e",
  "#bfc9a2",
  "#d4baa7",
  "#b9c2ce",
  "#ccb4d4",
  "#c8bf97",
  "#aebfa8",
  "#d0b09c",
  "#bac6b0",
  "#c6baa3"
];
const MARKER_OFFSETS = [
  { x: -1.05, y: -0.7 },
  { x: 1.05, y: -0.7 },
  { x: -1.05, y: 0.75 },
  { x: 1.05, y: 0.75 },
  { x: 0, y: -1.2 },
  { x: 0, y: 1.2 }
];

const COUNTRY_ALIASES: Record<string, string> = {
  "czechia": "czech republic",
  "republic of the congo": "democratic republic of the congo",
  "united kingdom of great britain and northern ireland": "united kingdom",
  "federated states of micronesia": "micronesia"
};
const EUROPE_VIEWBOX: ViewBox = { x: 20, y: 7, width: 32, height: 20 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

function uniqueIds(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}

function hash(seed: string): number {
  let result = 0;
  for (let i = 0; i < seed.length; i += 1) {
    result = (result * 33 + seed.charCodeAt(i)) % 1000003;
  }
  return result;
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

function tint(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function countryFill(country: CountryState, preset: PresetSummary, mode: OverlayMode): string {
  if (mode === "tension") {
    const neutral = "#d4d0bf";
    return tint(neutral, Math.round((country.tension - 50) * 2.35));
  }

  if (mode === "army") {
    const militaryBase = "#cbbca4";
    return tint(militaryBase, Math.round((country.army * 2.8 + country.fortification * 2.2) - 24));
  }

  if (mode === "fortification") {
    const fortBase = "#c6bed9";
    return tint(fortBase, Math.round(country.fortification * 4 - 16));
  }

  if (mode === "industry") {
    const industrialBase = "#b7c7b0";
    return tint(industrialBase, Math.round((country.industry * 2.6 + country.wealth * 0.35) - 28));
  }

  const base = COUNTRY_PALETTE[hash(`${preset.id}:${country.id}`) % COUNTRY_PALETTE.length] ?? "#c7d2fe";
  const pressure = Math.round((country.tension - 50) / 4) + country.unrest;
  const production = Math.round((country.industry - 5) / 2);
  const defense = Math.round((country.fortification - 4) / 2);
  return tint(base, pressure * 2 + production - defense);
}

function effectGlyph(kind: MapEffect["kind"]): string {
  if (kind === "army") return "A";
  if (kind === "fortification") return "F";
  if (kind === "industry") return "I";
  if (kind === "stability") return "S";
  if (kind === "diplomacy") return "D";
  return "!";
}

function artifactGlyph(kind: MapArtifact["kind"]): string {
  if (kind === "unit") return "U";
  if (kind === "fort") return "F";
  return "I";
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

function overlayModeLabel(mode: OverlayMode): string {
  if (mode === "balanced") return "equilibre";
  if (mode === "tension") return "crises";
  if (mode === "army") return "troupes";
  if (mode === "fortification") return "forts";
  return "industrie";
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

      const provinceName = String(
        feature.properties.name
        ?? feature.properties.NAME_1
        ?? feature.properties.name_en
        ?? "Province"
      );
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; viewBox: ViewBox } | null>(null);
  const pointerMotionRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("balanced");
  const [countryFeatures, setCountryFeatures] = useState<Feature[]>([]);
  const [provinceFeatures, setProvinceFeatures] = useState<ProvinceFeature[]>([]);
  const [mapLoadState, setMapLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function loadMapData(): Promise<void> {
      setMapLoadState("loading");
      try {
        const [worldModule, provincesModule] = await Promise.all([
          import("../assets/world_countries_slim.json"),
          import("../assets/europe_provinces.json")
        ]);
        if (cancelled) return;

        const worldGeo = worldModule.default as GeoFeatureCollection;
        const europeGeo = provincesModule.default as GeoFeatureCollection;
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

  const showProvinceLayer = mapLoadState === "ready" && viewBox.width <= 68;
  const mapReady = mapLoadState === "ready";

  const countriesById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries]);
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
  const resolvedEffects = mapEffects ?? [];
  const resolvedArtifacts = mapArtifacts ?? [];
  const labelFeatures = useMemo(
    () => countryFeatures
      .map((feature) => ({ feature, country: countriesById.get(feature.countryId) }))
      .filter((item): item is { feature: Feature; country: CountryState } => Boolean(item.country))
      .sort((a, b) => b.country.power - a.country.power)
      .filter((item) => item.feature.bbox.width > 4.6 && item.feature.bbox.height > 1.4)
      .slice(0, 11),
    [countryFeatures, countriesById]
  );
  const visibleProvinceFeatures = useMemo(
    () => (
      showProvinceLayer
        ? provinceFeatures.filter((feature) => countriesById.has(feature.parentCountryId))
          .filter((feature) => !(
            feature.bbox.x > viewBox.x + viewBox.width ||
            feature.bbox.x + feature.bbox.width < viewBox.x ||
            feature.bbox.y > viewBox.y + viewBox.height ||
            feature.bbox.y + feature.bbox.height < viewBox.y
          ))
        : []
    ),
    [showProvinceLayer, provinceFeatures, countriesById, viewBox]
  );

  const effectMarkers = useMemo(() => {
    const grouped = new Map<string, MapEffect[]>();

    for (const effect of resolvedEffects) {
      if (!isEffectVisibleInMode(effect, overlayMode)) continue;
      const feature = featuresByCountry.get(effect.countryId);
      if (!feature) continue;
      const key = `${effect.countryId}:${effect.kind}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(effect);
      grouped.set(key, bucket);
    }

    return [...grouped.entries()].map(([key, effects]) => {
      const effect = effects[effects.length - 1];
      const feature = featuresByCountry.get(effect.countryId);
      const offset = MARKER_OFFSETS[hash(key) % MARKER_OFFSETS.length] ?? { x: 0, y: 0 };
      const intensity = effects.reduce((sum, entry) => sum + entry.intensity, 0);
      return {
        id: key,
        kind: effect.kind,
        countryId: effect.countryId,
        sourceCountryId: effect.sourceCountryId,
        label: effect.label,
        intensity,
        x: (feature?.centroid.x ?? 0) + offset.x * 0.37,
        y: (feature?.centroid.y ?? 0) + offset.y * 0.37
      } satisfies EffectMarker;
    });
  }, [resolvedEffects, featuresByCountry, overlayMode]);

  const artifactMarkers = useMemo(() => {
    return resolvedArtifacts
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
          x: anchor.centroid.x + offset.x * 0.3,
          y: anchor.centroid.y + offset.y * 0.3
        } satisfies ArtifactMarker;
      })
      .filter((marker): marker is ArtifactMarker => Boolean(marker));
  }, [resolvedArtifacts, overlayMode, provinceById, featuresByCountry]);

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

  function normalizeViewBox(next: ViewBox): ViewBox {
    const width = clamp(next.width, 18, 100);
    const height = clamp(next.height, 10, 50);
    let x = clamp(next.x, 0, 100 - width);
    let y = clamp(next.y, 0, 50 - height);

    if (width <= 26) {
      x = clamp(x, EUROPE_VIEWBOX.x, EUROPE_VIEWBOX.x + EUROPE_VIEWBOX.width - width);
      y = clamp(y, EUROPE_VIEWBOX.y, EUROPE_VIEWBOX.y + EUROPE_VIEWBOX.height - height);
    }

    return { x, y, width, height };
  }

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
    const width = clamp((maxX - minX) * 2, 18, 70);
    const height = clamp((maxY - minY) * 2, 10, 34);
    setViewBox(normalizeViewBox({
      x: minX + (maxX - minX) / 2 - width / 2,
      y: minY + (maxY - minY) / 2 - height / 2,
      width,
      height
    }));
  }, [focusToken, focusCountryIds, focusProvinceIds, featuresByCountry, provinceById]);

  function toLocalPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nextScale = event.deltaY > 0 ? 1.14 : 0.88;
    const pointX = ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const pointY = ((event.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;
    const nextWidth = Math.max(18, Math.min(100, viewBox.width * nextScale));
    const nextHeight = Math.max(10, Math.min(50, viewBox.height * nextScale));
    const widthRatio = nextWidth / viewBox.width;
    const heightRatio = nextHeight / viewBox.height;
    setViewBox(normalizeViewBox({
      x: pointX - (pointX - viewBox.x) * widthRatio,
      y: pointY - (pointY - viewBox.y) * heightRatio,
      width: nextWidth,
      height: nextHeight
    }));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    pointerMotionRef.current = { dx: 0, dy: 0 };
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      viewBox
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (!dragRef.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragRef.current.startX) / rect.width) * dragRef.current.viewBox.width;
    const deltaY = ((event.clientY - dragRef.current.startY) / rect.height) * dragRef.current.viewBox.height;
    pointerMotionRef.current = { dx: deltaX, dy: deltaY };
    setViewBox(normalizeViewBox({
      x: dragRef.current.viewBox.x - deltaX,
      y: dragRef.current.viewBox.y - deltaY,
      width: dragRef.current.viewBox.width,
      height: dragRef.current.viewBox.height
    }));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>): void {
    const momentumX = pointerMotionRef.current.dx * 0.22;
    const momentumY = pointerMotionRef.current.dy * 0.22;
    if (Math.abs(momentumX) > 0.02 || Math.abs(momentumY) > 0.02) {
      setViewBox((current) => normalizeViewBox({
        x: current.x - momentumX,
        y: current.y - momentumY,
        width: current.width,
        height: current.height
      }));
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function recenter(): void {
    setViewBox(DEFAULT_VIEWBOX);
  }

  function focusEurope(): void {
    setViewBox(EUROPE_VIEWBOX);
  }

  function focusOnSelected(): void {
    if (!selectedCountry) return;
    const feature = countryFeatures.find((item) => item.countryId === selectedCountry.id);
    if (!feature) return;

    const province = selectedProvinceId ? provinceById.get(selectedProvinceId) ?? null : null;
    const anchor = province ?? feature;
    const width = Math.max(20, Math.min(44, anchor.bbox.width * 2.4));
    const height = Math.max(10, Math.min(24, anchor.bbox.height * 2.6));
    setViewBox(normalizeViewBox({
      x: anchor.centroid.x - width / 2,
      y: anchor.centroid.y - height / 2,
      width,
      height
    }));
  }

  return (
    <div className="world-map-shell">
      <div className="world-map-tools">
        <div className="map-mode-row">
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "balanced" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "balanced"}
            onClick={() => setOverlayMode("balanced")}
          >
            Equilibre
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "tension" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "tension"}
            onClick={() => setOverlayMode("tension")}
          >
            Crises
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "army" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "army"}
            onClick={() => setOverlayMode("army")}
          >
            Troupes
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "fortification" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "fortification"}
            onClick={() => setOverlayMode("fortification")}
          >
            Forts
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "industry" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "industry"}
            onClick={() => setOverlayMode("industry")}
          >
            Industrie
          </button>
        </div>
        <div className="map-tool-row">
          <button type="button" className="map-tool-button" onClick={recenter}>
            Monde
          </button>
          <button type="button" className="map-tool-button" onClick={focusEurope}>
            Europe
          </button>
          <button type="button" className="map-tool-button" onClick={focusOnSelected} disabled={!selectedCountry || !mapReady}>
            Focus
          </button>
        </div>
      </div>

      <div className="world-map-legend">
        <span className="legend-item legend-mode">{`Mode: ${overlayModeLabel(overlayMode)}`}</span>
        <span className="legend-item"><i className="legend-dot kind-army" /> Troupes</span>
        <span className="legend-item"><i className="legend-dot kind-fortification" /> Forts</span>
        <span className="legend-item"><i className="legend-dot kind-industry" /> Industrie</span>
        <span className="legend-item"><i className="legend-dot kind-crisis" /> Crise</span>
      </div>

      <div className="world-map-wrap" ref={wrapperRef}>
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="world-map-svg"
          role="img"
          aria-label={`Carte du monde pour ${preset.title}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
            pointerMotionRef.current = { dx: 0, dy: 0 };
            setTooltip(null);
          }}
        >
          <defs>
            <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d3f72" />
              <stop offset="100%" stopColor="#05224a" />
            </linearGradient>
            <filter id="oceanTexture">
              <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="7" />
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 0.14 0"
              />
            </filter>
            <radialGradient id="oceanBloom" cx="50%" cy="42%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="oceanDepth" cx="52%" cy="48%" r="75%">
              <stop offset="0%" stopColor="#87b7ff" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#03142f" stopOpacity="0.48" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="100" height="50" fill="url(#oceanGradient)" />
          <rect x="0" y="0" width="100" height="50" filter="url(#oceanTexture)" />
          <rect x="0" y="0" width="100" height="50" fill="url(#oceanBloom)" opacity="0.24" />
          <rect x="0" y="0" width="100" height="50" fill="url(#oceanDepth)" opacity="0.72" />

          {frontlineLinks.map((line, index) => (
            <line
              key={`frontline-${line.from.countryId}-${line.to.countryId}-${index}`}
              x1={line.from.centroid.x}
              y1={line.from.centroid.y}
              x2={line.to.centroid.x}
              y2={line.to.centroid.y}
              className="frontline-link"
              style={{ strokeWidth: Math.min(0.24, 0.08 + line.intensity * 0.02) }}
            />
          ))}

          {countryFeatures.map((feature) => {
            const country = countriesById.get(feature.countryId);
            const isSelected = selectedCountryId === feature.countryId;
            const isImpacted = highlightedSet.has(feature.countryId);

            return (
              <path
                key={feature.id}
                d={feature.path}
                fill={country ? countryFill(country, preset, overlayMode) : "#b6d0dc"}
                stroke={isSelected ? "#fffdf4" : preset.mapPalette.landStroke}
                strokeWidth={isSelected ? 0.34 : 0.16}
                className={`country-shape${country ? " active" : ""}${isSelected ? " is-selected" : ""}${isImpacted ? " has-impact" : ""}`}
                onClick={() => {
                  if (!country || !mapReady) return;
                  onSelectCountry(country.id);
                }}
                onMouseMove={(event) => {
                  const point = toLocalPosition(event.clientX, event.clientY);
                  if (!point || !country) {
                    setTooltip(null);
                    return;
                  }
                  setTooltip({
                    x: point.x,
                    y: point.y,
                    title: country.name,
                    subtitle: `${country.descriptor} | Puissance ${country.power} | Armee ${country.army} | Industrie ${country.industry}`
                  });
                }}
              >
                <title>
                  {country
                    ? `${country.name} | ${country.descriptor} | Puissance ${country.power} | Armee ${country.army} | Industrie ${country.industry} | Fort ${country.fortification}`
                    : feature.name}
                </title>
              </path>
            );
          })}

          {showProvinceLayer && visibleProvinceFeatures.map((feature) => {
            const country = countriesById.get(feature.parentCountryId);
            if (!country) return null;
            const isSelected = selectedProvinceId === feature.provinceId;
            return (
              <path
                key={`province-${feature.provinceId}`}
                d={feature.path}
                className={`province-shape${isSelected ? " is-selected" : ""}`}
                onClick={() => {
                  onSelectProvince?.(feature.provinceId, feature.parentCountryId);
                }}
                onMouseMove={(event) => {
                  const point = toLocalPosition(event.clientX, event.clientY);
                  if (!point) return;
                  setTooltip({
                    x: point.x,
                    y: point.y,
                    title: feature.provinceName,
                    subtitle: `${country.name} | Province`
                  });
                }}
              />
            );
          })}

          {labelFeatures.map(({ feature, country }) => {
            const fontSize = Math.max(0.56, Math.min(1.38, feature.bbox.width * 0.065));
            return (
              <text
                key={`label-${feature.id}`}
                x={feature.centroid.x}
                y={feature.centroid.y}
                textAnchor="middle"
                className="world-map-label"
                style={{ fontSize, fill: preset.mapPalette.labelColor }}
              >
                {country.name.toUpperCase()}
              </text>
            );
          })}

          {effectMarkers.map((marker) => {
            const radius = Math.max(0.33, Math.min(0.68, 0.29 + marker.intensity * 0.05));
            return (
              <g
                key={marker.id}
                className={`map-effect-marker kind-${marker.kind}`}
                transform={`translate(${marker.x.toFixed(3)} ${marker.y.toFixed(3)})`}
                onMouseMove={(event) => {
                  const point = toLocalPosition(event.clientX, event.clientY);
                  if (!point) return;
                  const countryName = countriesById.get(marker.countryId)?.name ?? marker.countryId;
                  setTooltip({
                    x: point.x,
                    y: point.y,
                    title: countryName,
                    subtitle: marker.label
                  });
                }}
              >
                <circle r={radius} />
                <text textAnchor="middle" dominantBaseline="central">
                  {effectGlyph(marker.kind)}
                </text>
              </g>
            );
          })}

          {artifactMarkers.map((marker) => {
            const radius = Math.max(0.34, Math.min(0.72, 0.32 + marker.strength * 0.03));
            return (
              <g
                key={marker.id}
                className={`map-artifact-marker kind-${marker.kind}`}
                transform={`translate(${marker.x.toFixed(3)} ${marker.y.toFixed(3)})`}
                onMouseMove={(event) => {
                  const point = toLocalPosition(event.clientX, event.clientY);
                  if (!point) return;
                  const countryName = countriesById.get(marker.countryId)?.name ?? marker.countryId;
                  setTooltip({
                    x: point.x,
                    y: point.y,
                    title: `${countryName} | Force ${marker.strength}`,
                    subtitle: marker.label
                  });
                }}
              >
                <circle r={radius} />
                <text textAnchor="middle" dominantBaseline="central">
                  {artifactGlyph(marker.kind)}
                </text>
              </g>
            );
          })}
        </svg>

        {!mapReady && (
          <div className={`map-loading-overlay${mapLoadState === "error" ? " is-error" : ""}`}>
            <div className="map-loading-card">
              <strong>{mapLoadState === "error" ? "Map load failed" : "Loading world map..."}</strong>
              <span>
                {mapLoadState === "error"
                  ? "The GeoJSON dataset could not be loaded. Retry by refreshing the page."
                  : "Preparing countries, provinces, and tactical overlays."}
              </span>
            </div>
          </div>
        )}
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
