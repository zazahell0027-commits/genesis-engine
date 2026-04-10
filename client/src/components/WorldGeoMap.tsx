import React, { useRef, useState } from "react";
import type { CountryState, PresetSummary } from "@genesis/shared";
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

const geoData = rawWorldGeo as GeoFeatureCollection;
const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, width: 100, height: 50 };
const PASTEL_PALETTE = [
  "#cda28c",
  "#b7c992",
  "#ead772",
  "#ceb48a",
  "#c8afe0",
  "#d9a690",
  "#d5de8a",
  "#b4d2da",
  "#caa777",
  "#a9c29a",
  "#d2b59d",
  "#c7d89e"
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
  const base = PASTEL_PALETTE[hash(`${preset.id}:${country.id}`) % PASTEL_PALETTE.length] ?? "#c7d2fe";
  const volatility = Math.round((country.tension - 50) / 11);
  return tint(base, volatility);
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

export function WorldGeoMap({ countries, preset, selectedCountryId, onSelectCountry }: Props): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; viewBox: ViewBox } | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const countriesById = new Map(countries.map((country) => [country.id, country]));
  const selectedCountry = selectedCountryId ? countriesById.get(selectedCountryId) ?? null : null;
  const labelFeatures = FEATURES
    .map((feature) => ({ feature, country: countriesById.get(feature.countryId) }))
    .filter((item): item is { feature: Feature; country: CountryState } => Boolean(item.country))
    .sort((a, b) => b.country.power - a.country.power)
    .filter((item) => item.feature.bbox.width > 3.9 && item.feature.bbox.height > 1.2)
    .slice(0, 10);

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

          {FEATURES.map((feature) => {
            const country = countriesById.get(feature.countryId);
            const isSelected = selectedCountryId === feature.countryId;

            return (
              <path
                key={feature.id}
                d={feature.path}
                fill={country ? countryFill(country, preset) : "#b6d0dc"}
                stroke={isSelected ? "#fffdf4" : preset.mapPalette.landStroke}
                strokeWidth={isSelected ? 0.32 : 0.16}
                className={`country-shape${country ? " active" : ""}${isSelected ? " is-selected" : ""}`}
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
                    subtitle: `${country.descriptor} • Power ${country.power} • Tension ${country.tension}`
                  });
                }}
              >
                <title>
                  {country
                    ? `${country.name} | ${country.descriptor} | Power ${country.power} | Stability ${country.stability}`
                    : feature.name}
                </title>
              </path>
            );
          })}

          {labelFeatures.map(({ feature, country }) => {
            const fontSize = Math.max(0.78, Math.min(2.3, feature.bbox.width * 0.11));
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
