import type { CountryState, MapArtifact, MapArtifactKind, MapEffect, MapEffectKind } from "@genesis/shared";
import type { FeatureCollection, Geometry, Point, Position } from "geojson";
import { STRATEGIC_CITIES } from "../../assets/strategicCities";
import type { GeoFeatureCollection } from "../map/types";
import type { CountryFeatureProperties, CountryGeometry, PointFeatureProperties } from "./maplibreTypes";
import type { OverlayMode } from "../map/MapChrome";

const COUNTRY_ALIASES: Record<string, string> = {
  "bosnia and herzegovina": "bosnia and herz",
  "czechia": "czech republic",
  "czech rep": "czech republic",
  "macedonia": "north macedonia",
  "republic of congo": "republic of the congo",
  "republic of the congo": "democratic republic of the congo",
  "united kingdom of great britain and northern ireland": "united kingdom",
  "united states of america": "united states"
};

const POLITICAL_COLORS = [
  "#2b8ac6",
  "#7eaa2f",
  "#c9843a",
  "#8a65b8",
  "#d0524b",
  "#4f9c76",
  "#d6bc3c",
  "#4da6a8",
  "#b26f58",
  "#6d89c9",
  "#8f7a48",
  "#56a053",
  "#ba5f83",
  "#6c7f95"
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

function resolveCountryId(rawValue: string | undefined): string {
  const normalized = normalize(rawValue ?? "");
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function hash(value: string): number {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0;
  }
  return output;
}

function countryColor(countryId: string): string {
  return POLITICAL_COLORS[hash(countryId) % POLITICAL_COLORS.length] ?? POLITICAL_COLORS[0];
}

function coordinatesFromGeometry(geometry: Geometry): Position[] {
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function bboxFromCoordinates(coordinates: Position[]): [number, number, number, number] {
  if (coordinates.length === 0) return [-12, 35, 42, 62];

  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLon, minLat, maxLon, maxLat];
}

function centroidFromBbox([minLon, minLat, maxLon, maxLat]: [number, number, number, number]): Position {
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function effectColor(kind: MapEffectKind): string {
  if (kind === "army") return "#ff6b6b";
  if (kind === "fortification") return "#a78bfa";
  if (kind === "industry") return "#f6c453";
  if (kind === "stability") return "#65d48a";
  if (kind === "diplomacy") return "#70c7ff";
  return "#ff8b3d";
}

function artifactColor(kind: MapArtifactKind): string {
  if (kind === "unit") return "#ff7a4f";
  if (kind === "fort") return "#a78bfa";
  return "#f6c453";
}

function artifactSymbol(kind: MapArtifactKind): string {
  if (kind === "unit") return "▲";
  if (kind === "fort") return "◆";
  return "■";
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function buildCountryGeometries(geoData: GeoFeatureCollection): Map<string, CountryGeometry> {
  const geometries = new Map<string, CountryGeometry>();

  for (const sourceFeature of geoData.features) {
    const name = String(sourceFeature.properties.name ?? sourceFeature.properties.admin ?? "Unknown");
    const countryId = resolveCountryId(name);
    if (!countryId) continue;

    const geometry = sourceFeature.geometry as unknown as Geometry;
    const bbox = bboxFromCoordinates(coordinatesFromGeometry(geometry));
    geometries.set(countryId, {
      id: countryId,
      name,
      geometry,
      bbox,
      centroid: centroidFromBbox(bbox)
    });
  }

  return geometries;
}

export function makeCountryCollection(
  countries: CountryState[],
  geometries: Map<string, CountryGeometry>,
  selectedCountryId: string | null,
  highlightedCountryIds: string[],
  focusCountryIds: string[]
): FeatureCollection<Geometry, CountryFeatureProperties> {
  const highlighted = new Set(highlightedCountryIds);
  const focused = new Set(focusCountryIds);

  return {
    type: "FeatureCollection",
    features: countries
      .map((country) => {
        const geometry = geometries.get(country.id);
        if (!geometry) return null;

        return {
          type: "Feature" as const,
          id: country.id,
          properties: {
            countryId: country.id,
            name: country.name,
            fillColor: countryColor(country.id),
            selected: country.id === selectedCountryId,
            highlighted: highlighted.has(country.id),
            focused: focused.has(country.id),
            power: country.power,
            stability: country.stability,
            tension: country.tension,
            army: country.army,
            industry: country.industry,
            descriptor: country.descriptor,
            labelSize: Math.max(13, Math.min(36, 10 + Math.sqrt(Math.max(country.power, 12)) * 2.5)),
            labelRank: 1000 - country.power
          },
          geometry: geometry.geometry
        };
      })
      .filter(isNotNull)
  };
}

export function makeCountryLabelCollection(
  countries: CountryState[],
  geometries: Map<string, CountryGeometry>
): FeatureCollection<Point, CountryFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: countries
      .map((country) => {
        const geometry = geometries.get(country.id);
        if (!geometry) return null;
        return {
          type: "Feature" as const,
          id: `label-${country.id}`,
          properties: {
            countryId: country.id,
            name: country.name.toUpperCase(),
            fillColor: countryColor(country.id),
            selected: false,
            highlighted: false,
            focused: false,
            power: country.power,
            stability: country.stability,
            tension: country.tension,
            army: country.army,
            industry: country.industry,
            descriptor: country.descriptor,
            labelSize: Math.max(14, Math.min(42, 11 + Math.sqrt(Math.max(country.power, 12)) * 2.8)),
            labelRank: 1000 - country.power
          },
          geometry: {
            type: "Point" as const,
            coordinates: geometry.centroid
          }
        };
      })
      .filter(isNotNull)
  };
}

export function makeCitiesCollection(countriesById: Map<string, CountryState>): FeatureCollection<Point, PointFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: STRATEGIC_CITIES
      .filter((city) => countriesById.has(city.countryId))
      .map((city) => ({
        type: "Feature" as const,
        id: city.id,
        properties: {
          id: city.id,
          kind: city.tier,
          countryId: city.countryId,
          label: city.name,
          intensity: city.tier === "capital" ? 1 : 0.65,
          color: city.tier === "capital" ? "#f7f9ff" : "#bdc7db",
          symbol: city.tier === "capital" ? "☆" : "□",
          labelSize: city.tier === "capital" ? 13 : 11,
          sort: city.tier === "capital" ? 1 : 2
        },
        geometry: {
          type: "Point" as const,
          coordinates: [city.lon, city.lat]
        }
      }))
  };
}

