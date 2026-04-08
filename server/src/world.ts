import {
  HISTORICAL_START_COUNTRIES,
  type CreateWorldInput,
  type Faction,
  type MapSize,
  type PoliticalComplexity,
  type RoleType,
  type World,
  type WorldCell,
  type WorldEvent,
  type WorldKind
} from "@genesis/shared";

const worlds = new Map<string, World>();

const historicalFactionNames = [
  "Atlantic Accord",
  "Eurasian Compact",
  "Pacific Forum",
  "South Coalition",
  "Non-Aligned Front"
];

const fictionalFactionNames = [
  "Ashen Circle",
  "Verdant Pact",
  "Solaris Combine",
  "Obsidian Court",
  "Aurora Syndicate"
];

const fictionalContinents = ["Nordreach", "Verdelune", "Duskfall", "Sables d'Astra"];
const historicalStartCountrySet = new Set<string>(HISTORICAL_START_COUNTRIES);
const startCountryAnchors: Record<string, { continent: string; lon: number; lat: number }> = {
  France: { continent: "Europe", lon: 2, lat: 46 },
  "United Kingdom": { continent: "Europe", lon: -2, lat: 54 },
  Germany: { continent: "Europe", lon: 10, lat: 51 },
  Russia: { continent: "Europe", lon: 37, lat: 56 },
  "United States": { continent: "North America", lon: -98, lat: 39 },
  Japan: { continent: "Asia", lon: 138, lat: 37 },
  Turkey: { continent: "Asia", lon: 35, lat: 39 },
  China: { continent: "Asia", lon: 104, lat: 35 },
  Brazil: { continent: "South America", lon: -52, lat: -10 },
  Egypt: { continent: "Africa", lon: 30, lat: 26 }
};

type GeoProfile = {
  continent: string;
  country: string;
};

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
  const source = kind === "historical" ? historicalFactionNames : fictionalFactionNames;
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

function longitudeFromX(x: number, width: number): number {
  if (width <= 1) return 0;
  return (x / (width - 1)) * 360 - 180;
}

function latitudeFromY(y: number, height: number): number {
  if (height <= 1) return 0;
  return 90 - (y / (height - 1)) * 180;
}

