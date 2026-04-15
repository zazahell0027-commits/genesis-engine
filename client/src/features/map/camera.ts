import type { ViewBox } from "./types";

export const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, width: 100, height: 50 };
export const EUROPE_VIEWBOX: ViewBox = { x: 20, y: 7.5, width: 32, height: 20 };
export const MIN_VIEWBOX_WIDTH = 3.4;
export const MIN_VIEWBOX_HEIGHT = 1.92;
export const MAX_VIEWBOX_WIDTH = 100;
export const MAX_VIEWBOX_HEIGHT = 50;
export const GLOBE_CLIP_RADIUS = 22.8;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return value;
  let current = value;
  while (current < min) current += range;
  while (current >= max) current -= range;
  return current;
}

export function normalizeViewBox(next: ViewBox): ViewBox {
  const width = clamp(next.width, MIN_VIEWBOX_WIDTH, MAX_VIEWBOX_WIDTH);
  const height = clamp(next.height, MIN_VIEWBOX_HEIGHT, MAX_VIEWBOX_HEIGHT);
  const maxY = MAX_VIEWBOX_HEIGHT - height;
  const x = width >= 99
    ? 0
    : wrap(next.x, 0, MAX_VIEWBOX_WIDTH);
  const y = clamp(next.y, 0, maxY);
  return { x, y, width, height };
}
