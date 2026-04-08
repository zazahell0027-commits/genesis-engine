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

export type AIProvider = {
  providerName: string;
  summarizeWorld(input: { worldName: string; tick: number }): Promise<string>;
  generateWorldNarrative(input: WorldNarrativeInput): Promise<string>;
};
