import type { CountryState } from "@genesis/shared";
import type { BoundingBox } from "./spatial";
import type { PointLike } from "./labelCollision";
import { inflateBounds, intersectsBounds, measureLabelBounds } from "./labelCollision";
import type { ZoomBand } from "./pipeline";

export type CountryLabelCandidate<T> = {
  id: string;
  countryId: string;
  item: T;
  text: string;
  anchor: PointLike;
  priority: number;
  weight: number;
  visualArea: number;
  fontSize: number;
  opacity: number;
  rotation: number;
  tracking: number;
  bounds: BoundingBox;
  fitScore?: number;
  majorSpan?: number;
  minorSpan?: number;
  candidateOffsets?: PointLike[];
  minFontSize?: number;
  maxFontSize?: number;
  shrinkStep?: number;
};

export type CountryLabelPlacement<T> = CountryLabelCandidate<T> & {
  visible: true;
};

export const COUNTRY_LABEL_MIN_FONT_PX = 8;
export const COUNTRY_LABEL_MAX_FONT_PX = 48;
export const COUNTRY_LABEL_AREA_HIDE = 400;
export const COUNTRY_LABEL_AREA_SMALL = 1600;
export const COUNTRY_LABEL_OVERLAP_MARGIN_PX = 6;
export const COUNTRY_LABEL_TRANSITION_MS = 250;

const MAX_COUNTRY_LABELS_BY_BAND: Record<ZoomBand, number> = {
  far: 24,
  global: 34,
  regional: 48,
  close: 72,
  detail: 96
};

