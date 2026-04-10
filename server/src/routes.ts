import type {
  AdvisorResponse,
  CreateGameInput,
  DiplomacyInput,
  JumpInput,
  QuickActionInput,
  QueueOrderInput,
  RemoveOrderInput
} from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import {
  applyRoundNarrativePatch,
  jumpForward,
  jumpToMajorEvent,
  queueOrderWithOverrides,
  queueQuickAction,
  removeOrder,
  sendDiplomacyMessage
} from "./simulation.js";
import {
  createGame,
  formatDate,
  getGame,
  getGameSetupOptions,
  getPresetBrowser,
  listCountries,
  listGameSessions,
  listPresetCategories,
  listScenarios,
  monthLabel,
  saveGame
} from "./world.js";

function ensureString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function blocSummaryFromGame(gameId: string) {
  const game = getGame(gameId);
  if (!game) return "";
  const blocCounts = new Map<string, number>();
  for (const country of game.countries) {
    blocCounts.set(country.bloc, (blocCounts.get(country.bloc) ?? 0) + 1);
  }

  return [...blocCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bloc, count]) => `${bloc}(${count})`)
    .join(", ");
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resolveCountryIdByName(gameId: string, countryName: string): string | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;

  const wanted = normalizeLoose(countryName);
  if (!wanted) return undefined;

  const exact = game.countries.find((country) => normalizeLoose(country.name) === wanted);
  if (exact) return exact.id;

  const partial = game.countries.find((country) => normalizeLoose(country.name).includes(wanted) || wanted.includes(normalizeLoose(country.name)));
  return partial?.id;
}

function resolveMentionedCountryId(gameId: string, text: string): string | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;

  const normalizedText = normalizeLoose(text);
  return [...game.countries]
    .sort((a, b) => b.name.length - a.name.length)
    .find((country) => {
      const normalizedCountry = normalizeLoose(country.name);
      return normalizedCountry.length >= 3 && normalizedText.includes(normalizedCountry);
    })?.id;
}

function baselineDiplomacyOutcome(gameId: string, targetCountryId: string, message: string) {
  const game = getGame(gameId);
  const target = game?.countries.find((country) => country.id === targetCountryId);
  if (!target) return null;

  const normalized = normalizeLoose(message);
  const aggressive = /\b(attack|war|ultimatum|sanction|threat|invade)\b/.test(normalized);
  const cooperative = /\b(alliance|pact|trade|peace|cooperation|accord|understanding|intelligence sharing)\b/.test(normalized);

  if (aggressive || target.relationToPlayer <= -35 || target.tension >= 70) {
    return {
      stance: "hostile" as const,
      relationDelta: -10,
      tensionDelta: 4,
      stabilityDelta: 0
    };
  }

  if (cooperative || target.relationToPlayer >= 25 || target.tension <= 40) {
    return {
      stance: "friendly" as const,
      relationDelta: 10,
      tensionDelta: -3,
      stabilityDelta: 1
    };
  }

  return {
    stance: "neutral" as const,
    relationDelta: 1,
    tensionDelta: 0,
    stabilityDelta: 0
  };
}

function clampDiplomacyOutcome(gameId: string, targetCountryId: string, message: string, aiOutcome: {
  stance: "friendly" | "neutral" | "hostile";
  reply: string;
  relationDelta: number;
  tensionDelta: number;
  stabilityDelta: number;
}) {
  const game = getGame(gameId);
  const target = game?.countries.find((country) => country.id === targetCountryId);
  const baseline = baselineDiplomacyOutcome(gameId, targetCountryId, message);
  if (!game || !target || !baseline) return aiOutcome;

  let stance = aiOutcome.stance;
  let relationDelta = aiOutcome.relationDelta;
  let tensionDelta = aiOutcome.tensionDelta;
  let stabilityDelta = aiOutcome.stabilityDelta;

  if (baseline.stance === "hostile") {
    stance = "hostile";
    relationDelta = Math.min(relationDelta, baseline.relationDelta);
    tensionDelta = Math.max(tensionDelta, baseline.tensionDelta);
    stabilityDelta = Math.min(stabilityDelta, baseline.stabilityDelta);
  } else if (baseline.stance === "neutral" && aiOutcome.stance === "friendly" && target.relationToPlayer < 15) {
    stance = "neutral";
    relationDelta = Math.min(relationDelta, 2);
    tensionDelta = Math.max(tensionDelta, 0);
    stabilityDelta = Math.min(stabilityDelta, 0);
  }

  const alliedBloc = new Set(["france", "united kingdom", "united states", "poland"]);
  const axisBloc = new Set(["germany", "italy", "japan"]);
  const inOpposingWw2Blocs =
    game.preset.id === "world-war-ii" &&
    ((alliedBloc.has(game.playerCountryId) && axisBloc.has(targetCountryId)) ||
      (axisBloc.has(game.playerCountryId) && alliedBloc.has(targetCountryId)));

  if (inOpposingWw2Blocs) {
    stance = "hostile";
    relationDelta = Math.min(relationDelta, -8);
    tensionDelta = Math.max(tensionDelta, 2);
    stabilityDelta = Math.min(stabilityDelta, 0);
  }

  let reply = aiOutcome.reply;
  if (stance === "hostile" && /\b(accept|agreement|alliance|willingness|opening a negotiation|cooperate|cooperation|accord|understanding|friendship|shared future)\b/i.test(reply)) {
    reply = `${target.name} rejects the proposal, questions your intentions, and prepares for a harder line in the next exchanges.`;
  } else if (stance === "neutral" && /\b(accept|alliance|agreement reached)\b/i.test(reply)) {
    reply = `${target.name} acknowledges your message but avoids any firm commitment for now.`;
  }

  return {
    stance,
    reply,
    relationDelta,
    tensionDelta,
    stabilityDelta
  };
}

