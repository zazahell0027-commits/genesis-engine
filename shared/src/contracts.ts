export type ScenarioId = "earth-2010";

export type JumpStep = "week" | "month" | "quarter" | "year";

export type GameEventType =
  | "system"
  | "order"
  | "diplomacy"
  | "major_diplomacy"
  | "major_crisis"
  | "major_conflict"
  | "major_growth";

export type TurnOrderKind = "stabilize" | "invest" | "pressure" | "military" | "diplomacy";

export type CountryDescriptor = {
  id: string;
  name: string;
  continent: string;
};

export type ScenarioDescriptor = {
  id: ScenarioId;
  name: string;
  description: string;
  startYear: number;
  startMonth: number;
};

export type CountryState = {
  id: string;
  name: string;
  continent: string;
  bloc: string;
  wealth: number;
  stability: number;
  tension: number;
  relationToPlayer: number;
};

export type GameEvent = {
  id: string;
  type: GameEventType;
  tick: number;
  year: number;
  month: number;
  title: string;
  description: string;
  countryId?: string;
};

export type TurnOrder = {
  id: string;
  text: string;
  kind: TurnOrderKind;
  targetCountryId: string;
  status: "queued" | "resolved" | "cancelled";
  tickSubmitted: number;
};

export type DiplomacyExchange = {
  id: string;
  tick: number;
  year: number;
  month: number;
  targetCountryId: string;
  targetCountryName: string;
  message: string;
  stance: "friendly" | "neutral" | "hostile";
  reply: string;
};

export type RoundSummary = {
  tick: number;
  year: number;
  month: number;
  appliedOrders: number;
  highlights: string[];
};

export type WorldIndicators = {
  avgStability: number;
  avgWealth: number;
  avgTension: number;
  conflictLevel: "Low" | "Medium" | "High";
};

export type GameState = {
  id: string;
  scenarioId: ScenarioId;
  scenarioName: string;
  year: number;
  month: number;
  tick: number;
  playerCountryId: string;
  playerCountryName: string;
  actionPoints: number;
  maxActionPoints: number;
  countries: CountryState[];
  events: GameEvent[];
  queuedOrders: TurnOrder[];
  diplomacyLog: DiplomacyExchange[];
  lastRoundSummary?: RoundSummary;
  indicators: WorldIndicators;
};

export type CreateGameInput = {
  scenarioId: ScenarioId;
  countryId: string;
};

export type QueueOrderInput = {
  gameId: string;
  text: string;
};

export type RemoveOrderInput = {
  gameId: string;
  orderId: string;
};

export type JumpInput = {
  gameId: string;
  step: JumpStep;
};

export type DiplomacyInput = {
  gameId: string;
  targetCountryId: string;
  message: string;
};

export type AdvisorResponse = {
  provider: string;
  narrative: string;
  tick: number;
  year: number;
  month: number;
};
