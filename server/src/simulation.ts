import type { EventType, Faction, World, WorldCell, WorldEvent } from "@genesis/shared";

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

function deterministicIndex(world: World, salt: string, size: number): number {
  if (size <= 1) return 0;

  const seed = `${world.id}:${world.tick}:${salt}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 29 + seed.charCodeAt(i)) % 104729;
  }

  return hash % size;
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

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toEventTypeByIndex(index: number): EventType {
  const options: EventType[] = ["troubles", "alliance", "expansion", "crisis_local", "discovery"];
  return options[index % options.length];
}

function pushEvent(world: World, event: WorldEvent): void {
  world.events.unshift(event);
  if (world.events.length > 40) {
    world.events = world.events.slice(0, 40);
  }
}

function factionName(world: World, factionId?: string): string {
  if (!factionId) return "Unknown faction";
  return world.factions.find((f) => f.id === factionId)?.name ?? factionId;
}

function strongestFaction(world: World): Faction | undefined {
  return [...world.factions].sort((a, b) => b.power - a.power)[0];
}

function updateFactionStats(world: World): void {
  for (const faction of world.factions) {
    const owned = world.cells.filter((cell) => cell.owner === faction.id);
    const territoryWeight = owned.length;
    const avgRichness = average(owned.map((cell) => cell.richness));
    const avgStability = average(owned.map((cell) => cell.stability));

    faction.resources = clamp(Math.round(avgRichness * 0.7 + territoryWeight * 1.6));
    faction.power = clamp(Math.round(avgStability * 0.5 + territoryWeight * 1.9));
  }
}

function pickTargetCell(world: World, strategy: "highest_tension" | "lowest_richness" | "highest_richness"): WorldCell {
  const cells = [...world.cells];

  if (strategy === "highest_tension") {
    cells.sort((a, b) => b.tension - a.tension || a.id.localeCompare(b.id));
  } else if (strategy === "lowest_richness") {
    cells.sort((a, b) => a.richness - b.richness || a.id.localeCompare(b.id));
  } else {
    cells.sort((a, b) => b.richness - a.richness || a.id.localeCompare(b.id));
  }

  return cells[0];
}

function createEvent(world: World, type: EventType, details: {
  title: string;
  description: string;
  targetCellId?: string;
  factionId?: string;
}): WorldEvent {
  return {
    id: `${world.id}-evt-${world.tick}-${world.events.length + 1}`,
    tick: world.tick,
    type,
    title: details.title,
    description: details.description,
    targetCellId: details.targetCellId,
    factionId: details.factionId
  };
}

export function triggerWorldEvent(world: World, requestedType?: EventType): World {
  const type = requestedType ?? toEventTypeByIndex(deterministicIndex(world, "manual-event", 5));

  if (type === "troubles") {
    const target = pickTargetCell(world, "highest_tension");
    target.tension = clamp(target.tension + 12);
    target.stability = clamp(target.stability - 8);

    pushEvent(world, createEvent(world, type, {
      title: "Civil Unrest",
      description: `Des troubles éclatent dans (${target.x}, ${target.y}).`,
      targetCellId: target.id,
      factionId: target.owner
    }));
  } else if (type === "alliance") {
    for (const cell of world.cells.slice(0, Math.min(8, world.cells.length))) {
      cell.tension = clamp(cell.tension - 5);
      cell.stability = clamp(cell.stability + 4);
    }

    const leader = strongestFaction(world);
    pushEvent(world, createEvent(world, type, {
      title: "Regional Pact",
      description: `${factionName(world, leader?.id)} consolide une alliance régionale.`,
      factionId: leader?.id
    }));
  } else if (type === "expansion") {
    const leader = strongestFaction(world);
    const borderCells = world.cells.filter((cell) => cell.x === 0 || cell.y === 0 || cell.x === world.width - 1 || cell.y === world.height - 1);
    const target = borderCells[deterministicIndex(world, "expansion-target", borderCells.length)] ?? world.cells[0];

    if (leader) {
      target.owner = leader.id;
      target.stability = clamp(target.stability - 3);
      target.tension = clamp(target.tension + 7);
    }

    pushEvent(world, createEvent(world, type, {
      title: "Territorial Push",
      description: `${factionName(world, leader?.id)} étend son contrôle en périphérie.`,
      targetCellId: target.id,
      factionId: leader?.id
    }));
  } else if (type === "crisis_local") {
    const target = pickTargetCell(world, "highest_richness");
    target.richness = clamp(target.richness - 11);
    target.stability = clamp(target.stability - 9);
    target.tension = clamp(target.tension + 6);

    pushEvent(world, createEvent(world, type, {
      title: "Local Crisis",
      description: `Une crise brutale impacte la zone (${target.x}, ${target.y}).`,
      targetCellId: target.id,
      factionId: target.owner
    }));
  } else {
    const target = pickTargetCell(world, "lowest_richness");
    target.richness = clamp(target.richness + 12);
    target.stability = clamp(target.stability + 3);

    pushEvent(world, createEvent(world, type, {
      title: "Strategic Discovery",
      description: `Une découverte améliore les perspectives de (${target.x}, ${target.y}).`,
      targetCellId: target.id,
      factionId: target.owner
    }));
  }

  updateFactionStats(world);
  return world;
}

export function tickWorld(world: World): World {
  world.tick += 1;

  const snapshot = new Map(world.cells.map((cell) => [cell.id, { ...cell }]));
  let ownerChanges = 0;

  for (const cell of world.cells) {
    const before = snapshot.get(cell.id);
    if (!before) continue;

    const neighbors = getNeighbors(snapshot, before.x, before.y);
    const neighborTensionAvg = neighbors.length > 0
      ? average(neighbors.map((neighbor) => neighbor.tension))
      : before.tension;

    const neighborStabilityAvg = neighbors.length > 0
      ? average(neighbors.map((neighbor) => neighbor.stability))
      : before.stability;

    const noise = deterministicDelta(world, cell.id);

    const richnessDelta = noise + (before.stability >= 60 ? 1 : 0) - (before.tension >= 62 ? 1 : 0);
    const tensionDelta = trendToward(before.tension, neighborTensionAvg) + (noise > 0 ? 1 : noise < 0 ? -1 : 0);
    const stabilityDelta = (before.tension >= 62 ? -2 : 1) + (neighborTensionAvg >= 68 ? -1 : 0);

    cell.richness = clamp(before.richness + richnessDelta);
    cell.tension = clamp(before.tension + tensionDelta);
    cell.stability = clamp(before.stability + stabilityDelta);

    if (before.tension > 72 && before.stability < 36 && neighbors.length > 0) {
      const candidate = [...neighbors].sort((a, b) => b.stability - a.stability)[0];
      if (candidate && candidate.owner !== before.owner) {
        cell.owner = candidate.owner;
        ownerChanges += 1;
      }
    }
  }

  const avgStability = average(world.cells.map((cell) => cell.stability));
  const avgRichness = average(world.cells.map((cell) => cell.richness));
  const highTension = world.cells.filter((cell) => cell.tension > 68).length;

  let autoEventType: EventType | null = null;

  if (ownerChanges > 0) {
    autoEventType = "expansion";
  } else if (highTension >= Math.ceil(world.cells.length * 0.23)) {
    autoEventType = "troubles";
  } else if (avgStability >= 70 && world.tick % 4 === 0) {
    autoEventType = "alliance";
  } else if (avgRichness >= 63 && world.tick % 3 === 0) {
    autoEventType = "discovery";
  } else if (avgStability <= 42) {
    autoEventType = "crisis_local";
  }

  if (autoEventType) {
    triggerWorldEvent(world, autoEventType);
  } else {
    updateFactionStats(world);
  }

  return world;
}