function inBox(
  lon: number,
  lat: number,
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number
): boolean {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function historicalGeoFromCell(x: number, y: number, width: number, height: number): GeoProfile {
  const lon = longitudeFromX(x, width);
  const lat = latitudeFromY(y, height);

  if (inBox(lon, lat, -170, -50, 15, 80)) {
    if (lon < -105) return { continent: "North America", country: "Canada" };
    if (lat < 30) return { continent: "North America", country: "Mexico" };
    return { continent: "North America", country: "United States" };
  }

  if (inBox(lon, lat, -90, -30, -55, 15)) {
    if (lat < -25) return { continent: "South America", country: "Argentina" };
    if (lon < -65) return { continent: "South America", country: "Andean States" };
    return { continent: "South America", country: "Brazil" };
  }

  if (inBox(lon, lat, -15, 45, 35, 72)) {
    if (lon < -2) return { continent: "Europe", country: "United Kingdom" };
    if (lon < 12) return { continent: "Europe", country: "France" };
    if (lon < 25) return { continent: "Europe", country: "Germany" };
    return { continent: "Europe", country: "Russia" };
  }

  if (inBox(lon, lat, -20, 55, -35, 35)) {
    if (lat > 18) return { continent: "Africa", country: "Egypt" };
    if (lat < -18) return { continent: "Africa", country: "South Africa" };
    if (lon > 30) return { continent: "Africa", country: "Ethiopia" };
    return { continent: "Africa", country: "West Africa" };
  }

  if (inBox(lon, lat, 45, 160, 5, 78)) {
    if (lon < 70) return { continent: "Asia", country: "Turkey" };
    if (lon < 110) return { continent: "Asia", country: "China" };
    if (lon < 130) return { continent: "Asia", country: "Korean Peninsula" };
    return { continent: "Asia", country: "Japan" };
  }

  if (inBox(lon, lat, 110, 180, -50, 5)) {
    if (lon > 155) return { continent: "Oceania", country: "Pacific Islands" };
    return { continent: "Oceania", country: "Australia" };
  }

  if (lat >= 20) return { continent: "Europe", country: "Frontier Europe" };
  if (lat <= -15) return { continent: "South America", country: "Atlantic South" };
  return { continent: "Africa", country: "Equatorial Belt" };
}

function fictionalGeoFromCell(x: number, y: number, width: number, height: number): GeoProfile {
  const northBand = Math.floor(height * 0.28);
  const southBand = Math.floor(height * 0.72);
  const westBand = Math.floor(width * 0.45);

  let continent = fictionalContinents[2];
  if (y <= northBand) continent = fictionalContinents[0];
  else if (y >= southBand) continent = fictionalContinents[3];
  else if (x <= westBand) continent = fictionalContinents[1];

  const sector = 1 + ((x * 7 + y * 11) % 4);
  return { continent, country: `${continent} Sector ${sector}` };
}

function geoFromCell(kind: WorldKind, x: number, y: number, width: number, height: number): GeoProfile {
  if (kind === "historical") {
    return historicalGeoFromCell(x, y, width, height);
  }
  return fictionalGeoFromCell(x, y, width, height);
}

function createCell(x: number, y: number, owner: string, geo: GeoProfile, worldId: string): WorldCell {
  const seed = `${worldId}:${x}:${y}`;
  return {
    id: `${x}-${y}`,
    x,
    y,
    owner,
    continent: geo.continent,
    country: geo.country,
    richness: valueBetween(`${seed}:richness`, 38, 68),
    stability: valueBetween(`${seed}:stability`, 45, 75),
    tension: valueBetween(`${seed}:tension`, 18, 48)
  };
}

function resolveHistoricalStartCountry(input: CreateWorldInput, cells: WorldCell[]): string {
  const requested = input.startCountry;
  if (requested && historicalStartCountrySet.has(requested)) {
    return requested;
  }

  const defaultCountry = "France";
  if (historicalStartCountrySet.has(defaultCountry)) return defaultCountry;

  const firstAllowed = HISTORICAL_START_COUNTRIES[0];
  if (firstAllowed) return firstAllowed;

  return cells[0]?.country ?? defaultCountry;
}

function firstCellForCountry(cells: WorldCell[], country: string): WorldCell | undefined {
  return cells.find((cell) => cell.country === country);
}

function nearestCellByAnchor(
  cells: WorldCell[],
  width: number,
  height: number,
  anchorLon: number,
  anchorLat: number
): WorldCell | undefined {
  let best: WorldCell | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const lon = longitudeFromX(cell.x, width);
    const lat = latitudeFromY(cell.y, height);
    const score = (lon - anchorLon) ** 2 + (lat - anchorLat) ** 2;
    if (score < bestScore) {
      best = cell;
      bestScore = score;
    }
  }

  return best;
}

function ensureStartCountryPresence(
  cells: WorldCell[],
  width: number,
  height: number,
  country: string
): WorldCell | undefined {
  const existing = firstCellForCountry(cells, country);
  if (existing) return existing;

  const anchor = startCountryAnchors[country];
  if (!anchor) return cells[0];

  const nearest = nearestCellByAnchor(cells, width, height, anchor.lon, anchor.lat);
  if (!nearest) return cells[0];

  nearest.country = country;
  nearest.continent = anchor.continent;
  return nearest;
}

function alignCountryOwnership(cells: WorldCell[], country: string, factionId: string): void {
  for (const cell of cells) {
    if (cell.country !== country) continue;
    cell.owner = factionId;
    cell.stability = clamp(cell.stability + 4, 0, 100);
    cell.tension = clamp(cell.tension - 3, 0, 100);
  }
}

