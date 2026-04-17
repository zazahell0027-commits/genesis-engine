import type { CountryState, MapArtifact, MapArtifactKind, MapEffect, MapEffectKind } from "@genesis/shared";
import type { FeatureCollection, Geometry, Point, Position } from "geojson";
import polylabel from "polylabel";
import { STRATEGIC_CITIES } from "../../assets/strategicCities";
import type { GeoFeatureCollection } from "../map/types";
import type { ZoomBand } from "../map/pipeline";
import {
  COUNTRY_LABEL_AREA_HIDE,
  COUNTRY_LABEL_MAX_FONT_PX,
  COUNTRY_LABEL_MIN_FONT_PX,
  computeCountryLabelFontSize,
  computeCountryLabelOpacity,
  computeCountryLabelPriority,
  generateCountryLabelOffsets,
  selectCountryLabels
} from "../map/countryLabelPlanner";
import type { PointLike } from "../map/labelCollision";
import { measureLabelBounds } from "../map/labelCollision";
import type { CountryFeatureProperties, CountryGeometry, PointFeatureProperties } from "./maplibreTypes";
import type { MapViewport } from "./maplibreTypes";
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
  minSize: number;
  maxSize: number;
  sizeScale: number;
};

type LabelGeometryMetrics = {
  anchor: Position;
  labelRotate: number;
  majorSpan: number;
  minorSpan: number;
  availableSpan: number;
};

type CountryLabelMetrics = LabelGeometryMetrics & {
  labelSize: number;
  labelTracking: number;
};

const LABEL_SPAN_TO_SIZE = 11.4;
const LABEL_WIDTH_PER_CHARACTER = 0.57;
const LABEL_WIDTH_PER_SPACE = 0.28;
const LABEL_HEIGHT_UNITS = 1.02;

function getLabelProfile(countryId: string): LabelProfile {
  const compactWide = COMPACT_WIDE_COUNTRIES.has(countryId);
  const elongated = ELONGATED_COUNTRIES.has(countryId);
  const archipelago = ARCHIPELAGO_COUNTRIES.has(countryId);

  if (compactWide) {
    return {
      compactWide,
      elongated,
      archipelago,
      minSize: 5.6,
      maxSize: 36,
      sizeScale: 3.8
    };
  }

  if (elongated) {
    return {
      compactWide,
      elongated,
      archipelago,
      minSize: 5.1,
      maxSize: 42,
      sizeScale: 4.35
    };
  }

  if (archipelago) {
    return {
      compactWide,
      elongated,
      archipelago,
      minSize: 4.8,
      maxSize: 38,
      sizeScale: 3.95
    };
  }

  return {
    compactWide,
    elongated,
    archipelago,
    minSize: 5.4,
    maxSize: 40,
    sizeScale: 4.05
  };
}

function labelTrackingFromProfile(profile: LabelProfile, labelName: string, footprint: number): number {
  const compactBase = profile.compactWide ? 0.172 : 0;
  const elongatedBase = profile.elongated ? 0.184 : 0;
  const archipelagoBase = profile.archipelago ? 0.124 : 0;
  const defaultBase = !(profile.compactWide || profile.elongated || profile.archipelago) ? 0.164 : 0;
  const base = compactBase || elongatedBase || archipelagoBase || defaultBase;
  const trimmedLength = Math.max(6, labelName.replace(/\s+/g, "").length);
  const footprintBoost = Math.max(-0.004, Math.min(0.048, (footprint - 6.8) * 0.0048));
  const lengthTightening = Math.max(0, Math.min(0.028, (trimmedLength - 8) * 0.0024));
  return Math.max(0.11, Math.min(0.28, base + footprintBoost - lengthTightening));
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

function dominantPolygonRingsFromGeometry(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Position[][];
  if (geometry.type === "MultiPolygon") {
    let bestPolygon: Position[][] = [];
    let bestArea = 0;
    for (const polygon of geometry.coordinates) {
      const outerRing = polygon[0] ?? [];
      const area = ringArea(outerRing);
      if (area > bestArea) {
        bestArea = area;
        bestPolygon = polygon as Position[][];
      }
    }
    return bestPolygon;
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

function distanceSquaredToSegment(point: Position, start: Position, end: Position): number {
  const [px, py] = point;
  const [sx, sy] = start;
  const [ex, ey] = end;
  const dx = ex - sx;
  const dy = ey - sy;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    const offX = px - sx;
    const offY = py - sy;
    return offX * offX + offY * offY;
  }

  const rawT = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, rawT));
  const projectedX = sx + dx * t;
  const projectedY = sy + dy * t;
  const offX = px - projectedX;
  const offY = py - projectedY;
  return offX * offX + offY * offY;
}

