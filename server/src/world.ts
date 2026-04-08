import type { CreateWorldInput, World, WorldCell } from "@genesis/shared";

const worlds = new Map<string, World>();

function createCell(x: number, y: number): WorldCell {
  return {
    id: `${x}-${y}`,
    x,
    y,
    owner: "neutral",
    richness: 50,
    stability: 60,
    tension: 30
  };
}

export function createWorld(input: CreateWorldInput): World {
  const width = Math.max(3, Math.min(30, input.width ?? 10));
  const height = Math.max(3, Math.min(30, input.height ?? 10));
  const role = input.role ?? "hero";
  const id = `world-${Date.now()}`;

  const cells: WorldCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push(createCell(x, y));
    }
  }

  const world: World = {
    id,
    name: input.name?.trim() || "New Genesis World",
    tick: 0,
    width,
    height,
    role,
    cells
  };

  worlds.set(id, world);
  return world;
}

export function getWorld(worldId: string): World | undefined {
  return worlds.get(worldId);
}

export function saveWorld(world: World): void {
  worlds.set(world.id, world);
}
