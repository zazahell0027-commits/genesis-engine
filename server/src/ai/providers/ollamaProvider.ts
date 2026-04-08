import type { AIProvider, WorldNarrativeInput } from "../types.js";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

export class OllamaProvider implements AIProvider {
  providerName = "ollama";
  private cachedModel: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly fallback: AIProvider
  ) {}

  async summarizeWorld(input: { worldName: string; tick: number }): Promise<string> {
    return this.generateText(
      "Résumé technique court du monde",
      `Monde: ${input.worldName}. Tick: ${input.tick}. Résume en 1 phrase.`,
      () => this.fallback.summarizeWorld(input)
    );
  }

  async generateWorldNarrative(input: WorldNarrativeInput): Promise<string> {
    const prompt = [
      `Monde: ${input.worldName}`,
      `Type: ${input.kind}`,
      `Rôle joueur: ${input.role}`,
      `Complexité: ${input.complexity}`,
      `Tick: ${input.tick}`,
      `Moyennes => richesse ${input.avgRichness}, stabilité ${input.avgStability}, tensions ${input.avgTension}`,
      `Factions: ${input.factionsText}`,
      input.latestEventText ? `Dernier événement: ${input.latestEventText}` : "Pas d'événement récent.",
      "Rédige une narration immersive en français (3 phrases), orientée jeu de stratégie narratif, sans inventer de mécanique absente."
    ].join("\n");

    return this.generateText("Narrateur de simulation", prompt, () => this.fallback.generateWorldNarrative(input));
  }

  private async generateText(
    systemPrompt: string,
    userPrompt: string,
    fallbackFn: () => Promise<string>
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const model = await this.resolveModel(controller.signal);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama error ${response.status}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const content = data.message?.content?.trim();

      if (!content) {
        throw new Error("Ollama returned empty content");
      }

      return content;
    } catch {
      return fallbackFn();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveModel(signal: AbortSignal): Promise<string> {
    if (this.cachedModel) {
      return this.cachedModel;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal });
      if (!response.ok) {
        this.cachedModel = this.model;
        return this.cachedModel;
      }

      const payload = (await response.json()) as OllamaTagsResponse;
      const available = (payload.models ?? [])
        .map((model) => model.model ?? model.name)
        .filter((name): name is string => Boolean(name));

      if (available.length === 0) {
        this.cachedModel = this.model;
        return this.cachedModel;
      }

      if (available.includes(this.model)) {
        this.cachedModel = this.model;
        return this.cachedModel;
      }

      const preferredFallbacks = ["mistral:latest", "gemma3:4b", "deepseek-r1:8b"];
      const fallback = preferredFallbacks.find((name) => available.includes(name));
      this.cachedModel = fallback ?? available[0];
      return this.cachedModel;
    } catch {
      this.cachedModel = this.model;
      return this.cachedModel;
    }
  }
}