const LABEL_FONT_SCALE_BY_BAND: Record<ZoomBand, number> = {
  far: 0.92,
  global: 1,
  regional: 1.06,
  close: 1.14,
  detail: 1.2
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function areaOfBounds(bounds: BoundingBox): number {
  return Math.max(0, bounds.width) * Math.max(0, bounds.height);
}

function offsetPoint(point: PointLike, offset: PointLike): PointLike {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function buildDefaultOffsets(majorSpan: number, minorSpan: number, fontSize: number, rotation: number): PointLike[] {
  const angle = rotation * (Math.PI / 180);
  const axis: PointLike = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal: PointLike = { x: -axis.y, y: axis.x };

  const majorDistance = Math.max(fontSize * 0.82, majorSpan * 0.24);
  const minorDistance = Math.max(fontSize * 0.7, minorSpan * 0.28);
  const farMajor = Math.max(majorDistance * 1.42, fontSize * 1.1);
  const farMinor = Math.max(minorDistance * 1.28, fontSize * 0.85);

  return [
    { x: 0, y: 0 },
    { x: normal.x * minorDistance, y: normal.y * minorDistance },
    { x: -normal.x * minorDistance, y: -normal.y * minorDistance },
    { x: axis.x * majorDistance, y: axis.y * majorDistance },
    { x: -axis.x * majorDistance, y: -axis.y * majorDistance },
    { x: (axis.x * farMajor) + (normal.x * farMinor), y: (axis.y * farMajor) + (normal.y * farMinor) },
    { x: (axis.x * farMajor) - (normal.x * farMinor), y: (axis.y * farMajor) - (normal.y * farMinor) },
    { x: (-axis.x * farMajor) + (normal.x * farMinor), y: (-axis.y * farMajor) + (normal.y * farMinor) },
    { x: (-axis.x * farMajor) - (normal.x * farMinor), y: (-axis.y * farMajor) - (normal.y * farMinor) }
  ];
}

export function computeCountryLabelFontSize(
  visualArea: number,
  zoomBand: ZoomBand,
  options?: {
    minFontSize?: number;
    maxFontSize?: number;
  }
): number {
  const minFontSize = options?.minFontSize ?? COUNTRY_LABEL_MIN_FONT_PX;
  const maxFontSize = options?.maxFontSize ?? COUNTRY_LABEL_MAX_FONT_PX;
  const scale = LABEL_FONT_SCALE_BY_BAND[zoomBand];
  const raw = Math.sqrt(Math.max(0, visualArea)) * 0.22 * scale;
  return clamp(raw, minFontSize, maxFontSize);
}

export function computeCountryLabelOpacity(visualArea: number): number {
  if (visualArea < COUNTRY_LABEL_AREA_HIDE) {
    return 0;
  }

  if (visualArea < COUNTRY_LABEL_AREA_SMALL) {
    const t = (visualArea - COUNTRY_LABEL_AREA_HIDE) / Math.max(1, COUNTRY_LABEL_AREA_SMALL - COUNTRY_LABEL_AREA_HIDE);
    return clamp(0.16 + (t * 0.58), 0.12, 0.74);
  }

  const extra = Math.log2(Math.max(1, visualArea / COUNTRY_LABEL_AREA_SMALL));
  return clamp(0.74 + Math.min(0.22, extra * 0.05), 0.74, 0.96);
}

export function computeCountryLabelPriority(input: {
  visualArea: number;
  basePriority?: number;
  selected?: boolean;
  highlighted?: boolean;
  focused?: boolean;
  known?: boolean;
  strategicBoost?: number;
}): number {
  const areaComponent = Math.sqrt(Math.max(0, input.visualArea)) * 24;
  const basePriority = input.basePriority ?? 0;
  const selectedBoost = input.selected ? 3200 : 0;
  const focusedBoost = input.focused ? 2200 : 0;
  const highlightedBoost = input.highlighted ? 1400 : 0;
  const knownBoost = input.known ? 180 : 0;
  const strategicBoost = input.strategicBoost ?? 0;
  return basePriority + areaComponent + selectedBoost + focusedBoost + highlightedBoost + knownBoost + strategicBoost;
}

export function generateCountryLabelOffsets(input: {
  rotation: number;
  majorSpan: number;
  minorSpan: number;
  fontSize: number;
}): PointLike[] {
  return buildDefaultOffsets(input.majorSpan, input.minorSpan, input.fontSize, input.rotation);
}

function compareCandidates<T>(left: CountryLabelCandidate<T>, right: CountryLabelCandidate<T>): number {
  const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;

  const areaDelta = (right.visualArea ?? 0) - (left.visualArea ?? 0);
  if (areaDelta !== 0) return areaDelta;

  const fitDelta = (right.fitScore ?? 0) - (left.fitScore ?? 0);
  if (fitDelta !== 0) return fitDelta;

  const weightDelta = right.weight - left.weight;
  if (weightDelta !== 0) return weightDelta;

  const boundsDelta = areaOfBounds(right.bounds) - areaOfBounds(left.bounds);
  if (boundsDelta !== 0) return boundsDelta;

  return left.id.localeCompare(right.id);
}

function buildCandidateFontSizes(candidate: CountryLabelCandidate<unknown>): number[] {
  const preferred = clamp(candidate.fontSize, candidate.minFontSize ?? COUNTRY_LABEL_MIN_FONT_PX, candidate.maxFontSize ?? COUNTRY_LABEL_MAX_FONT_PX);
  const minFontSize = candidate.minFontSize ?? COUNTRY_LABEL_MIN_FONT_PX;
  const shrinkStep = candidate.shrinkStep ?? Math.max(0.8, preferred * 0.08);
  const sizes = new Set<number>([preferred]);

  for (let size = preferred - shrinkStep; size >= minFontSize - 0.01; size -= shrinkStep) {
    sizes.add(Number(size.toFixed(2)));
  }

  sizes.add(minFontSize);
  return [...sizes].sort((left, right) => right - left);
}

function buildCandidateOffsets(candidate: CountryLabelCandidate<unknown>): PointLike[] {
  if (candidate.candidateOffsets && candidate.candidateOffsets.length > 0) {
    return candidate.candidateOffsets;
  }

  const width = Math.max(candidate.majorSpan ?? candidate.bounds.width, candidate.fontSize * 2);
  const height = Math.max(candidate.minorSpan ?? candidate.bounds.height, candidate.fontSize * 1.05);
  return buildDefaultOffsets(width, height, candidate.fontSize, candidate.rotation);
}

function canPlaceLabel(
  bounds: BoundingBox,
  occupied: BoundingBox[],
  margin: number
): boolean {
  const expanded = inflateBounds(bounds, margin);
  return !occupied.some((entry) => intersectsBounds(expanded, entry));
}

export function selectCountryLabels<T>(input: {
  candidates: CountryLabelCandidate<T>[];
  zoomBand: ZoomBand;
  maxCount?: number;
  overlapMarginPx?: number;
}): CountryLabelPlacement<T>[] {
  const maxCount = input.maxCount ?? MAX_COUNTRY_LABELS_BY_BAND[input.zoomBand];
  if (maxCount <= 0 || input.candidates.length === 0) {
    return [];
  }

  const overlapMargin = input.overlapMarginPx ?? COUNTRY_LABEL_OVERLAP_MARGIN_PX;
  const ranked = [...input.candidates].sort(compareCandidates);
  const accepted: CountryLabelPlacement<T>[] = [];
  const occupied: BoundingBox[] = [];
  const seenCountries = new Set<string>();

  for (const candidate of ranked) {
    if (seenCountries.has(candidate.countryId)) {
      continue;
    }

    if ((candidate.opacity ?? 1) <= 0) {
      continue;
    }

    const fontSizes = buildCandidateFontSizes(candidate);
    const offsets = buildCandidateOffsets(candidate);
    let resolved: CountryLabelPlacement<T> | null = null;

    for (const fontSize of fontSizes) {
      for (const offset of offsets) {
        const anchor = offsetPoint(candidate.anchor, offset);
        const bounds = measureLabelBounds(candidate.text, anchor, fontSize, candidate.tracking, candidate.rotation);
        if (!canPlaceLabel(bounds, occupied, overlapMargin)) {
          continue;
        }

        const shrinkRatio = fontSize / Math.max(candidate.fontSize, 1);
        resolved = {
          ...candidate,
          anchor,
          fontSize,
          opacity: clamp(candidate.opacity * Math.max(0.72, Math.min(1, Math.sqrt(shrinkRatio))), 0, 1),
          bounds,
          visible: true
        };
        break;
      }

      if (resolved) {
        break;
      }
    }

    if (!resolved) {
      continue;
    }

    accepted.push(resolved);
    occupied.push(inflateBounds(resolved.bounds, overlapMargin));
    seenCountries.add(candidate.countryId);

    if (accepted.length >= maxCount) {
      break;
    }
  }

  return accepted;
}

export function selectCountryLabelsAsItems<T>(input: {
  candidates: CountryLabelCandidate<T>[];
  zoomBand: ZoomBand;
  maxCount?: number;
  overlapMarginPx?: number;
}): T[] {
  return selectCountryLabels(input).map((entry) => entry.item);
}

export function getCountryLabelOpacityForArea(visualArea: number, emphasis = 1): number {
  return clamp(computeCountryLabelOpacity(visualArea) * emphasis, 0, 1);
}

export function getCountryLabelSizeForArea(visualArea: number, zoomBand: ZoomBand, emphasis = 1): number {
  return clamp(computeCountryLabelFontSize(visualArea, zoomBand) * emphasis, COUNTRY_LABEL_MIN_FONT_PX, COUNTRY_LABEL_MAX_FONT_PX);
}

export function defaultCountryLabelPriority(country: CountryState, visualArea: number): number {
  return computeCountryLabelPriority({
    visualArea,
    basePriority: country.power * 42 + country.stability * 8 + country.tension * 2.5 + country.industry * 18,
    strategicBoost: country.fortification * 12 + country.wealth * 1.5
  });
}
