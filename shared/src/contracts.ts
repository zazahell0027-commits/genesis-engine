export type PresetId = string;
export type PresetCategoryId =
  | "historical"
  | "alt-historical"
  | "historical-fiction"
  | "science-fiction"
  | "fantasy";

export type DifficultyLevel = "Relaxed" | "Standard" | "Challenging";
export type AIQuality = "Fast" | "Balanced" | "Premium";
export type JumpStep = "week" | "month" | "six_months" | "year";

export type GameEventType =
  | "system"
  | "order"
  | "diplomacy"
  | "advisor"
  | "major_diplomacy"
  | "major_crisis"
  | "major_conflict"
  | "major_growth";

export type TurnOrderKind =
  | "stabilize"
  | "invest"
  | "pressure"
  | "military"
  | "attack"
  | "defend"
  | "diplomacy";

export type QuickActionKind = "attack" | "defend" | "stabilize" | "invest";

export type BadgeTone = "neutral" | "accent" | "warning";
export type TimelineTone = "normal" | "major" | "crisis" | "diplomacy";
export type MapEffectKind = "army" | "fortification" | "industry" | "stability" | "diplomacy" | "crisis";
export type MapArtifactKind = "unit" | "fort" | "industry_site";

export type CountryDescriptor = {
  id: string;
  name: string;
  continent: string;
};

export type PresetDate = {
  year: number;
  month: number;
  day: number;
  label: string;
};

export type PresetStats = {
  rounds: string;
  games: string;
  playlists?: string;
  players?: string;
};

export type PresetSummary = {
  id: PresetId;
  title: string;
  subtitle: string;
  category: PresetCategoryId;
  era: string;
  tags?: string[];
  coverImage: string;
  bannerImage?: string;
  startDate: PresetDate;
  stats: PresetStats;
  featured: boolean;
  playable: boolean;
  defaultTokens?: number;
  defaultDifficulty?: DifficultyLevel;
  official: boolean;
  creator: string;
  accent: string;
  mapPalette: {
    oceanTop: string;
    oceanBottom: string;
    landStroke: string;
    labelColor: string;
  };
  recommendedCountries: string[];
  description: string;
};

export type ScenarioDescriptor = PresetSummary;

export type PresetRail = {
  id: string;
  title: string;
  subtitle: string;
  presetIds: string[];
};

export type PresetCategory = {
  id: PresetCategoryId | string;
  title: string;
  description: string;
  eras: string[];
};

export type GameSetupOptions = {
  presetId: PresetId;
  difficultyOptions: DifficultyLevel[];
  aiQualityOptions: AIQuality[];
  defaultDifficulty: DifficultyLevel;
  defaultAIQuality: AIQuality;
  defaultCountryId: string;
  recommendedCountries: string[];
  featuredTips: string[];
};

export type QuickAction = {
  id: string;
  kind: QuickActionKind;
  label: string;
  description: string;
  promptTemplate: string;
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
  power: number;
  army: number;
  industry: number;
  fortification: number;
  unrest: number;
  descriptor: string;
};

export type MapEffect = {
  id: string;
  kind: MapEffectKind;
  layer?: "effect" | "artifact";
  countryId: string;
  sourceCountryId?: string;
  intensity: number;
  label: string;
  tick: number;
  persistent?: boolean;
};

export type MapArtifact = {
  id: string;
  kind: MapArtifactKind;
  countryId: string;
  provinceId?: string;
  label: string;
  strength: number;
  createdTick: number;
  updatedTick: number;
};

export type GameEvent = {
  id: string;
  type: GameEventType;
  tick: number;
  year: number;
  month: number;
  day: number;
  dateLabel: string;
  title: string;
  description: string;
  locationLabel?: string;
  factionLabel?: string;
  mapChangeSummary?: string;
  countryId?: string;
  mapEffects?: MapEffect[];
  mapFocusCountryIds?: string[];
  mapFocusProvinceIds?: string[];
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
  day: number;
  dateLabel: string;
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
  day: number;
  displayDate: string;
  appliedOrders: number;
  highlights: string[];
};