function describeWorldPressure(gameId: string): string {
  const game = getGame(gameId);
  if (!game) return "";
  return `Global stability ${game.indicators.avgStability}, wealth ${game.indicators.avgWealth}, tension ${game.indicators.avgTension}, conflict ${game.indicators.conflictLevel}.`;
}

function sanitizeRoundNarrativeLegacy(gameId: string, narrative: Awaited<ReturnType<AIProvider["generateRoundNarrative"]>>) {
  const game = getGame(gameId);
  if (!game) return narrative;

  const cleanedMapChange = /->|→|attack|defend/i.test(narrative.mapChangeSummary)
    ? narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Fronts are tightening and military pressure is becoming visible on the map."
      : "Recent moves altered the pressure, posture, and diplomatic balance across the map."
    : narrative.mapChangeSummary;

  const cleanedHighlights = (narrative.highlights ?? []).map((line) => {
    if (/->|→/.test(line)) {
      return `${game.playerCountryName} and its rivals adjusted posture after the latest orders.`;
    }
    return line;
  });

  return {
    ...narrative,
    mapChangeSummary: cleanedMapChange,
    highlights: cleanedHighlights.length > 0 ? cleanedHighlights : narrative.highlights
  };
}

function normalizeNarrativeText(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[*`#_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePromptDump(value: string): boolean {
  const normalized = value.toLowerCase();
  return [
    "event card",
    "orders summary",
    "applied orders",
    "world pressure",
    "global stability",
    "latest event in log",
    "averages",
    "from:",
    "to:"
  ].some((token) => normalized.includes(token));
}

function sanitizeRoundNarrative(gameId: string, narrative: Awaited<ReturnType<AIProvider["generateRoundNarrative"]>>) {
  const game = getGame(gameId);
  if (!game) return narrative;

  const fallbackTitle =
    narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Regional Tension Intensifies"
      : "Round Update";
  const fallbackDescription = `${game.playerCountryName} advances into ${game.displayDate} with ${game.lastRoundSummary?.appliedOrders ?? 0} resolved orders. Global stability is ${game.indicators.avgStability} and tension is ${game.indicators.avgTension}.`;
  const fallbackMapSummary =
    narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Frontline pressure has increased, with visible military and crisis activity."
      : "Recent actions adjusted military posture, diplomacy, and domestic pressure across the map.";

  const cleanedTitle = normalizeNarrativeText(narrative.title);
  const cleanedDescription = normalizeNarrativeText(narrative.description);
  const cleanedMapInput = normalizeNarrativeText(narrative.mapChangeSummary);
  const mergedForValidation = `${cleanedTitle} ${cleanedDescription} ${cleanedMapInput}`;
  const shouldFallback = looksLikePromptDump(mergedForValidation) || cleanedDescription.length < 26;

  const cleanedMapChange = /->|→|â†’|attack|defend/i.test(cleanedMapInput)
    ? fallbackMapSummary
    : cleanedMapInput.length > 0
      ? cleanedMapInput
      : fallbackMapSummary;

  const cleanedHighlights = (narrative.highlights ?? [])
    .map((line) => normalizeNarrativeText(line))
    .filter((line) => line.length > 0 && line.length <= 180 && !looksLikePromptDump(line))
    .map((line) => (
      /->|→|â†’/.test(line)
        ? `${game.playerCountryName} and its rivals adjusted posture after the latest orders.`
        : line
    ));

  const fallbackHighlights = (game.lastRoundSummary?.highlights ?? [])
    .map((line) => normalizeNarrativeText(line))
    .filter((line) => line.length > 0)
    .slice(0, 4);

  return {
    ...narrative,
    title: shouldFallback ? fallbackTitle : (cleanedTitle || fallbackTitle),
    description: shouldFallback ? fallbackDescription : (cleanedDescription || fallbackDescription),
    mapChangeSummary: shouldFallback ? fallbackMapSummary : cleanedMapChange,
    highlights: cleanedHighlights.length > 0 ? cleanedHighlights : (fallbackHighlights.length > 0 ? fallbackHighlights : narrative.highlights)
  };
}

async function enrichJumpNarrative(ai: AIProvider, gameId: string, fromDateLabel: string): Promise<void> {
  const game = getGame(gameId);
  if (!game || !game.lastRoundSummary) return;

  const eventWindowOrders = game.eventWindow.eventIds
    .map((eventId) => game.events.find((event) => event.id === eventId) ?? null)
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .filter((event) => event.type === "order")
    .map((event) => event.description);

  const ordersText = eventWindowOrders.length > 0
    ? eventWindowOrders.join(" ")
    : game.lastRoundSummary.highlights.join(" ");

  const rawNarrative = await ai.generateRoundNarrative({
    presetTitle: game.preset.title,
    playerCountryName: game.playerCountryName,
    fromDateLabel,
    toDateLabel: game.displayDate,
    appliedOrders: game.lastRoundSummary.appliedOrders,
    ordersText,
    avgRichness: game.indicators.avgWealth,
    avgStability: game.indicators.avgStability,
    avgTension: game.indicators.avgTension,
    latestEventText: game.events[0]?.title,
    worldPressureText: describeWorldPressure(gameId)
  });
  const narrative = sanitizeRoundNarrative(gameId, rawNarrative);

  applyRoundNarrativePatch(game, narrative);
}

export function registerRoutes(app: import("express").Express, ai: AIProvider): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "genesis-engine-server", aiProvider: ai.providerName });
  });

  app.get("/scenarios", (_req: Request, res: Response) => {
    res.json(listScenarios());
  });

  app.get("/presets", (_req: Request, res: Response) => {
    res.json(getPresetBrowser());
  });

  app.get("/presets/categories", (_req: Request, res: Response) => {
    res.json(listPresetCategories());
  });

  app.get("/presets/:presetId/setup", (req: Request, res: Response) => {
    const presetId = ensureString(req.params.presetId);
    res.json(getGameSetupOptions(presetId));
  });

  app.get("/countries", (req: Request, res: Response) => {
    const presetId = ensureString(req.query.presetId);
    res.json(listCountries(presetId));
  });

  app.get("/games", (_req: Request, res: Response) => {
    res.json(listGameSessions());
  });

  app.post("/game/start", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<CreateGameInput>;
    const presetId = ensureString(payload.presetId);
    const countryId = ensureString(payload.countryId);
    const difficulty = ensureString(payload.difficulty) as CreateGameInput["difficulty"];
    const aiQuality = ensureString(payload.aiQuality) as CreateGameInput["aiQuality"];

    if (!presetId || !countryId || !difficulty || !aiQuality) {
      res.status(400).json({ error: "presetId, countryId, difficulty and aiQuality are required" });
      return;
    }

    const game = createGame({ presetId, countryId, difficulty, aiQuality });
    res.status(201).json(game);
  });

  app.get("/game/:gameId", (req: Request, res: Response) => {
    const gameId = ensureString(req.params.gameId);
    const game = getGame(gameId);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(game);
  });

  app.post("/game/order", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<QueueOrderInput>;
    const gameId = ensureString(payload.gameId);
    const text = ensureString(payload.text);

    if (!gameId || !text) {
      res.status(400).json({ error: "gameId and text are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const interpretation = await ai.interpretOrder({
        presetTitle: game.preset.title,
        playerCountryName: game.playerCountryName,
        dateLabel: game.displayDate,
        orderText: text,
        countries: game.countries.map((country) => ({ id: country.id, name: country.name }))
      });
      const aiTargetCountryId = resolveCountryIdByName(gameId, interpretation.targetCountryName);
      const mentionedCountryId = resolveMentionedCountryId(gameId, text);
      const targetCountryId =
        aiTargetCountryId && !(aiTargetCountryId === game.playerCountryId && mentionedCountryId && mentionedCountryId !== game.playerCountryId)
          ? aiTargetCountryId
          : mentionedCountryId ?? aiTargetCountryId;
      const updated = queueOrderWithOverrides(game, text, {
        kind: interpretation.kind,
        targetCountryId,
        cleanedText: interpretation.cleanedText
      });
      res.json(updated);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to queue order" });
    }
  });

  app.post("/game/quick-action", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<QuickActionInput>;
    const gameId = ensureString(payload.gameId);
    const targetCountryId = ensureString(payload.targetCountryId);
    const kind = ensureString(payload.kind) as QuickActionInput["kind"];

    if (!gameId || !targetCountryId || !kind) {
      res.status(400).json({ error: "gameId, targetCountryId and kind are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const updated = queueQuickAction(game, targetCountryId, kind);
      res.json(updated);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to queue quick action" });
    }
  });

  app.post("/game/order/remove", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<RemoveOrderInput>;
    const gameId = ensureString(payload.gameId);
    const orderId = ensureString(payload.orderId);

    if (!gameId || !orderId) {
      res.status(400).json({ error: "gameId and orderId are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const updated = removeOrder(game, orderId);
      res.json(updated);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Unable to remove order" });
    }
  });

  app.post("/game/jump", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<JumpInput>;
    const gameId = ensureString(payload.gameId);
    const step = ensureString(payload.step);

    if (!gameId || !step) {
      res.status(400).json({ error: "gameId and step are required" });
      return;
    }

    if (!["week", "month", "six_months", "year"].includes(step)) {
      res.status(400).json({ error: "step must be week, month, six_months or year" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const fromDateLabel = game.displayDate;
    const updated = jumpForward(game, step as JumpInput["step"]);
    await enrichJumpNarrative(ai, updated.id, fromDateLabel);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/jump/major-event", async (req: Request, res: Response) => {
    const gameId = ensureString(req.body?.gameId);
    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const fromDateLabel = game.displayDate;
    const updated = jumpToMajorEvent(game);
    await enrichJumpNarrative(ai, updated.id, fromDateLabel);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/diplomacy", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<DiplomacyInput>;
    const gameId = ensureString(payload.gameId);
    const targetCountryId = ensureString(payload.targetCountryId);
    const message = ensureString(payload.message);

    if (!gameId || !targetCountryId || !message) {
      res.status(400).json({ error: "gameId, targetCountryId and message are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const target = game.countries.find((country) => country.id === targetCountryId);
      const aiOutcome = target
        ? await ai.generateDiplomacyReply({
          presetTitle: game.preset.title,
          playerCountryName: game.playerCountryName,
          targetCountryName: target.name,
          dateLabel: game.displayDate,
          message,
          relationToPlayer: target.relationToPlayer,
          tension: target.tension,
          stability: target.stability
        })
        : undefined;

      const outcome = aiOutcome ? clampDiplomacyOutcome(gameId, targetCountryId, message, aiOutcome) : undefined;
      const exchange = sendDiplomacyMessage(game, targetCountryId, message, outcome);
      res.json(exchange);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Diplomacy failed" });
    }
  });

  app.post("/game/advisor", async (req: Request, res: Response) => {
    const gameId = ensureString(req.body?.gameId);
    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const narrative = await ai.generateWorldNarrative({
      worldName: game.preset.title,
      scenarioId: game.presetId,
      year: game.year,
      tick: game.tick,
      role: "nation",
      kind: game.preset.category,
      complexity: game.aiQuality.toLowerCase(),
      actionPoints: game.actionPoints,
      maxActionPoints: game.maxActionPoints,
      avgRichness: game.indicators.avgWealth,
      avgStability: game.indicators.avgStability,
      avgTension: game.indicators.avgTension,
      factionsText: blocSummaryFromGame(gameId),
      latestEventText: game.events[0]?.title
    });

    game.tokenBalance = Number(Math.max(0.111, game.tokenBalance - 0.034).toFixed(3));
    saveGame(game);

    const cleanedNarrative = narrative
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/\s+/g, " ");
    const response: AdvisorResponse = {
      provider: ai.providerName,
      narrative: `${monthLabel(game.month)} ${game.day}, ${game.year} | ${cleanedNarrative}`,
      tick: game.tick,
      year: game.year,
      month: game.month,
      day: game.day,
      dateLabel: formatDate(game.year, game.month, game.day)
    };

    res.json(response);
  });
}
