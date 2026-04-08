import type { AIProvider, WorldNarrativeInput } from "../types.js";

function tensionLabel(avgTension: number): string {
  if (avgTension >= 65) return "très instable";
  if (avgTension >= 50) return "sous tension";
  return "relativement calme";
}

export class MockProvider implements AIProvider {
  providerName = "mock";

  async summarizeWorld(input: { worldName: string; tick: number }): Promise<string> {
    return `Mock summary: ${input.worldName} au tick ${input.tick}.`;
  }

  async generateWorldNarrative(input: WorldNarrativeInput): Promise<string> {
    const tone = tensionLabel(input.avgTension);
    const latest = input.latestEventText
      ? `Dernier événement: ${input.latestEventText}.`
      : "Aucun événement majeur signalé pour l'instant.";

    return [
      `Tick ${input.tick} - ${input.worldName} est ${tone}.`,
      `Stabilité moyenne ${input.avgStability}, richesse moyenne ${input.avgRichness}.`,
      `Contexte factions: ${input.factionsText}.`,
      latest
    ].join(" ");
  }
}
