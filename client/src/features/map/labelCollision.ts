import Labelgun from "labelgun";
import type { BoundingBox } from "./spatial";

export type PointLike = {
  x: number;
  y: number;
};

export type LabelCollisionEntry<T> = {
  id: string;
  bounds: BoundingBox;
  weight: number;
  item: T;
};

type LabelgunBox = {
  bottomLeft: [number, number];
  topRight: [number, number];
};

function toLabelgunBox(bounds: BoundingBox): LabelgunBox {
  return {
    bottomLeft: [bounds.x, bounds.y],
    topRight: [bounds.x + bounds.width, bounds.y + bounds.height]
  };
}

export function inflateBounds(bounds: BoundingBox, padding: number): BoundingBox {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + (padding * 2),
    height: bounds.height + (padding * 2)
  };
}

export function intersectsBounds(left: BoundingBox, right: BoundingBox): boolean {
  return !(
    left.x + left.width <= right.x
    || right.x + right.width <= left.x
    || left.y + left.height <= right.y
    || right.y + right.height <= left.y
  );
}

export function measureLabelBounds(
  text: string,
  anchor: PointLike,
  fontSize: number,
  tracking = 0.12,
  rotationDeg = 0,
  letterWidthEm = 0.57,
  spaceWidthEm = 0.28,
  heightEm = 1.02
): BoundingBox {
  const normalized = text.trim();
  const letters = Math.max(1, normalized.replace(/\s+/g, "").length);
  const spaces = Math.max(0, normalized.split(/\s+/).length - 1);
  const width = Math.max(
    fontSize,
    (letters * letterWidthEm * fontSize)
      + (spaces * spaceWidthEm * fontSize)
      + (Math.max(0, letters - 1) * tracking * fontSize)
  );
  const height = Math.max(fontSize * 0.82, heightEm * fontSize);
  const angle = Math.abs(rotationDeg % 180) * (Math.PI / 180);
  const axisWidth = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height;
  const axisHeight = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height;

  return {
    x: anchor.x - (axisWidth / 2),
    y: anchor.y - (axisHeight / 2),
    width: axisWidth,
    height: axisHeight
  };
}

export function declutterWithLabelgun<T>(entries: LabelCollisionEntry<T>[], maxCount: number): T[] {
  if (maxCount <= 0 || entries.length === 0) return [];

  const ranked = [...entries].sort((left, right) => {
    const weightDelta = right.weight - left.weight;
    if (weightDelta !== 0) return weightDelta;
    return left.id.localeCompare(right.id);
  });

  const entriesSize = Math.max(8, Math.min(64, Math.ceil(ranked.length / 4)));
  const labelgun = new Labelgun<T>(() => undefined, () => undefined, entriesSize);

  for (const entry of ranked) {
    labelgun.ingestLabel(toLabelgunBox(entry.bounds), entry.id, entry.weight, entry.item, entry.id, false);
  }

  labelgun.update(false);
  const shown = new Set(labelgun.getShown().map((label) => String(label.id)));
  return ranked
    .filter((entry) => shown.has(entry.id))
    .slice(0, maxCount)
    .map((entry) => entry.item);
}