function distanceToRing(point: Position, ring: Position[]): number {
  if (ring.length < 2) return 0;
  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    minDistance = Math.min(minDistance, distanceSquaredToSegment(point, start, end));
  }
  return Math.sqrt(minDistance);
}

function intersectLineWithSegment(
  anchor: Position,
  axis: Position,
  start: Position,
  end: Position
): number | null {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  const denominator = crossProduct(axis[0], axis[1], segmentX, segmentY);
  if (Math.abs(denominator) < 1e-9) return null;

  const relX = start[0] - anchor[0];
  const relY = start[1] - anchor[1];
  const t = crossProduct(relX, relY, segmentX, segmentY) / denominator;
  const u = crossProduct(relX, relY, axis[0], axis[1]) / denominator;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}

function interiorSpanAlongAxis(ring: Position[], anchor: Position, angleDegrees: number): number {
  if (ring.length < 3) return 0;

  const angleRad = angleDegrees * (Math.PI / 180);
  const axis: Position = [Math.cos(angleRad), Math.sin(angleRad)];
  const intersections: number[] = [];

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const t = intersectLineWithSegment(anchor, axis, start, end);
    if (t === null) continue;
    intersections.push(t);
  }

  if (intersections.length < 2) return 0;

  intersections.sort((left, right) => left - right);
  const collapsed: number[] = [];
  for (const value of intersections) {
    if (collapsed.length > 0 && Math.abs(value - collapsed[collapsed.length - 1]) < 1e-6) {
      continue;
    }
    collapsed.push(value);
  }

  const negative = [...collapsed].filter((value) => value < -1e-6).pop();
  const positive = collapsed.find((value) => value > 1e-6);
  if (negative === undefined || positive === undefined) return 0;
  return Math.max(0, positive - negative);
}

function interiorLineEndpointsAlongAxis(
  ring: Position[],
  anchor: Position,
  angleDegrees: number
): { start: Position; end: Position; span: number } | null {
  if (ring.length < 3) return null;

  const angleRad = angleDegrees * (Math.PI / 180);
  const axis: Position = [Math.cos(angleRad), Math.sin(angleRad)];
  const intersections: number[] = [];

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const t = intersectLineWithSegment(anchor, axis, start, end);
    if (t === null) continue;
    intersections.push(t);
  }

  if (intersections.length < 2) return null;

  intersections.sort((left, right) => left - right);
  const collapsed: number[] = [];
  for (const value of intersections) {
    if (collapsed.length > 0 && Math.abs(value - collapsed[collapsed.length - 1]) < 1e-6) {
      continue;
    }
    collapsed.push(value);
  }

  const negative = [...collapsed].filter((value) => value < -1e-6).pop();
  const positive = collapsed.find((value) => value > 1e-6);
  if (negative === undefined || positive === undefined) return null;

  return {
    start: [anchor[0] + (axis[0] * negative), anchor[1] + (axis[1] * negative)],
    end: [anchor[0] + (axis[0] * positive), anchor[1] + (axis[1] * positive)],
    span: Math.max(0, positive - negative)
  };
}

function pointInRing(point: Position, ring: Position[]): boolean {
  if (ring.length < 3) return false;

  const [lon, lat] = point;
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentLon, currentLat] = ring[index];
    const [previousLon, previousLat] = ring[previous];
    const latCrosses = (currentLat > lat) !== (previousLat > lat);
    if (!latCrosses) continue;
    const slope = (previousLon - currentLon) * (lat - currentLat) / ((previousLat - currentLat) || 1e-9) + currentLon;
    if (lon < slope) inside = !inside;
  }

  return inside;
}

