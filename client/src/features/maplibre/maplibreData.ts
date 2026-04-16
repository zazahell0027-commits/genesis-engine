import type { CountryState, MapArtifact, MapArtifactKind, MapEffect, MapEffectKind } from "@genesis/shared";
import type { FeatureCollection, Geometry, Point, Position } from "geojson";
import { STRATEGIC_CITIES } from "../../assets/strategicCities";
import type { GeoFeatureCollection } from "../map/types";
import type { CountryFeatureProperties, CountryGeometry, PointFeatureProperties } from "./maplibreTypes";
import type { OverlayMode } from "../map/MapChrome";
import type { UiLocale } from "../../i18n";
import { translateCountryName } from "../../i18n";

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

const COMPACT_WIDE_COUNTRIES = new Set([
  "france",
  "united kingdom",
  "ireland",
  "belgium",
  "netherlands",
  "denmark",
  "switzerland",
  "czech republic",
  "austria",
  "slovakia",
  "hungary",
  "croatia",
  "serbia",
  "bosnia and herz",
  "montenegro",
  "albania",
  "greece",
  "italy",
  "japan"
]);

const ELONGATED_COUNTRIES = new Set([
  "sweden",
  "norway",
  "finland",
  "turkey",
  "chile",
  "ukraine",
  "portugal"
]);

const ARCHIPELAGO_COUNTRIES = new Set([
  "japan",
  "new zealand",
  "indonesia",
  "philippines",
  "united kingdom",
  "france"
]);

type LabelProfile = {
  compactWide: boolean;
  elongated: boolean;
  archipelago: boolean;
  baseAngleDeg: number;
  spanScale: number;
  minSpan: number;
  maxSpan: number;
  curveFactor: number;
  minSize: number;
  maxSize: number;
  sizeScale: number;
};

function getLabelProfile(countryId: string): LabelProfile {
  const compactWide = COMPACT_WIDE_COUNTRIES.has(countryId);
  const elongated = ELONGATED_COUNTRIES.has(countryId);
  const archipelago = ARCHIPELAGO_COUNTRIES.has(countryId);

  if (compactWide) {
    return {
      compactWide,
      elongated,
      archipelago,
      baseAngleDeg: -12,
      spanScale: 0.78,
      minSpan: 8.5,
      maxSpan: 30,
      curveFactor: 0.006,
      minSize: 11.4,
      maxSize: 34,
      sizeScale: 3.5
    };
  }

  if (elongated) {
    return {
      compactWide,
      elongated,
      archipelago,
      baseAngleDeg: -18,
      spanScale: 0.7,
      minSpan: 10,
      maxSpan: 32,
      curveFactor: 0.01,
      minSize: 11.8,
      maxSize: 40,
      sizeScale: 4.1
    };
  }

  if (archipelago) {
    return {
      compactWide,
      elongated,
      archipelago,
      baseAngleDeg: -10,
      spanScale: 0.74,
      minSpan: 8.5,
      maxSpan: 28,
      curveFactor: 0.007,
      minSize: 11.2,
      maxSize: 36,
      sizeScale: 3.7
    };
  }

  return {
    compactWide,
    elongated,
    archipelago,
    baseAngleDeg: -14,
    spanScale: 0.76,
    minSpan: 9,
    maxSpan: 30,
    curveFactor: 0.008,
    minSize: 11.2,
    maxSize: 38,
    sizeScale: 3.95
  };
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

function ringArea(ring: Position[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function dominantCoordinatesFromGeometry(geometry: Geometry): Position[] {
  if (geometry.type === "Polygon") return geometry.coordinates[0] ?? [];
  if (geometry.type === "MultiPolygon") {
    let bestRing: Position[] = [];
    let bestArea = 0;
    for (const polygon of geometry.coordinates) {
      const outerRing = polygon[0] ?? [];
      const area = ringArea(outerRing);
      if (area > bestArea) {
        bestArea = area;
        bestRing = outerRing;
      }
    }
    return bestRing;
  }
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

function centroidFromRing(ring: Position[]): Position {
  if (ring.length < 3) return centroidFromBbox(bboxFromCoordinates(ring));

  let areaTwice = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    areaTwice += cross;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  if (Math.abs(areaTwice) < 1e-6) {
    return centroidFromBbox(bboxFromCoordinates(ring));
  }

  const factor = 1 / (3 * areaTwice);
  return [centroidX * factor, centroidY * factor];
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
    const dominantCoordinates = dominantCoordinatesFromGeometry(geometry);
    const bbox = bboxFromCoordinates(dominantCoordinates.length > 0 ? dominantCoordinates : coordinatesFromGeometry(geometry));
    const centroid = dominantCoordinates.length > 0 ? centroidFromRing(dominantCoordinates) : centroidFromBbox(bbox);
    geometries.set(countryId, {
      id: countryId,
      name,
      geometry,
      bbox,
      centroid
    });
  }

  return geometries;
}

export function makeCountryCollection(
  countries: CountryState[],
  geometries: Map<string, CountryGeometry>,
  selectedCountryId: string | null,
  knownCountryIds: Set<string>,
  highlightedCountryIds: string[],
  focusCountryIds: string[],
  locale: UiLocale
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
            name: translateCountryName(country.name, locale).toUpperCase(),
            fillColor: countryColor(country.id),
            discovered: knownCountryIds.has(country.id),
            selected: country.id === selectedCountryId,
            highlighted: highlighted.has(country.id),
            focused: focused.has(country.id),
            power: country.power,
            stability: country.stability,
            tension: country.tension,
            army: country.army,
            industry: country.industry,
            descriptor: country.descriptor,
            labelSize: Math.max(11, Math.min(34, 7.5 + Math.sqrt(Math.max((geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1]), 1)) * 3.2)),
            labelRank: Math.round(-((geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1])) * 1000)
          },
          geometry: geometry.geometry
        };
      })
      .filter(isNotNull)
  };
}