export function makeEffectCollection(
  mapEffects: MapEffect[],
  geometries: Map<string, CountryGeometry>,
  overlayMode: OverlayMode
): FeatureCollection<Point, PointFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: mapEffects
      .filter((effect) => {
        if (overlayMode === "balanced") return true;
        if (overlayMode === "tension") return effect.kind === "crisis" || effect.kind === "stability" || effect.kind === "diplomacy";
        if (overlayMode === "army") return effect.kind === "army";
        if (overlayMode === "fortification") return effect.kind === "fortification";
        return effect.kind === "industry";
      })
      .map((effect, index) => {
        const geometry = geometries.get(effect.countryId);
        if (!geometry) return null;
        const [lon, lat] = geometry.centroid;
        const angle = (hash(`${effect.id}:${effect.kind}`) % 360) * (Math.PI / 180);
        const radius = 0.28 + (index % 4) * 0.1;
        return {
          type: "Feature" as const,
          id: effect.id,
          properties: {
            id: effect.id,
            kind: effect.kind,
            countryId: effect.countryId,
            label: effect.label,
            intensity: Math.max(1, effect.intensity),
            color: effectColor(effect.kind),
            symbol: effect.kind === "army" ? "▲" : effect.kind === "fortification" ? "◆" : "●",
            labelSize: 11,
            sort: 100 - effect.intensity
          },
          geometry: {
            type: "Point" as const,
            coordinates: [lon + Math.cos(angle) * radius, lat + Math.sin(angle) * radius]
          }
        };
      })
      .filter(isNotNull)
  };
}

export function makeArtifactCollection(
  mapArtifacts: MapArtifact[],
  geometries: Map<string, CountryGeometry>,
  overlayMode: OverlayMode
): FeatureCollection<Point, PointFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: mapArtifacts
      .filter((artifact) => {
        if (overlayMode === "balanced" || overlayMode === "tension") return true;
        if (overlayMode === "army") return artifact.kind === "unit";
        if (overlayMode === "fortification") return artifact.kind === "fort";
        return artifact.kind === "industry_site";
      })
      .map((artifact, index) => {
        const geometry = geometries.get(artifact.countryId);
        if (!geometry) return null;
        const [lon, lat] = geometry.centroid;
        const angle = (hash(artifact.id) % 360) * (Math.PI / 180);
        const radius = 0.5 + (index % 5) * 0.09;
        return {
          type: "Feature" as const,
          id: artifact.id,
          properties: {
            id: artifact.id,
            kind: artifact.kind,
            countryId: artifact.countryId,
            label: artifact.label,
            intensity: Math.max(1, artifact.strength),
            color: artifactColor(artifact.kind),
            symbol: artifactSymbol(artifact.kind),
            labelSize: 11,
            sort: 100 - artifact.strength
          },
          geometry: {
            type: "Point" as const,
            coordinates: [lon + Math.cos(angle) * radius, lat + Math.sin(angle) * radius]
          }
        };
      })
      .filter(isNotNull)
  };
}