function findInteriorPoint(geometry: CountryGeometry): Position {
  const polygon = dominantPolygonRingsFromGeometry(geometry.geometry);
  if (polygon.length === 0) {
    return geometry.centroid;
  }

  try {
    const point = polylabel(polygon as number[][][], 0.01);
    return [point[0], point[1]];
  } catch {
    const ring = dominantCoordinatesFromGeometry(geometry.geometry);
    if (ring.length < 3) {
      return geometry.centroid;
    }

    const [minLon, minLat, maxLon, maxLat] = bboxFromCoordinates(ring);
    const ringCentroid = centroidFromRing(ring);
    const bboxCenter = centroidFromBbox([minLon, minLat, maxLon, maxLat]);
    const geometryCentroid = geometry.centroid;
    const candidates: Position[] = [
      ringCentroid,
      geometryCentroid,
      bboxCenter,
      [
        ringCentroid[0] * 0.7 + bboxCenter[0] * 0.3,
        ringCentroid[1] * 0.7 + bboxCenter[1] * 0.3
      ],
      [
        geometryCentroid[0] * 0.7 + bboxCenter[0] * 0.3,
        geometryCentroid[1] * 0.7 + bboxCenter[1] * 0.3
      ]
    ];

    let bestPoint: Position = ringCentroid;
    let bestScore = pointInRing(ringCentroid, ring) ? distanceToRing(ringCentroid, ring) : -1;

    for (const candidate of candidates) {
      if (!pointInRing(candidate, ring)) continue;
      const score = distanceToRing(candidate, ring);
      if (score > bestScore) {
        bestScore = score;
        bestPoint = candidate;
      }
    }

    const lonSteps = [0.5, 0.38, 0.62, 0.26, 0.74, 0.18, 0.82, 0.12, 0.88];
    const latSteps = [0.5, 0.38, 0.62, 0.26, 0.74, 0.18, 0.82, 0.12, 0.88];
    for (const lonStep of lonSteps) {
      for (const latStep of latSteps) {
        const candidate: Position = [
          minLon + (maxLon - minLon) * lonStep,
          minLat + (maxLat - minLat) * latStep
        ];
        if (!pointInRing(candidate, ring)) continue;
        const score = distanceToRing(candidate, ring);
        if (score > bestScore) {
          bestScore = score;
          bestPoint = candidate;
        }
      }
    }

    return bestPoint;
  }
}

function sampleRingPoints(ring: Position[]): Position[] {
  if (ring.length <= 24) return ring;
  const sampleStep = Math.max(1, Math.floor(ring.length / 72));
  const sampled = ring.filter((_, index) => index % sampleStep === 0);
  return sampled.length >= 3 ? sampled : ring;
}

function normalizeLabelRotation(angle: number): number {
  if (!Number.isFinite(angle)) return 0;

  let normalized = angle % 180;
  if (normalized > 90) normalized -= 180;
  if (normalized < -90) normalized += 180;
  return normalized;
}

function crossProduct(ax: number, ay: number, bx: number, by: number): number {
  return (ax * by) - (ay * bx);
}

function dedupePositions(points: Position[]): Position[] {
  const unique = new Map<string, Position>();
  for (const [lon, lat] of points) {
    const key = `${lon.toFixed(6)}:${lat.toFixed(6)}`;
    if (!unique.has(key)) {
      unique.set(key, [lon, lat]);
    }
  }
  return [...unique.values()];
}

