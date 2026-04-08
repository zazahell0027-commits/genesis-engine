export type RoleType = "hero" | "faction" | "nation" | "gm";
export type WorldKind = "historical" | "fictional";
export type PoliticalComplexity = "low" | "medium" | "high";
export type MapSize = "small" | "medium" | "large";
export type EventType = "troubles" | "alliance" | "expansion" | "crisis_local" | "discovery";
export type PlayerActionType = "stabilize" | "invest" | "influence" | "disrupt" | "incite";

export type WorldCell = {
  id: string;
  x: number;
  y: number;
  owner: string;
  continent: string;
  richness: number;
  stability: number;
  tension: number;
};

export type Faction = {
  id: string;
  name: string;
  power: number;
  resources: number;
};

export type WorldEvent = {
  id: string;
  tick: number;
  type: EventType;
  title: string;
  description: string;
  targetCellId?: string;
  factionId?: string;
};

export type World = {
  id: string;
  name: string;
  tick: number;
  width: number;
  height: number;
  role: RoleType;
  kind: WorldKind;
  complexity: PoliticalComplexity;
  cells: WorldCell[];
  factions: Faction[];
  events: WorldEvent[];
};

export type CreateWorldInput = {
  name?: string;
  kind?: WorldKind;
  complexity?: PoliticalComplexity;
  width?: number;
  height?: number;
  mapSize?: MapSize;
  role?: RoleType;
};