function buildLabelLine(geometry: CountryGeometry, countryId: string): { type: "LineString"; coordinates: Position[] } {
  const profile = getLabelProfile(countryId);
  const [minLon, minLat, maxLon, maxLat] = geometry.bbox;
  const width = Math.max(0.8, maxLon - minLon);
  const height = Math.max(0.6, maxLat - minLat);
  const bboxCenter = centroidFromBbox(geometry.bbox);
  const opticalCenterX = geometry.centroid[0] * 0.78 + bboxCenter[0] * 0.22;
  const opticalCenterY = geometry.centroid[1] * 0.78 + bboxCenter[1] * 0.22;
  const angleRad = profile.baseAngleDeg * (Math.PI / 180);
  const ux = Math.cos(angleRad);
  const uy = Math.sin(angleRad);
  const nx = -uy;
  const ny = ux;
  const footprint = Math.sqrt(width * height);
  const stretch = Math.max(
    profile.minSpan,
    Math.min(profile.maxSpan, 6 + footprint * profile.spanScale)
  );
  const curveAmplitude = Math.min(footprint * profile.curveFactor, stretch * 0.08);
  const pointsCount = 4;

  return {
    type: "LineString",
    coordinates: Array.from({ length: pointsCount }, (_, index) => {
      const t = index / (pointsCount - 1);
      const major = (-stretch / 2) + stretch * t;
      const bend = (t - 0.5) * (t - 0.5) * 4 - 1;
      const curve = bend * curveAmplitude;
      return [
        opticalCenterX + ux * major + nx * curve,
        opticalCenterY + uy * major + ny * curve
      ];
    })
  };
}

export function makeCountryLabelCollection(
  countries: CountryState[],
  geometries: Map<string, CountryGeometry>,
  knownCountryIds: Set<string>,
  locale: UiLocale
): FeatureCollection<Geometry, CountryFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: countries
      .map((country) => {
        const geometry = geometries.get(country.id);
        if (!geometry) return null;
        const profile = getLabelProfile(country.id);
        return {
          type: "Feature" as const,
          id: `label-${country.id}`,
          properties: {
            countryId: country.id,
            name: translateCountryName(country.name, locale).toUpperCase(),
            fillColor: countryColor(country.id),
            discovered: knownCountryIds.has(country.id),
            selected: false,
            highlighted: false,
            focused: false,
            power: country.power,
            stability: country.stability,
            tension: country.tension,
            army: country.army,
            industry: country.industry,
            descriptor: country.descriptor,
            labelSize: Math.max(
              profile.minSize,
              Math.min(
                profile.maxSize,
                7.6 + Math.sqrt(Math.max((geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1]), 1)) * profile.sizeScale
              )
            ),
            labelRank: Math.round(-((geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1])) * 1000)
          },
          geometry: {
            ...buildLabelLine(geometry, country.id)
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