function buildConvexHull(points: Position[]): Position[] {
  const ordered = dedupePositions(points).sort((left, right) => (
    left[0] === right[0] ? left[1] - right[1] : left[0] - right[0]
  ));

  if (ordered.length <= 3) {
    return ordered;
  }

  const lower: Position[] = [];
  for (const point of ordered) {
    while (lower.length >= 2) {
      const previous = lower[lower.length - 2];
      const current = lower[lower.length - 1];
      const turn = crossProduct(
        current[0] - previous[0],
        current[1] - previous[1],
        point[0] - current[0],
        point[1] - current[1]
      );
      if (turn > 0) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Position[] = [];
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const point = ordered[index];
    while (upper.length >= 2) {
      const previous = upper[upper.length - 2];
      const current = upper[upper.length - 1];
      const turn = crossProduct(
        current[0] - previous[0],
        current[1] - previous[1],
        point[0] - current[0],
        point[1] - current[1]
      );
      if (turn > 0) break;
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();

  const hull = [...lower, ...upper];
  return hull.length >= 3 ? hull : ordered;
}

type OrientedBounds = {
  labelRotate: number;
  majorSpan: number;
  minorSpan: number;
  area: number;
  availableSpan: number;
};

function evaluateOrientedBounds(ring: Position[], anchor: Position, angleDegrees: number): OrientedBounds {
  const angleRad = angleDegrees * (Math.PI / 180);
  const axisX = Math.cos(angleRad);
  const axisY = Math.sin(angleRad);
  let minMajor = Number.POSITIVE_INFINITY;
  let maxMajor = Number.NEGATIVE_INFINITY;
  let minMinor = Number.POSITIVE_INFINITY;
  let maxMinor = Number.NEGATIVE_INFINITY;

  for (const [lon, lat] of ring) {
    const major = (lon * axisX) + (lat * axisY);
    const minor = (-lon * axisY) + (lat * axisX);
    minMajor = Math.min(minMajor, major);
    maxMajor = Math.max(maxMajor, major);
    minMinor = Math.min(minMinor, minor);
    maxMinor = Math.max(maxMinor, minor);
  }

  const spanMajor = Math.max(0.8, maxMajor - minMajor);
  const spanMinor = Math.max(0.6, maxMinor - minMinor);
  const angle = normalizeLabelRotation(angleDegrees);
  const availableSpan = Math.max(0, interiorSpanAlongAxis(ring, anchor, angle));

  if (spanMinor > spanMajor) {
    return {
      labelRotate: normalizeLabelRotation(angle + 90),
      majorSpan: spanMinor,
      minorSpan: spanMajor,
      area: spanMajor * spanMinor,
      availableSpan
    };
  }

  return {
    labelRotate: angle,
    majorSpan: spanMajor,
    minorSpan: spanMinor,
    area: spanMajor * spanMinor,
    availableSpan
  };
}

function summarizeLabelGeometry(geometry: CountryGeometry, profile: LabelProfile): LabelGeometryMetrics {
  const anchor = findInteriorPoint(geometry);
  const ring = dominantCoordinatesFromGeometry(geometry.geometry);
  if (ring.length < 3) {
    const width = Math.max(0.8, geometry.bbox[2] - geometry.bbox[0]);
    const height = Math.max(0.6, geometry.bbox[3] - geometry.bbox[1]);
    return {
      anchor,
      labelRotate: 0,
      majorSpan: width,
      minorSpan: height,
      availableSpan: width
    };
  }

  if (profile.archipelago) {
    const width = Math.max(0.8, geometry.bbox[2] - geometry.bbox[0]);
    const height = Math.max(0.6, geometry.bbox[3] - geometry.bbox[1]);
    return {
      anchor,
      labelRotate: 0,
      majorSpan: width,
      minorSpan: height,
      availableSpan: width
    };
  }

  const points = sampleRingPoints(ring);
  const hull = buildConvexHull(points);
  const candidatePoints = hull.length >= 3 ? hull : points;
  const candidateAngles = new Set<number>();
  let fallbackMeanX = 0;
  let fallbackMeanY = 0;
  for (const [lon, lat] of candidatePoints) {
    fallbackMeanX += lon;
    fallbackMeanY += lat;
  }
  fallbackMeanX /= candidatePoints.length;
  fallbackMeanY /= candidatePoints.length;

  let fallbackSxx = 0;
  let fallbackSyy = 0;
  let fallbackSxy = 0;
  for (const [lon, lat] of candidatePoints) {
    const dx = lon - fallbackMeanX;
    const dy = lat - fallbackMeanY;
    fallbackSxx += dx * dx;
    fallbackSyy += dy * dy;
    fallbackSxy += dx * dy;
  }
  const fallbackAngle = 0.5 * Math.atan2(2 * fallbackSxy, fallbackSxx - fallbackSyy) * (180 / Math.PI);

  for (let index = 0; index < candidatePoints.length; index += 1) {
    const current = candidatePoints[index];
    const next = candidatePoints[(index + 1) % candidatePoints.length];
    const dx = next[0] - current[0];
    const dy = next[1] - current[1];
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
    candidateAngles.add(Math.round(normalizeLabelRotation((Math.atan2(dy, dx) * 180) / Math.PI) * 2) / 2);
  }
  candidateAngles.add(Math.round(normalizeLabelRotation(fallbackAngle) * 2) / 2);
  candidateAngles.add(0);

  let best = evaluateOrientedBounds(ring, anchor, 0);
  let bestScore = (best.availableSpan * 1_000) + (best.majorSpan * 120) - (best.minorSpan * 80);
  for (const angle of candidateAngles) {
    const evaluated = evaluateOrientedBounds(ring, anchor, angle);
    const score = (evaluated.availableSpan * 1_000) + (evaluated.majorSpan * 120) - (evaluated.minorSpan * 80);
    if (
      score > bestScore + 1e-6
      || (Math.abs(score - bestScore) <= 1e-6 && evaluated.availableSpan > best.availableSpan)
      || (Math.abs(score - bestScore) <= 1e-6 && Math.abs(evaluated.availableSpan - best.availableSpan) <= 1e-6 && evaluated.majorSpan > best.majorSpan)
    ) {
      best = evaluated;
      bestScore = score;
    }
  }

  const aspectRatio = best.majorSpan / Math.max(0.6, best.minorSpan);
  let labelRotate = best.labelRotate;
  if (aspectRatio < 1.08) {
    labelRotate = 0;
  } else if (aspectRatio < 1.22) {
    labelRotate = normalizeLabelRotation(labelRotate * 0.94);
  }

  return {
    anchor,
    labelRotate,
    majorSpan: best.majorSpan,
    minorSpan: best.minorSpan,
    availableSpan: best.availableSpan
  };
}

function estimateLabelWidthUnits(labelName: string, tracking: number): number {
  const trimmed = labelName.trim();
  if (!trimmed) return 1;

  const letterCount = Math.max(1, trimmed.replace(/\s+/g, "").length);
  const spaceCount = Math.max(0, trimmed.split(/\s+/).length - 1);
  return (letterCount * LABEL_WIDTH_PER_CHARACTER)
    + (spaceCount * LABEL_WIDTH_PER_SPACE)
    + (Math.max(0, letterCount - 1) * tracking);
}

function estimateLabelHeightUnits(): number {
  return LABEL_HEIGHT_UNITS;
}

function deriveCountryLabelMetrics(geometry: CountryGeometry, profile: LabelProfile, labelName: string): CountryLabelMetrics {
  const labelGeometry = summarizeLabelGeometry(geometry, profile);
  const [minLon, minLat, maxLon, maxLat] = geometry.bbox;
  const footprint = Math.sqrt(Math.max(0.8, maxLon - minLon) * Math.max(0.6, maxLat - minLat));
  const labelTracking = labelTrackingFromProfile(profile, labelName, footprint);
  const widthUnits = estimateLabelWidthUnits(labelName, labelTracking);
  const heightUnits = estimateLabelHeightUnits();
  const spanFitSize = Math.min(
    (Math.max(0.8, labelGeometry.availableSpan || labelGeometry.majorSpan) * LABEL_SPAN_TO_SIZE) / Math.max(2.8, widthUnits),
    (labelGeometry.minorSpan * LABEL_SPAN_TO_SIZE) / Math.max(1.0, heightUnits)
  );
  const areaDrivenSize = 8.8 + (footprint * profile.sizeScale);
  const labelSize = Math.max(
    profile.minSize,
    Math.min(profile.maxSize, Math.min(Math.max(areaDrivenSize, spanFitSize * 1.02), spanFitSize * 1.08))
  );

  return {
    ...labelGeometry,
    labelSize,
    labelTracking
  };
}

type ProjectedPolygonMetrics = {
  polygon: Position[][];
  area: number;
  bounds: [number, number, number, number];
};

function viewportLongitudeSpan(viewport: MapViewport): number {
  const [west, , east] = viewport.bounds;
  const span = east - west;
  if (Math.abs(span) > 1e-6) {
    return span > 0 ? span : span + 360;
  }
  return 360;
}

function normalizeLongitudeRelativeToViewport(lon: number, viewport: MapViewport): number {
  const reference = viewport.center[0];
  let adjusted = lon;
  while (adjusted - reference > 180) adjusted -= 360;
  while (reference - adjusted > 180) adjusted += 360;
  return adjusted;
}

function projectPointToViewport(point: Position, viewport: MapViewport): Position {
  const [west, south, , north] = viewport.bounds;
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const lonSpan = viewportLongitudeSpan(viewport);
  const latSpan = Math.max(1e-6, north - south);
  const projectedWest = normalizeLongitudeRelativeToViewport(west, viewport);
  const projectedEast = projectedWest + lonSpan;
  let projectedLon = normalizeLongitudeRelativeToViewport(point[0], viewport);
  while (projectedLon < projectedWest) projectedLon += 360;
  while (projectedLon > projectedEast) projectedLon -= 360;
  const x = ((projectedLon - projectedWest) / lonSpan) * width;
  const y = ((north - point[1]) / latSpan) * height;
  return [x, y];
}

function unprojectPointFromViewport(point: PointLike, viewport: MapViewport): Position {
  const [west, south, , north] = viewport.bounds;
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const lonSpan = viewportLongitudeSpan(viewport);
  const latSpan = Math.max(1e-6, north - south);
  const lon = normalizeLongitudeRelativeToViewport(west + ((point.x / width) * lonSpan), viewport);
  const lat = north - ((point.y / height) * latSpan);
  return [lon, lat];
}

function rectIntersectionArea(
  left: [number, number, number, number],
  right: [number, number, number, number]
): number {
  const minX = Math.max(left[0], right[0]);
  const minY = Math.max(left[1], right[1]);
  const maxX = Math.min(left[2], right[2]);
  const maxY = Math.min(left[3], right[3]);
  if (maxX <= minX || maxY <= minY) return 0;
  return (maxX - minX) * (maxY - minY);
}

function normalizeRingPoints(ring: Position[], viewport: MapViewport): Position[] {
  if (ring.length === 0) return ring;
  const normalized: Position[] = [];
  let previousLon = normalizeLongitudeRelativeToViewport(ring[0][0], viewport);
  normalized.push([previousLon, ring[0][1]]);

  for (let index = 1; index < ring.length; index += 1) {
    const current = ring[index];
    let lon = normalizeLongitudeRelativeToViewport(current[0], viewport);
    while (lon - previousLon > 180) lon -= 360;
    while (previousLon - lon > 180) lon += 360;
    normalized.push([lon, current[1]]);
    previousLon = lon;
  }

  return normalized;
}

function projectRingToViewport(ring: Position[], viewport: MapViewport): Position[] {
  return normalizeRingPoints(ring, viewport).map((point) => projectPointToViewport(point, viewport));
}

function projectPolygonToViewport(polygon: Position[][], viewport: MapViewport): ProjectedPolygonMetrics | null {
  if (polygon.length === 0) return null;

  const projected = polygon
    .map((ring) => projectRingToViewport(ring, viewport))
    .filter((ring) => ring.length >= 3);
  if (projected.length === 0) return null;

  const outerRing = projected[0];
  const outerArea = Math.abs(ringArea(outerRing));
  const holeArea = projected
    .slice(1)
    .reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0);
  const area = Math.max(0, outerArea - holeArea);
  const bounds = bboxFromCoordinates(outerRing);
  const coverage = rectIntersectionArea(bounds, [0, 0, Math.max(1, viewport.width), Math.max(1, viewport.height)])
    / Math.max(1, (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]));

  return {
    polygon: projected,
    area: area * Math.max(0, Math.min(1, coverage)),
    bounds
  };
}

function projectGeometryToViewport(geometry: Geometry, viewport: MapViewport): ProjectedPolygonMetrics[] {
  if (geometry.type === "Polygon") {
    const polygon = projectPolygonToViewport(geometry.coordinates as Position[][], viewport);
    return polygon ? [polygon] : [];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => projectPolygonToViewport(polygon as Position[][], viewport))
      .filter((item): item is ProjectedPolygonMetrics => Boolean(item));
  }

  return [];
}

