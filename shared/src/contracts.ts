export type RoleType = "hero" | "faction" | "nation" | "gm";
export type WorldKind = "historical" | "fictional";
export type PoliticalComplexity = "low" | "medium" | "high";
export type MapSize = "small" | "medium" | "large";
export type EventType = "troubles" | "alliance" | "expansion" | "crisis_local" | "discovery";
export type PlayerActionType = "stabilize" | "invest" | "influence" | "disrupt" | "incite";

export const HISTORICAL_START_COUNTRIES = [
  "France",
  "United Kingdom",
  "Germany",
  "Russia",
  "United States",
  "Japan",
  "Turkey",
  "China",
  "Brazil",
  "Egypt"
] as const;

export type HistoricalStartCountry = string;

export type WorldCell = {
  id: string;
  x: number;
  y: number;
  owner: string;
  continent: string;
  country: string;
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

export type QueuedPlayerAction = {
  id: string;
  action: PlayerActionType;
  cellId: string;
  tickQueued: number;
};

export type SubmittedTurnCommand = {
  id: string;
  text: string;
  parsedAction: PlayerActionType;
  parsedCellId: string;
  rationale: string;
  status: "queued" | "applied" | "cancelled";
  tickQueued: number;
  linkedQueuedActionId: string;
};

export type TurnResolutionReport = {
  tick: number;
  year: number;
  executedCount: number;
  highlights: string[];
};

export type World = {
  id: string;
  name: string;
  scenarioId: string;
  year: number;
  tick: number;
  actionPoints: number;
  maxActionPoints: number;
  width: number;
  height: number;
  role: RoleType;
  kind: WorldKind;
  complexity: PoliticalComplexity;
  playerCountry?: string;
  playerFactionId?: string;
  startCellId?: string;
  countryLocked: boolean;
  queuedActions: QueuedPlayerAction[];
  submittedCommands: SubmittedTurnCommand[];
  lastResolutionReport?: TurnResolutionReport;
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
  startCountry?: HistoricalStartCountry;
};
