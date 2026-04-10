import type { DiplomacyExchange, GameEventType, TurnOrderKind } from "@genesis/shared";

export type WorldNarrativeInput = {
  worldName: string;
  scenarioId: string;
  year: number;
  tick: number;
  role: string;
  kind: string;
  complexity: string;
  actionPoints: number;
  maxActionPoints: number;
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  factionsText: string;
  latestEventText?: string;
};

export type OrderInterpretationInput = {
  presetTitle: string;
  playerCountryName: string;
  dateLabel: string;
  orderText: string;
  countries: Array<{ id: string; name: string }>;
};

export type OrderInterpretation = {
  kind: TurnOrderKind;
  targetCountryName: string;
  cleanedText: string;
};

export type DiplomacyReplyInput = {
  presetTitle: string;
  playerCountryName: string;
  targetCountryName: string;
  dateLabel: string;
  message: string;
  relationToPlayer: number;
  tension: number;
  stability: number;
};

export type DiplomacyReply = {
  stance: DiplomacyExchange["stance"];
  reply: string;
  relationDelta: number;
  tensionDelta: number;
  stabilityDelta: number;
};

export type RoundNarrativeInput = {
  presetTitle: string;
  playerCountryName: string;
  fromDateLabel: string;
  toDateLabel: string;
  appliedOrders: number;
  ordersText: string;
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  latestEventText?: string;
  worldPressureText: string;
};

export type RoundNarrative = {
  type: GameEventType;
  title: string;
  description: string;
  mapChangeSummary: string;
  factionLabel: string;
  locationLabel: string;
  highlights: string[];
};

export type AIProvider = {
  providerName: string;
  summarizeWorld(input: { worldName: string; tick: number }): Promise<string>;
  generateWorldNarrative(input: WorldNarrativeInput): Promise<string>;
  interpretOrder(input: OrderInterpretationInput): Promise<OrderInterpretation>;
  generateDiplomacyReply(input: DiplomacyReplyInput): Promise<DiplomacyReply>;
  generateRoundNarrative(input: RoundNarrativeInput): Promise<RoundNarrative>;
};
