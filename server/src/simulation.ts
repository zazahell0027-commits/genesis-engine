import type { World } from "@genesis/shared";

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

export function tickWorld(world: World): World {
  world.tick += 1;

  for (const cell of world.cells) {
    const noise = deterministicDelta(world, cell.id);

    cell.richness = clamp(cell.richness + noise);

    const tensionShift = noise > 0 ? 1 : noise < 0 ? -1 : 0;
    cell.tension = clamp(cell.tension + tensionShift);

    const stabilityShift = cell.tension > 60 ? -2 : 1;
    cell.stability = clamp(cell.stability + stabilityShift);
  }

  return world;
}
