import type {
  AIProvider,
  DiplomacyReply,
  DiplomacyReplyInput,
  OrderInterpretation,
  OrderInterpretationInput,
  RoundNarrative,
  RoundNarrativeInput,
  WorldNarrativeInput
} from "../types.js";

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

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

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
      "You are a concise technical summarizer for a strategy game world state.",
      `World: ${input.worldName}. Tick: ${input.tick}. Return one concise sentence.`,
      () => this.fallback.summarizeWorld(input)
    );
  }

  async generateWorldNarrative(input: WorldNarrativeInput): Promise<string> {
    const prompt = [
      `World: ${input.worldName}`,
      `Scenario: ${input.scenarioId}`,
      `Year: ${input.year}`,
      `Type: ${input.kind}`,
      `Player role: ${input.role}`,
      `Complexity: ${input.complexity}`,
      `Tick: ${input.tick}`,
      `Action points: ${input.actionPoints}/${input.maxActionPoints}`,
      `Averages: wealth ${input.avgRichness}, stability ${input.avgStability}, tension ${input.avgTension}`,
      `Factions: ${input.factionsText}`,
      input.latestEventText ? `Latest event: ${input.latestEventText}` : "No recent event.",
      "Write a sharp strategy-game advisor briefing in English, 3 sentences max, with cause and consequence."
    ].join("\n");

    return this.generateText(
      "You are the advisor of an alternate-history grand strategy game. Be concrete, concise, and useful.",
      prompt,
      () => this.fallback.generateWorldNarrative(input)
    );
  }

  async interpretOrder(input: OrderInterpretationInput): Promise<OrderInterpretation> {
    const countriesText = input.countries.map((country) => country.name).join(", ");
    const schema = {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["stabilize", "invest", "pressure", "military", "attack", "defend", "diplomacy"]
        },
        targetCountryName: { type: "string" },
        cleanedText: { type: "string" }
      },
      required: ["kind", "targetCountryName", "cleanedText"]
    };

    return this.generateJson<OrderInterpretation>(
      "You classify player orders for a grand strategy simulation. Choose the single best order kind and the primary target country from the provided list. If the order is defensive but names a threatening rival, target that rival rather than the player's own country. Return only valid JSON.",
      [
        `Scenario: ${input.presetTitle}`,
        `Player country: ${input.playerCountryName}`,
        `Date: ${input.dateLabel}`,
        `Valid countries: ${countriesText}`,
        `Player order: ${input.orderText}`,
        "Normalize the order text into one concise actionable sentence."
      ].join("\n"),
      schema,
      () => this.fallback.interpretOrder(input)
    );
  }

  async generateDiplomacyReply(input: DiplomacyReplyInput): Promise<DiplomacyReply> {
    const schema = {
      type: "object",
      properties: {
        stance: { type: "string", enum: ["friendly", "neutral", "hostile"] },
        reply: { type: "string" },
        relationDelta: { type: "integer", minimum: -20, maximum: 20 },
        tensionDelta: { type: "integer", minimum: -10, maximum: 10 },
        stabilityDelta: { type: "integer", minimum: -5, maximum: 5 }
      },
      required: ["stance", "reply", "relationDelta", "tensionDelta", "stabilityDelta"]
    };

    return this.generateJson<DiplomacyReply>(
      "You write plausible diplomatic replies for a grand strategy alternate-history game. Respect scenario logic, current tensions, and historical hostility. Do not make rivals instantly cooperative without a very strong reason. Reply in English only. If the stance is hostile, the answer must sound rejecting, suspicious, or threatening and must not use conciliatory language about cooperation, alliance, or agreement. Return only valid JSON.",
      [
        `Scenario: ${input.presetTitle}`,
        `Date: ${input.dateLabel}`,
        `Player country: ${input.playerCountryName}`,
        `Target country: ${input.targetCountryName}`,
        `Current relation to player: ${input.relationToPlayer}`,
        `Current target tension: ${input.tension}`,
        `Current target stability: ${input.stability}`,
        `Incoming message: ${input.message}`,
        "The reply should feel like a state response, not a chatbot answer.",
        "Keep the reply to 1 or 2 short paragraphs."
      ].join("\n"),
      schema,
      () => this.fallback.generateDiplomacyReply(input)
    );
  }

  async generateRoundNarrative(input: RoundNarrativeInput): Promise<RoundNarrative> {
    const schema = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["system", "order", "diplomacy", "advisor", "major_diplomacy", "major_crisis", "major_conflict", "major_growth"]
        },
        title: { type: "string" },
        description: { type: "string" },
        mapChangeSummary: { type: "string" },
        factionLabel: { type: "string" },
        locationLabel: { type: "string" },
        highlights: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string" }
        }
      },
      required: ["type", "title", "description", "mapChangeSummary", "factionLabel", "locationLabel", "highlights"]
    };

    return this.generateJson<RoundNarrative>(
      "You generate an event card for a grand strategy alternate-history game. Return only valid JSON. Make the output feel like an in-game event window.",
      [
        `Scenario: ${input.presetTitle}`,
        `Player country: ${input.playerCountryName}`,
        `From: ${input.fromDateLabel}`,
        `To: ${input.toDateLabel}`,
        `Applied orders: ${input.appliedOrders}`,
        `Orders summary: ${input.ordersText}`,
        `World pressure: ${input.worldPressureText}`,
        `Averages: wealth ${input.avgRichness}, stability ${input.avgStability}, tension ${input.avgTension}`,
        input.latestEventText ? `Latest event in log: ${input.latestEventText}` : "No major prior event.",
        "Write crisp English suitable for a Pax Historia-like event panel."
      ].join("\n"),
      schema,
      () => this.fallback.generateRoundNarrative(input)
    );
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
          ],
          options: {
            temperature: 0.35
          }
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

  private async generateJson<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    const raw = await this.generateTextWithFormat(systemPrompt, userPrompt, schema);
    if (!raw) {
      return fallbackFn();
    }

    try {
      return JSON.parse(extractJsonObject(raw)) as T;
    } catch {
      return fallbackFn();
    }
  }

  private async generateTextWithFormat(
    systemPrompt: string,
    userPrompt: string,
    format: Record<string, unknown>
  ): Promise<string | null> {
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
          format,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          options: {
            temperature: 0.2
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OllamaChatResponse;
      return data.message?.content?.trim() ?? null;
    } catch {
      return null;
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

      const preferredFallbacks = ["gpt-oss:20b", "deepseek-r1:8b", "mistral:latest", "gemma3:4b", "qwen3-vl:8b"];
      const fallback = preferredFallbacks.find((name) => available.includes(name));
      this.cachedModel = fallback ?? available[0];
      return this.cachedModel;
    } catch {
      this.cachedModel = this.model;
      return this.cachedModel;
    }
  }
}