function computeViewportVisualArea(geometry: Geometry, viewport: MapViewport): number {
  return projectGeometryToViewport(geometry, viewport).reduce((sum, polygon) => sum + polygon.area, 0);
}

function projectedGeometryBounds(geometry: Geometry, viewport: MapViewport): [number, number, number, number] {
  const points = projectGeometryToViewport(geometry, viewport).flatMap((polygon) => polygon.polygon.flat());
  if (points.length === 0) {
    return [0, 0, 0, 0];
  }
  return bboxFromCoordinates(points);
}

function buildStraightLabelLine(
  geometry: CountryGeometry,
  metrics: CountryLabelMetrics,
  labelName: string,
  profile: LabelProfile
): { type: "LineString"; coordinates: Position[] } {
  const angleRad = metrics.labelRotate * (Math.PI / 180);
  const axisX = Math.cos(angleRad);
  const axisY = Math.sin(angleRad);
  const availableSpan = Math.max(0.8, metrics.availableSpan || metrics.majorSpan);
  const ring = dominantCoordinatesFromGeometry(geometry.geometry);
  const endpoints = interiorLineEndpointsAlongAxis(ring, metrics.anchor, metrics.labelRotate);

  if (endpoints) {
    const trim = profile.archipelago
      ? 0.18
      : profile.compactWide
        ? 0.08
        : profile.elongated
          ? 0.04
          : 0.06;
    const keep = Math.max(0.62, 1 - trim);
    return {
      type: "LineString",
      coordinates: [
        [metrics.anchor[0] + ((endpoints.start[0] - metrics.anchor[0]) * keep), metrics.anchor[1] + ((endpoints.start[1] - metrics.anchor[1]) * keep)],
        [metrics.anchor[0], metrics.anchor[1]],
        [metrics.anchor[0] + ((endpoints.end[0] - metrics.anchor[0]) * keep), metrics.anchor[1] + ((endpoints.end[1] - metrics.anchor[1]) * keep)]
      ]
    };
  }

  const textSpan = estimateLabelWidthUnits(labelName, metrics.labelTracking);
  const axisFactor = profile.elongated
    ? 0.94
    : profile.compactWide
      ? 0.86
      : profile.archipelago
        ? 0.58
        : 0.8;
  const textBoost = Math.max(1.0, Math.min(24, textSpan * 0.34));
  const spanBoost = Math.max(1.5, Math.min(24, metrics.majorSpan * axisFactor));
  const halfLength = Math.max(1.0, Math.min(24, Math.max(textBoost, spanBoost, availableSpan * 0.5)));
  const maxHalfLength = Math.max(1.6, availableSpan * 0.9);

  return {
    type: "LineString",
    coordinates: [
      [metrics.anchor[0] - (axisX * Math.min(halfLength, maxHalfLength)), metrics.anchor[1] - (axisY * Math.min(halfLength, maxHalfLength))],
      [metrics.anchor[0], metrics.anchor[1]],
      [metrics.anchor[0] + (axisX * Math.min(halfLength, maxHalfLength)), metrics.anchor[1] + (axisY * Math.min(halfLength, maxHalfLength))]
    ]
  };
}