export type WorldIndicators = {
  avgStability: number;
  avgWealth: number;
  avgTension: number;
  conflictLevel: "Low" | "Medium" | "High";
};

export type SpatialKnowledgeTier = "limited" | "regional" | "global" | "orbital" | "lunar";

export type SpatialProgressState = {
  knowledgeTier: SpatialKnowledgeTier;
  knownCountryIds: string[];
  discoveryPercent: number;
  minZoom: number;
  spaceProgramScore: number;
  orbitUnlocked: boolean;
  moonUnlocked: boolean;
  briefingLabel: string;
};

export type EventWindow = {
  title: string;
  rangeLabel: string;
  activeEventId: string | null;
  eventIds: string[];
  startedTick: number;
  endedTick: number;
};

export type TimelineEntry = {
  id: string;
  snapshotId: string;
  tick: number;
  displayDate: string;
  title: string;
  subtitle: string;
  tone: TimelineTone;
};

export type RoundSnapshot = {
  id: string;
  tick: number;
  year: number;
  month: number;
  day: number;
  displayDate: string;
  countries: CountryState[];
  mapArtifacts: MapArtifact[];
  eventIds: string[];
  summary: string;
};

export type NavBadge = {
  id: string;
  label: string;
  value: string;
  tone: BadgeTone;
};

export type GameUiState = {
  activePanel: "none" | "actions" | "chats" | "advisor" | "events";
  selectedCountryId: string | null;
  viewedSnapshotId: string | null;
};

export type JumpOption = {
  step: JumpStep;
  label: string;
};

export type GameState = {
  id: string;
  presetId: PresetId;
  preset: PresetSummary;
  locale?: "fr" | "en";
  year: number;
  month: number;
  day: number;
  tick: number;
  displayDate: string;
  playerCountryId: string;
  playerCountryName: string;
  difficulty: DifficultyLevel;
  aiQuality: AIQuality;
  actionPoints: number;
  maxActionPoints: number;
  countries: CountryState[];
  mapArtifacts: MapArtifact[];
  selectedCountryId: string;
  selectedProvinceId?: string | null;
  selectedCountryName: string;
  events: GameEvent[];
  queuedOrders: TurnOrder[];
  diplomacyLog: DiplomacyExchange[];
  lastRoundSummary?: RoundSummary;
  indicators: WorldIndicators;
  quickActions: QuickAction[];
  eventWindow: EventWindow;
  timeline: TimelineEntry[];
  snapshots: RoundSnapshot[];
  tokenBalance: number;
  availableJumpOptions: JumpOption[];
  spatialProgress: SpatialProgressState;
  uiState: GameUiState;
};

export type PresetBrowserPayload = {
  presets: PresetSummary[];
  rails: PresetRail[];
  categories: PresetCategory[];
  navBadges: NavBadge[];
};

export type GameSessionSummary = {
  id: string;
  presetId: PresetId;
  presetTitle: string;
  coverImage: string;
  playerCountryName: string;
  displayDate: string;
  tick: number;
  lastUpdatedLabel: string;
  accent: string;
};

export type CreateGameInput = {
  presetId: PresetId;
  countryId: string;
  difficulty: DifficultyLevel;
  aiQuality: AIQuality;
  locale?: "fr" | "en";
};

export type QueueOrderInput = {
  gameId: string;
  text: string;
};

export type QuickActionInput = {
  gameId: string;
  targetCountryId: string;
  kind: QuickActionKind;
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
  day: number;
  dateLabel: string;
  snapshotId?: string;
  question?: string;
  insights: string[];
  suggestions: AdvisorSuggestion[];
};

export type AdvisorSuggestion = {
  id: string;
  label: string;
  actionTag: string;
  rationale: string;
  impact: string;
  kind: TurnOrderKind;
  urgency: "low" | "medium" | "high";
  orderText: string;
  targetCountryId?: string;
  targetCountryName?: string;
};
