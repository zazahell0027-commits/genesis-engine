export type PointLike = {
  x: number;
  y: number;
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function declutterByDistance<T extends PointLike>(items: T[], minDistance: number, maxCount: number): T[] {
  const kept: T[] = [];
  const minDistanceSq = minDistance * minDistance;

  for (const item of items) {
    const intersects = kept.some((existing) => {
      const dx = existing.x - item.x;
      const dy = existing.y - item.y;
      return (dx * dx + dy * dy) < minDistanceSq;
    });
    if (intersects) continue;
    kept.push(item);
    if (kept.length >= maxCount) break;
  }

  return kept;
}

export function declutterByBounds<T>(
  items: T[],
  getBounds: (item: T) => BoundingBox,
  maxCount: number,
  padding: number
): T[] {
  const kept: Array<{ item: T; box: BoundingBox }> = [];

  for (const item of items) {
    const box = getBounds(item);
    const expanded: BoundingBox = {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + (padding * 2),
      height: box.height + (padding * 2)
    };

    const overlap = kept.some((entry) => intersects(expanded, entry.box));
    if (overlap) continue;

    kept.push({ item, box: expanded });
    if (kept.length >= maxCount) break;
  }

  return kept.map((entry) => entry.item);
}

export function clusterByGrid<T extends PointLike>(
  items: T[],
  options: {
    cellSize: number;
    maxCount: number;
    merge: (bucket: T[]) => T;
    sort?: (left: T, right: T) => number;
  }
): T[] {
  if (items.length <= 1) return items.slice(0, options.maxCount);
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const cellX = Math.floor(item.x / options.cellSize);
    const cellY = Math.floor(item.y / options.cellSize);
    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const merged = [...buckets.values()].map((bucket) => options.merge(bucket));
  if (options.sort) merged.sort(options.sort);
  return merged.slice(0, options.maxCount);
}

function intersects(left: BoundingBox, right: BoundingBox): boolean {
  return !(
    left.x + left.width <= right.x
    || right.x + right.width <= left.x
    || left.y + left.height <= right.y
    || right.y + right.height <= left.y
  );
}