function buildLabelLine(
  geometry: CountryGeometry,
  profile: LabelProfile,
  metrics: CountryLabelMetrics,
  labelName: string
): { type: "LineString"; coordinates: Position[] } {
  return buildStraightLabelLine(geometry, metrics, labelName, profile);
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

export function getZoomBandFromMapLibreZoom(zoom: number): ZoomBand {
  if (zoom < 2.1) return "far";
  if (zoom < 3.6) return "global";
  if (zoom < 5.0) return "regional";
  if (zoom < 6.35) return "close";
  return "detail";
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
        const profile = getLabelProfile(country.id);
        const labelName = translateCountryName(country.name, locale).toUpperCase();
        const metrics = deriveCountryLabelMetrics(geometry, profile, labelName);

        return {
          type: "Feature" as const,
          id: country.id,
          properties: {
            countryId: country.id,
            name: labelName,
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
            labelSize: metrics.labelSize,
            labelOpacity: 1,
            labelVisible: true,
            labelPriority: computeCountryLabelPriority({
              visualArea: Math.max(1, (geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1]) * 1_000),
              basePriority: country.power * 42 + country.stability * 8 + country.tension * 2.5 + country.industry * 18,
              selected: country.id === selectedCountryId,
              highlighted: highlighted.has(country.id),
              focused: focused.has(country.id),
              known: knownCountryIds.has(country.id),
              strategicBoost: country.fortification * 12 + country.wealth * 1.5
            }),
            labelRotate: metrics.labelRotate,
            labelTracking: metrics.labelTracking,
            labelRank: Math.round(-((geometry.bbox[2] - geometry.bbox[0]) * (geometry.bbox[3] - geometry.bbox[1])) * 1000)
          },
          geometry: geometry.geometry
        };
      })
      .filter(isNotNull)
  };
}

