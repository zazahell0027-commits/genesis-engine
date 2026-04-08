import type { AIProvider, WorldNarrativeInput } from "../types.js";

function tensionLabel(avgTension: number): string {
  if (avgTension >= 65) return "very unstable";
  if (avgTension >= 50) return "under pressure";
  return "relatively calm";
}

export class MockProvider implements AIProvider {
  providerName = "mock";

  async summarizeWorld(input: { worldName: string; tick: number }): Promise<string> {
    return `Mock summary: ${input.worldName} at tick ${input.tick}.`;
  }

  async generateWorldNarrative(input: WorldNarrativeInput): Promise<string> {
    const tone = tensionLabel(input.avgTension);
    const latest = input.latestEventText
      ? `Latest event: ${input.latestEventText}.`
      : "No major event reported yet.";

    return [
      `${input.worldName} | scenario ${input.scenarioId} | year ${input.year}.`,
      `Tick ${input.tick}: world is ${tone}, stability ${input.avgStability}, wealth ${input.avgRichness}.`,
      `Action points ${input.actionPoints}/${input.maxActionPoints}. Factions: ${input.factionsText}.`,
      latest
    ].join(" ");
  }
}
