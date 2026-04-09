import React, { useMemo } from "react";
import type { GameState } from "@genesis/shared";
import rawWorldGeo from "../assets/world_countries_slim.json";

type MapLens = "bloc" | "tension" | "stability";

type Props = {
  game: GameState;
  lens: MapLens;
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
};

const geoData = rawWorldGeo as GeoFeatureCollection;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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

const blocColors: Record<string, string> = {
  "Atlantic Accord": "#2563eb",
  "Eurasian Compact": "#0f766e",
  "Pacific Forum": "#be123c",
  "Southern League": "#7c3aed",
  "Non-Aligned Assembly": "#b45309"
};

export function WorldGeoMap({ game, lens, selectedCountryId, onSelectCountry }: Props): React.JSX.Element {
  const countriesById = useMemo(() => {
    return new Map(game.countries.map((country) => [country.id, country]));
  }, [game.countries]);

  const features = useMemo(() => {
    return geoData.features
      .map((feature, index) => {
        const rings = toRings(feature.geometry);
        if (rings.length === 0) return null;

        const name = String(feature.properties.name ?? feature.properties.admin ?? "Unknown");
        return {
          id: index,
          countryId: normalize(name),
          name,
          path: ringsPath(rings)
        } as Feature;
      })
      .filter((item): item is Feature => Boolean(item));
  }, []);

  return (
    <div className="world-map-wrap">
      <svg viewBox="0 0 100 50" className="world-map-svg" role="img" aria-label="Strategic world map">
        <defs>
          <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f2747" />
            <stop offset="100%" stopColor="#091a31" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="50" fill="url(#oceanGradient)" />

        {features.map((feature) => {
          const country = countriesById.get(feature.countryId);
          const isSelected = selectedCountryId === feature.countryId;

          let fill = "#27364f";
          if (country) {
            if (lens === "bloc") {
              fill = blocColors[country.bloc] ?? "#475569";
            } else if (lens === "tension") {
              fill = interpolateColor(country.tension, "#14532d", "#b91c1c");
            } else {
              fill = interpolateColor(country.stability, "#b91c1c", "#15803d");
            }
          }

          const stroke = isSelected ? "#f8fafc" : "#0b1220";
          const strokeWidth = isSelected ? 0.38 : 0.18;

          return (
            <path
              key={feature.id}
              d={feature.path}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              className={`country-shape${country ? " active" : ""}`}
              onClick={() => {
                if (!country) return;
                onSelectCountry(country.id);
              }}
            >
              <title>
                {country
                  ? `${country.name} | ${country.bloc} | W${country.wealth} S${country.stability} T${country.tension}`
                  : feature.name}
              </title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}
