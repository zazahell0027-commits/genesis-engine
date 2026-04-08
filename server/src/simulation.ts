import type { World, WorldCell } from "@genesis/shared";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function deterministicDelta(world: World, cellId: string): number {
  const seed = `${world.id}:${world.tick}:${cellId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return (hash % 5) - 2;
}

function getNeighbors(snapshot: Map<string, WorldCell>, x: number, y: number): WorldCell[] {
  const coords = [
    `${x - 1}-${y}`,
    `${x + 1}-${y}`,
    `${x}-${y - 1}`,
    `${x}-${y + 1}`
  ];

  return coords
    .map((key) => snapshot.get(key))
    .filter((cell): cell is WorldCell => Boolean(cell));
}

function trendToward(value: number, target: number): number {
  if (value < target) return 1;
  if (value > target) return -1;
  return 0;
}

export function tickWorld(world: World): World {
  world.tick += 1;

  // Snapshot to keep rules deterministic and avoid order-dependent updates.
  const snapshot = new Map(world.cells.map((cell) => [cell.id, { ...cell }]));

  for (const cell of world.cells) {
    const before = snapshot.get(cell.id);
    if (!before) continue;

    const neighbors = getNeighbors(snapshot, before.x, before.y);
    const neighborTensionAvg = neighbors.length > 0
      ? Math.round(neighbors.reduce((sum, n) => sum + n.tension, 0) / neighbors.length)
      : before.tension;

    const noise = deterministicDelta(world, cell.id);

    const richnessDelta = noise + (before.stability >= 60 ? 1 : 0) - (before.tension >= 60 ? 1 : 0);
    const tensionDelta = trendToward(before.tension, neighborTensionAvg) + (noise > 0 ? 1 : noise < 0 ? -1 : 0);
    const stabilityDelta = (before.tension >= 60 ? -2 : 1) + (neighborTensionAvg >= 70 ? -1 : 0);

    cell.richness = clamp(before.richness + richnessDelta);
    cell.tension = clamp(before.tension + tensionDelta);
    cell.stability = clamp(before.stability + stabilityDelta);
  }

  return world;
}
