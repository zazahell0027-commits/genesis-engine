import type { DiplomacyExchange, GameEventType, TurnOrderKind } from "@genesis/shared";

export type WorldNarrativeInput = {
  worldName: string;
  scenarioId: string;
  locale?: "fr" | "en";
  year: number;
  month: number;
  day: number;
  dateLabel: string;
  tick: number;
  role: string;
  kind: string;
  complexity: string;
  playerCountryName: string;
  actionPoints: number;
  maxActionPoints: number;
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  factionsText: string;
  playerStateText?: string;
  queuedOrdersText?: string;
  recentEventsText?: string;
  diplomacyContextText?: string;
  timelineContextText?: string;
  advisorQuestion?: string;
  latestEventText?: string;
  // Nouveaux champs pour le narrateur
  narrativeContext?: string; // contexte narratif global
  narrativeMemory?: string[]; // mémoire des événements narrés
  upcomingEvent?: string; // prochain événement à venir
  eventDecision?: string; // décision d'événement à proposer
};

export type OrderInterpretationInput = {
  presetTitle: string;
  playerCountryName: string;
  locale?: "fr" | "en";
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
  locale?: "fr" | "en";
  dateLabel: string;
  message: string;
  relationToPlayer: number;
  tension: number;
  stability: number;
  worldPressureText?: string;
  recentConversationText?: string;
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
  locale?: "fr" | "en";
  fromDateLabel: string;
  toDateLabel: string;
  appliedOrders: number;
  ordersText: string;
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  latestEventText?: string;
  worldPressureText: string;
  recentEventsText?: string;
  countryPulseText?: string;
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
  // Nouveaux méthodes pour le narrateur
  generateNarrativeDecision(input: {
    year: number;
    month: number;
    narrativeContext?: string;
    narrativeMemory?: string[];
  }): Promise<string>;
  updateNarrativeMemory(memory: string[]): Promise<void>;
};
