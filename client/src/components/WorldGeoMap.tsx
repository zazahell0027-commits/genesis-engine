import React, { useMemo, useRef, useState } from "react";
import type { CountryState, MapEffect, PresetSummary } from "@genesis/shared";
import rawWorldGeo from "../assets/world_countries_slim.json";

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
  mapEffects?: MapEffect[];
  highlightedCountryIds?: string[];
  onSelectCountry: (countryId: string) => void;
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

const geoData = rawWorldGeo as GeoFeatureCollection;
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

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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

function countryFill(country: CountryState, preset: PresetSummary): string {
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

const FEATURES: Feature[] = geoData.features
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

export function WorldGeoMap({
  countries,
  preset,
  selectedCountryId,
  mapEffects,
  highlightedCountryIds,
  onSelectCountry
}: Props): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; viewBox: ViewBox } | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const countriesById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries]);
  const featuresByCountry = useMemo(() => new Map(FEATURES.map((feature) => [feature.countryId, feature])), []);
  const selectedCountry = selectedCountryId ? countriesById.get(selectedCountryId) ?? null : null;
  const highlightedSet = useMemo(() => new Set(highlightedCountryIds ?? []), [highlightedCountryIds]);
  const resolvedEffects = mapEffects ?? [];
  const labelFeatures = FEATURES
    .map((feature) => ({ feature, country: countriesById.get(feature.countryId) }))
    .filter((item): item is { feature: Feature; country: CountryState } => Boolean(item.country))
    .sort((a, b) => b.country.power - a.country.power)
    .filter((item) => item.feature.bbox.width > 4.6 && item.feature.bbox.height > 1.4)
    .slice(0, 9);

  const effectMarkers = useMemo(() => {
    const grouped = new Map<string, MapEffect[]>();

    for (const effect of resolvedEffects) {
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
  }, [resolvedEffects, featuresByCountry]);

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
    const nextWidth = Math.max(28, Math.min(100, viewBox.width * nextScale));
    const nextHeight = Math.max(14, Math.min(50, viewBox.height * nextScale));
    const widthRatio = nextWidth / viewBox.width;
    const heightRatio = nextHeight / viewBox.height;

    setViewBox({
      x: Math.max(0, Math.min(100 - nextWidth, pointX - (pointX - viewBox.x) * widthRatio)),
      y: Math.max(0, Math.min(50 - nextHeight, pointY - (pointY - viewBox.y) * heightRatio)),
      width: nextWidth,
      height: nextHeight
    });
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
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

    setViewBox({
      x: Math.max(0, Math.min(100 - dragRef.current.viewBox.width, dragRef.current.viewBox.x - deltaX)),
      y: Math.max(0, Math.min(50 - dragRef.current.viewBox.height, dragRef.current.viewBox.y - deltaY)),
      width: dragRef.current.viewBox.width,
      height: dragRef.current.viewBox.height
    });
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>): void {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function recenter(): void {
    setViewBox(DEFAULT_VIEWBOX);
  }

  function focusOnSelected(): void {
    if (!selectedCountry) return;
    const feature = FEATURES.find((item) => item.countryId === selectedCountry.id);
    if (!feature) return;

    const width = Math.max(24, Math.min(44, feature.bbox.width * 2.2));
    const height = Math.max(12, Math.min(24, feature.bbox.height * 2.4));
    setViewBox({
      x: Math.max(0, Math.min(100 - width, feature.centroid.x - width / 2)),
      y: Math.max(0, Math.min(50 - height, feature.centroid.y - height / 2)),
      width,
      height
    });
  }

  return (
    <div className="world-map-shell">
      <div className="world-map-tools">
        <button type="button" className="map-tool-button" onClick={recenter}>
          Reset
        </button>
        <button type="button" className="map-tool-button" onClick={focusOnSelected} disabled={!selectedCountry}>
          Focus
        </button>
      </div>

      <div className="world-map-legend">
        <span className="legend-item"><i className="legend-dot kind-army" /> Troops</span>
        <span className="legend-item"><i className="legend-dot kind-fortification" /> Forts</span>
        <span className="legend-item"><i className="legend-dot kind-industry" /> Industry</span>
        <span className="legend-item"><i className="legend-dot kind-crisis" /> Crisis</span>
      </div>

      <div className="world-map-wrap" ref={wrapperRef}>
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="world-map-svg"
          role="img"
          aria-label={`World map for ${preset.title}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
            setTooltip(null);
          }}
        >
          <defs>
            <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={preset.mapPalette.oceanTop} />
              <stop offset="100%" stopColor={preset.mapPalette.oceanBottom} />
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
          </defs>

          <rect x="0" y="0" width="100" height="50" fill="url(#oceanGradient)" />
          <rect x="0" y="0" width="100" height="50" filter="url(#oceanTexture)" />
          <rect x="0" y="0" width="100" height="50" fill="url(#oceanBloom)" opacity="0.24" />

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

          {FEATURES.map((feature) => {
            const country = countriesById.get(feature.countryId);
            const isSelected = selectedCountryId === feature.countryId;
            const isImpacted = highlightedSet.has(feature.countryId);

            return (
              <path
                key={feature.id}
                d={feature.path}
                fill={country ? countryFill(country, preset) : "#b6d0dc"}
                stroke={isSelected ? "#fffdf4" : preset.mapPalette.landStroke}
                strokeWidth={isSelected ? 0.34 : 0.16}
                className={`country-shape${country ? " active" : ""}${isSelected ? " is-selected" : ""}${isImpacted ? " has-impact" : ""}`}
                onClick={() => {
                  if (!country) return;
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
                    subtitle: `${country.descriptor} | Power ${country.power} | Army ${country.army} | Industry ${country.industry}`
                  });
                }}
              >
                <title>
                  {country
                    ? `${country.name} | ${country.descriptor} | Power ${country.power} | Army ${country.army} | Industry ${country.industry} | Fort ${country.fortification}`
                    : feature.name}
                </title>
              </path>
            );
          })}

          {labelFeatures.map(({ feature, country }) => {
            const fontSize = Math.max(0.66, Math.min(1.8, feature.bbox.width * 0.08));
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
        </svg>
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