function createInitialEvent(world: World): WorldEvent {
  const type = world.kind === "historical" ? "alliance" : "discovery";
  return {
    id: `${world.id}-evt-0`,
    tick: 0,
    type,
    title: world.kind === "historical" ? "Historical Scenario Loaded" : "World Initialized",
    description:
      world.kind === "historical"
        ? `${world.name} starts in ${world.year} with ${world.factions.length} power blocs.`
        : `${world.name} starts with ${world.factions.length} active factions.`
  };
}

function createNationStartEvent(world: World): WorldEvent | null {
  if (!world.countryLocked || !world.playerCountry || !world.playerFactionId) {
    return null;
  }

  const factionName = world.factions.find((faction) => faction.id === world.playerFactionId)?.name ?? world.playerFactionId;

  return {
    id: `${world.id}-evt-player-start`,
    tick: 0,
    type: "alliance",
    title: "Nation Selected",
    description: `You start as ${world.playerCountry} under ${factionName}. Control is locked for this run.`,
    targetCellId: world.startCellId,
    factionId: world.playerFactionId
  };
}

function scenarioIdFromKind(kind: WorldKind): string {
  return kind === "historical" ? "earth-2010" : "frontier-sandbox";
}

function baseYearFromKind(kind: WorldKind): number {
  return kind === "historical" ? 2010 : 2200;
}

function actionBudgetFromRole(role: RoleType): { actionPoints: number; maxActionPoints: number } {
  if (role === "gm") return { actionPoints: 5, maxActionPoints: 5 };
  if (role === "nation") return { actionPoints: 3, maxActionPoints: 3 };
  if (role === "faction") return { actionPoints: 3, maxActionPoints: 3 };
  return { actionPoints: 2, maxActionPoints: 2 };
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
      const geo = geoFromCell(kind, x, y, width, height);
      cells.push(createCell(x, y, owner, geo, id));
    }
  }

  const actionBudget = actionBudgetFromRole(role);

  const world: World = {
    id,
    name: input.name?.trim() || "New Genesis World",
    scenarioId: scenarioIdFromKind(kind),
    year: baseYearFromKind(kind),
    tick: 0,
    actionPoints: actionBudget.actionPoints,
    maxActionPoints: actionBudget.maxActionPoints,
    width,
    height,
    role,
    kind,
    complexity,
    playerCountry: undefined,
    playerFactionId: undefined,
    startCellId: undefined,
    countryLocked: false,
    queuedActions: [],
    submittedCommands: [],
    lastResolutionReport: undefined,
    cells,
    factions,
    events: []
  };

  if (kind === "historical") {
    const selectedCountry = resolveHistoricalStartCountry(input, cells);
    const startCell = ensureStartCountryPresence(cells, width, height, selectedCountry) ?? cells[0];

    if (startCell) {
      world.playerCountry = selectedCountry;
      world.startCellId = startCell.id;

      if (role === "nation") {
        world.playerFactionId = startCell.owner;
        world.countryLocked = true;
        alignCountryOwnership(cells, selectedCountry, startCell.owner);

        const playerFaction = factions.find((faction) => faction.id === startCell.owner);
        if (playerFaction) {
          playerFaction.power = clamp(playerFaction.power + 4, 0, 100);
          playerFaction.resources = clamp(playerFaction.resources + 4, 0, 100);
        }
      }
    }
  }

  world.events.push(createInitialEvent(world));
  const nationStartEvent = createNationStartEvent(world);
  if (nationStartEvent) {
    world.events.unshift(nationStartEvent);
  }

  worlds.set(id, world);
  return world;
}

export function createDemoWorld(): World {
  return createWorld({
    name: "Genesis Earth 2010",
    kind: "historical",
    complexity: "medium",
    mapSize: "medium",
    role: "nation",
    startCountry: "France"
  });
}

export function getWorld(worldId: string): World | undefined {
  return worlds.get(worldId);
}

export function saveWorld(world: World): void {
  worlds.set(world.id, world);
}
