import React, { useMemo } from "react";
import type { World, WorldCell } from "@genesis/shared";
import rawWorldGeo from "../assets/world_countries_slim.json";

type MapLens = "control" | "tension" | "stability";

type Props = {
  world: World;
  mapLens: MapLens;
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  getOwnerColor: (ownerId: string) => string;
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
    continent?: string;
  };
  geometry: GeoGeometry;
};

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeatureSource[];
};

type Feature = {
  id: number;
  name: string;
  continent: string;
  path: string;
  centerX: number;
  centerY: number;
  centerLon: number;
  centerLat: number;
  area: number;
};

type StyledFeature = Feature & {
  cells: WorldCell[];
  fill: string;
  stroke: string;
  strokeWidth: number;
};

const geoData = rawWorldGeo as GeoFeatureCollection;

function normalizeContinent(name: string): string {
  const map: Record<string, string> = {
    "North america": "North America",
    "South america": "South America"
  };
  return map[name] ?? name;
}

function project(lon: number, lat: number): { x: number; y: number } {
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 50 };
}

function toRings(geometry: GeoGeometry): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates as number[][][];
  return (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
}

function ringsPath(rings: number[][][]): string {
  return rings
    .map((ring) => {
      if (ring.length === 0) return "";
      const [flon, flat] = ring[0];
      const first = project(flon, flat);
      const commands = [`M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`];
      for (let i = 1; i < ring.length; i += 1) {
        const [lon, lat] = ring[i];
        const p = project(lon, lat);
        commands.push(`L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
      }
      commands.push("Z");
      return commands.join(" ");
    })
    .join(" ");
}

function centerFromRings(rings: number[][][]): { lon: number; lat: number; area: number } {
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
      count += 1;
      const p = project(lon, lat);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (count === 0) return { lon: 0, lat: 0, area: 0 };
  return {
    lon: sumLon / count,
    lat: sumLat / count,
    area: Math.max(0, (maxX - minX) * (maxY - minY))
  };
}

function cellLonLat(world: World, cell: WorldCell): { lon: number; lat: number } {
  const lon = world.width <= 1 ? 0 : (cell.x / (world.width - 1)) * 360 - 180;
  const lat = world.height <= 1 ? 0 : 90 - (cell.y / (world.height - 1)) * 180;
  return { lon, lat };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function interpolateColor(value: number, low: string, high: string): string {
  const t = Math.max(0, Math.min(100, value)) / 100;
  const parse = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(low);
  const [r2, g2, b2] = parse(high);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function dominantOwner(cells: WorldCell[]): string | null {
  if (cells.length === 0) return null;
  const byOwner = new Map<string, number>();
  for (const cell of cells) byOwner.set(cell.owner, (byOwner.get(cell.owner) ?? 0) + 1);
  return [...byOwner.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function WorldGeoMap(props: Props): React.JSX.Element {
  const { world, mapLens, selectedCellId, onSelectCell, getOwnerColor } = props;

  const features = useMemo(() => {
    return geoData.features
      .map((feature, id) => {
        const rings = toRings(feature.geometry);
        if (rings.length === 0) return null;
        const center = centerFromRings(rings);
        const projected = project(center.lon, center.lat);
        const continent = normalizeContinent(String(feature.properties.continent ?? "Unknown"));
        if (continent === "Antarctica") return null;
        return {
          id,
          name: String(feature.properties.name ?? feature.properties.admin ?? "Unknown"),
          continent,
          path: ringsPath(rings),
          centerX: projected.x,
          centerY: projected.y,
          centerLon: center.lon,
          centerLat: center.lat,
          area: center.area
        } as Feature;
      })
      .filter((f): f is Feature => Boolean(f));
  }, []);

  const computed = useMemo(() => {
    const byContinent = new Map<string, Feature[]>();
    for (const feature of features) {
      const list = byContinent.get(feature.continent) ?? [];
      list.push(feature);
      byContinent.set(feature.continent, list);
    }

    const featureToCells = new Map<number, WorldCell[]>();
    const cellToFeature = new Map<string, number>();

    for (const cell of world.cells) {
      const continent = normalizeContinent(cell.continent);
      const candidates = byContinent.get(continent) ?? features;
      const origin = cellLonLat(world, cell);

      let best = candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        let score = (origin.lon - candidate.centerLon) ** 2 + (origin.lat - candidate.centerLat) ** 2 * 1.35;
        const cname = candidate.name.toLowerCase();
        const tname = cell.country.toLowerCase();
        if (cname.includes(tname) || tname.includes(cname)) score -= 20;
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
        }
      }

      const bucket = featureToCells.get(best.id) ?? [];
      bucket.push(cell);
      featureToCells.set(best.id, bucket);
      cellToFeature.set(cell.id, best.id);
    }

    const styled: StyledFeature[] = features.map((feature) => {
      const cells = featureToCells.get(feature.id) ?? [];
      const owner = dominantOwner(cells);
      const tension = avg(cells.map((cell) => cell.tension));
      const stability = avg(cells.map((cell) => cell.stability));

      let fill = "#2b4265";
      if (cells.length > 0) {
        if (mapLens === "control") fill = owner ? `${getOwnerColor(owner)}A8` : "#41638f";
        else if (mapLens === "tension") fill = interpolateColor(tension, "#2c7c47", "#cb2f35");
        else fill = interpolateColor(stability, "#cb2f35", "#2e9154");
      }

      const stroke = cells.length === 0 ? "#0e1b2d" : tension > 65 ? "#f26b68" : stability < 40 ? "#f4a327" : "#11243f";
      return { ...feature, cells, fill, stroke, strokeWidth: cells.length > 0 ? 0.2 : 0.12 };
    });

    const labels = styled
      .filter((feature) => feature.cells.length > 0 || feature.area > 24)
      .sort((a, b) => (b.cells.length - a.cells.length) || (b.area - a.area))
      .slice(0, 18);

    return { styled, labels, featureToCells, cellToFeature };
  }, [features, getOwnerColor, mapLens, world]);

  const selectedFeatureId = selectedCellId ? computed.cellToFeature.get(selectedCellId) ?? null : null;
  const selectedFeature = selectedFeatureId !== null ? computed.styled.find((f) => f.id === selectedFeatureId) ?? null : null;

  return (
    <div className="world-map-wrap">
      <svg viewBox="0 0 100 50" className="world-map-svg" role="img" aria-label="Carte monde stratégique">
        <defs>
          <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#173b6d" />
            <stop offset="55%" stopColor="#10325e" />
            <stop offset="100%" stopColor="#0a203d" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="50" fill="url(#oceanGradient)" />

        {computed.styled.map((feature) => (
          <path
            key={feature.id}
            d={feature.path}
            fill={feature.fill}
            stroke={selectedFeatureId === feature.id ? "#f8fafc" : feature.stroke}
            strokeWidth={selectedFeatureId === feature.id ? 0.36 : feature.strokeWidth}
            className={`country-shape${feature.cells.length > 0 ? " active" : ""}`}
            onClick={() => {
              const cells = computed.featureToCells.get(feature.id) ?? [];
              if (cells.length === 0) return;
              const current = selectedCellId ? cells.find((cell) => cell.id === selectedCellId) : undefined;
              if (current) onSelectCell(current.id);
              else onSelectCell([...cells].sort((a, b) => b.tension - a.tension || b.richness - a.richness)[0].id);
            }}
          >
            <title>{feature.name} | {feature.continent} | {feature.cells.length} territoires liés</title>
          </path>
        ))}

        {selectedFeature && (
          <circle cx={selectedFeature.centerX} cy={selectedFeature.centerY} r="0.65" className="feature-marker" />
        )}

        {computed.labels.map((label) => (
          <text
            key={`label-${label.id}`}
            x={label.centerX}
            y={label.centerY}
            className="country-label"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label.name.length > 14 ? `${label.name.slice(0, 12)}…` : label.name}
          </text>
        ))}
      </svg>
    </div>
  );
}
