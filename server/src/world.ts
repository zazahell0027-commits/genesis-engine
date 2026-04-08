import type {
  CreateWorldInput,
  Faction,
  MapSize,
  PoliticalComplexity,
  World,
  WorldCell,
  WorldEvent,
  WorldKind
} from "@genesis/shared";

const worlds = new Map<string, World>();

const historicalNames = [
  "Aurelian League",
  "Sable Republic",
  "Crown of Valen",
  "Helios Dominion",
  "North March"
];

const fictionalNames = [
  "Ashen Circle",
  "Verdant Pact",
  "Solaris Combine",
  "Obsidian Court",
  "Aurora Syndicate"
];

const historicalContinents = ["Occident", "Steppe Centrale", "Orient", "Sud Imperial"];
const fictionalContinents = ["Nordreach", "Verdelune", "Duskfall", "Sables d'Astra"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hash(seed: string): number {
  let result = 0;
  for (let i = 0; i < seed.length; i += 1) {
    result = (result * 33 + seed.charCodeAt(i)) % 100003;
  }
  return result;
}

function valueBetween(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hash(seed) % span);
}

function dimensionsFromSize(size: MapSize): { width: number; height: number } {
  if (size === "small") return { width: 8, height: 8 };
  if (size === "large") return { width: 14, height: 14 };
  return { width: 10, height: 10 };
}

function resolveDimensions(input: CreateWorldInput): { width: number; height: number } {
  if (input.width && input.height) {
    return {
      width: clamp(input.width, 5, 20),
      height: clamp(input.height, 5, 20)
    };
  }

  return dimensionsFromSize(input.mapSize ?? "medium");
}

function factionCountFromComplexity(complexity: PoliticalComplexity): number {
  if (complexity === "low") return 2;
  if (complexity === "high") return 5;
  return 3;
}

function createFactions(kind: WorldKind, complexity: PoliticalComplexity): Faction[] {
  const source = kind === "historical" ? historicalNames : fictionalNames;
  const count = factionCountFromComplexity(complexity);

  return source.slice(0, count).map((name, index) => ({
    id: `faction-${index + 1}`,
    name,
    power: 45 + index * 7,
    resources: 50 + index * 4
  }));
}

type FactionCenter = {
  id: string;
  x: number;
  y: number;
};

function createFactionCenters(width: number, height: number, factions: Faction[]): FactionCenter[] {
  const maxX = width - 1;
  const maxY = height - 1;

  return factions.map((faction, index) => {
    const x = Math.round((index + 1) * (maxX / (factions.length + 1)));
    const y = index % 2 === 0 ? Math.round(maxY * 0.25) : Math.round(maxY * 0.75);
    return { id: faction.id, x, y };
  });
}

function ownerFromCenters(x: number, y: number, centers: FactionCenter[]): string {
  let winner = centers[0]?.id ?? "neutral";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const center of centers) {
    const dist = Math.abs(center.x - x) + Math.abs(center.y - y);
    if (dist < bestDistance) {
      bestDistance = dist;
      winner = center.id;
    }
  }

  return winner;
}

function assignContinent(x: number, y: number, width: number, height: number, kind: WorldKind): string {
  const names = kind === "historical" ? historicalContinents : fictionalContinents;

  const northBand = Math.floor(height * 0.28);
  const southBand = Math.floor(height * 0.72);
  const westBand = Math.floor(width * 0.45);

  if (y <= northBand) {
    return names[0];
  }

  if (y >= southBand) {
    return names[3];
  }

  if (x <= westBand) {
    return names[1];
  }

  return names[2];
}

function createCell(x: number, y: number, owner: string, continent: string, worldId: string): WorldCell {
  const seed = `${worldId}:${x}:${y}`;
  return {
    id: `${x}-${y}`,
    x,
    y,
    owner,
    continent,
    richness: valueBetween(`${seed}:richness`, 38, 68),
    stability: valueBetween(`${seed}:stability`, 45, 75),
    tension: valueBetween(`${seed}:tension`, 18, 48)
  };
}

function createInitialEvent(world: World): WorldEvent {
  const type = world.kind === "historical" ? "alliance" : "discovery";
  return {
    id: `${world.id}-evt-0`,
    tick: 0,
    type,
    title: "World Initialized",
    description: `${world.name} démarre avec ${world.factions.length} factions actives.`
  };
}

export function createWorld(input: CreateWorldInput): World {
  const id = `world-${Date.now()}`;
  const kind: WorldKind = input.kind ?? "fictional";
  const complexity: PoliticalComplexity = input.complexity ?? "medium";
  const role = input.role ?? "hero";
  const { width, height } = resolveDimensions(input);

  const factions = createFactions(kind, complexity);
  const centers = createFactionCenters(width, height, factions);

  const cells: WorldCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const owner = ownerFromCenters(x, y, centers);
      const continent = assignContinent(x, y, width, height, kind);
      cells.push(createCell(x, y, owner, continent, id));
    }
  }

  const world: World = {
    id,
    name: input.name?.trim() || "New Genesis World",
    tick: 0,
    width,
    height,
    role,
    kind,
    complexity,
    cells,
    factions,
    events: []
  };

  world.events.push(createInitialEvent(world));
  worlds.set(id, world);
  return world;
}

export function createDemoWorld(): World {
  return createWorld({
    name: "Genesis Frontier",
    kind: "fictional",
    complexity: "medium",
    mapSize: "medium",
    role: "hero"
  });
}

export function getWorld(worldId: string): World | undefined {
  return worlds.get(worldId);
}

export function saveWorld(world: World): void {
  worlds.set(world.id, world);
}