export function makeCountryLabelCollection(
  countries: CountryState[],
  geometries: Map<string, CountryGeometry>,
  knownCountryIds: Set<string>,
  locale: UiLocale,
  zoomBand: ZoomBand,
  viewport: MapViewport,
  options?: {
    selectedCountryId?: string | null;
    highlightedCountryIds?: string[];
    focusCountryIds?: string[];
  }
): FeatureCollection<Geometry, CountryFeatureProperties> {
  const highlighted = new Set(options?.highlightedCountryIds ?? []);
  const focused = new Set(options?.focusCountryIds ?? []);

  const candidates = countries
    .map((country) => {
      const geometry = geometries.get(country.id);
      if (!geometry) return null;
      const profile = getLabelProfile(country.id);
      const labelName = translateCountryName(country.name, locale).toUpperCase();
      const geoMetrics = deriveCountryLabelMetrics(geometry, profile, labelName);
      const visualArea = computeViewportVisualArea(geometry.geometry, viewport);
      if (visualArea < COUNTRY_LABEL_AREA_HIDE) return null;
      const projectedBounds = projectedGeometryBounds(geometry.geometry, viewport);
      const screenAnchor = projectPointToViewport(geoMetrics.anchor, viewport);
      const screenAnchorPoint: PointLike = {
        x: screenAnchor[0],
        y: screenAnchor[1]
      };
      const labelSize = computeCountryLabelFontSize(
        visualArea,
        zoomBand,
        {
          minFontSize: COUNTRY_LABEL_MIN_FONT_PX,
          maxFontSize: COUNTRY_LABEL_MAX_FONT_PX
        }
      );
      const labelOpacity = computeCountryLabelOpacity(visualArea);
      const labelRotate = geoMetrics.labelRotate;
      const screenMajorSpan = Math.max(1, projectedBounds[2] - projectedBounds[0]);
      const screenMinorSpan = Math.max(1, projectedBounds[3] - projectedBounds[1]);
      const candidateOffsets = generateCountryLabelOffsets({
        rotation: labelRotate,
        majorSpan: screenMajorSpan,
        minorSpan: screenMinorSpan,
        fontSize: labelSize
      });
      const bounds = measureLabelBounds(labelName, screenAnchorPoint, labelSize, geoMetrics.labelTracking, labelRotate);
      const fitScore = Math.max(
        0,
        Math.min(
          screenMajorSpan / Math.max(bounds.width, 0.01),
          screenMinorSpan / Math.max(bounds.height, 0.01)
        )
      );
      const labelPriority = computeCountryLabelPriority({
        visualArea,
        basePriority: country.power * 42 + country.stability * 8 + country.tension * 2.5 + country.industry * 18,
        selected: options?.selectedCountryId === country.id,
        highlighted: highlighted.has(country.id),
        focused: focused.has(country.id),
        known: knownCountryIds.has(country.id),
        strategicBoost: country.fortification * 12 + country.wealth * 1.5
      });

      return {
        country,
        geometry,
        profile,
        labelName,
        geoMetrics,
        visualArea,
        screenAnchor,
        screenAnchorPoint,
        screenMajorSpan,
        screenMinorSpan,
        labelSize,
        labelRotate,
        labelTracking: geoMetrics.labelTracking,
        candidateOffsets,
        labelOpacity,
        labelPriority,
        labelRank: Math.round((-visualArea * 1_000) + (labelPriority * 0.1)),
        bounds,
        fitScore
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const priorityDelta = right.labelPriority - left.labelPriority;
      if (priorityDelta !== 0) return priorityDelta;
      const areaDelta = right.visualArea - left.visualArea;
      if (areaDelta !== 0) return areaDelta;
      const fitDelta = right.fitScore - left.fitScore;
      if (fitDelta !== 0) return fitDelta;
      const rankDelta = right.labelRank - left.labelRank;
      if (rankDelta !== 0) return rankDelta;
      const sizeDelta = right.labelSize - left.labelSize;
      if (sizeDelta !== 0) return sizeDelta;
      return left.labelName.localeCompare(right.labelName);
    });

  const selected = selectCountryLabels({
    candidates: candidates.map((entry) => ({
      id: entry.country.id,
      countryId: entry.country.id,
      text: entry.labelName,
      anchor: entry.screenAnchorPoint,
      priority: entry.labelPriority,
      fitScore: entry.fitScore,
      weight: Math.round(
        (entry.labelPriority * 0.5)
        + (entry.visualArea * 18)
        + (entry.fitScore * 9_000)
        + (entry.labelSize * 120)
      ),
      visualArea: entry.visualArea,
      fontSize: entry.labelSize,
      opacity: entry.labelOpacity,
      rotation: entry.labelRotate,
      tracking: entry.labelTracking,
      bounds: entry.bounds,
      majorSpan: entry.screenMajorSpan,
      minorSpan: entry.screenMinorSpan,
      candidateOffsets: entry.candidateOffsets,
      minFontSize: COUNTRY_LABEL_MIN_FONT_PX,
      maxFontSize: COUNTRY_LABEL_MAX_FONT_PX,
      shrinkStep: Math.max(0.8, entry.labelSize * 0.08),
      item: entry
    })),
    zoomBand
  });

  return {
    type: "FeatureCollection",
    features: selected
      .map((entry) => ({
        type: "Feature" as const,
        id: `label-${entry.item.country.id}`,
        properties: {
          countryId: entry.item.country.id,
          name: entry.item.labelName,
          fillColor: countryColor(entry.item.country.id),
          discovered: knownCountryIds.has(entry.item.country.id),
          selected: false,
          highlighted: false,
          focused: false,
          power: entry.item.country.power,
          stability: entry.item.country.stability,
          tension: entry.item.country.tension,
          army: entry.item.country.army,
          industry: entry.item.country.industry,
          descriptor: entry.item.country.descriptor,
            labelSize: entry.fontSize,
            labelOpacity: entry.opacity,
            labelVisible: true,
            labelPriority: entry.priority,
            labelRotate: entry.rotation,
            labelTracking: entry.tracking,
            labelRank: entry.item.labelRank
          },
          geometry: buildLabelLine(
          entry.item.geometry,
          entry.item.profile,
          {
            ...entry.item.geoMetrics,
            anchor: unprojectPointFromViewport(entry.anchor, viewport)
          },
          entry.item.labelName
        )
      }))
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
