import type {
  AdvisorResponse,
  CreateGameInput,
  DiplomacyInput,
  JumpInput,
  QueueOrderInput,
  RemoveOrderInput
} from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import { jumpForward, jumpToMajorEvent, queueOrder, removeOrder, sendDiplomacyMessage } from "./simulation.js";
import { getGame, listCountries, listScenarios, monthLabel, saveGame, createGame } from "./world.js";

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

export function registerRoutes(app: import("express").Express, ai: AIProvider): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "genesis-engine-server", aiProvider: ai.providerName });
  });

  app.get("/scenarios", (_req: Request, res: Response) => {
    res.json(listScenarios());
  });

  app.get("/countries", (req: Request, res: Response) => {
    const scenarioId = ensureString(req.query.scenarioId);
    res.json(listCountries(scenarioId === "earth-2010" ? "earth-2010" : undefined));
  });

  app.post("/game/start", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<CreateGameInput>;
    const scenarioId = ensureString(payload.scenarioId) === "earth-2010" ? "earth-2010" : "earth-2010";
    const countryId = ensureString(payload.countryId);

    if (!countryId) {
      res.status(400).json({ error: "countryId is required" });
      return;
    }

    const game = createGame({ scenarioId, countryId });
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

  app.post("/game/order", (req: Request, res: Response) => {
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
      const updated = queueOrder(game, text);
      res.json(updated);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to queue order" });
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

  app.post("/game/jump", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<JumpInput>;
    const gameId = ensureString(payload.gameId);
    const step = ensureString(payload.step);

    if (!gameId || !step) {
      res.status(400).json({ error: "gameId and step are required" });
      return;
    }

    if (!["week", "month", "quarter", "year"].includes(step)) {
      res.status(400).json({ error: "step must be week, month, quarter or year" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const updated = jumpForward(game, step as JumpInput["step"]);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/jump/major-event", (req: Request, res: Response) => {
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

    const updated = jumpToMajorEvent(game);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/diplomacy", (req: Request, res: Response) => {
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
      const exchange = sendDiplomacyMessage(game, targetCountryId, message);
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
      worldName: game.scenarioName,
      scenarioId: game.scenarioId,
      year: game.year,
      tick: game.tick,
      role: "nation",
      kind: "historical",
      complexity: "medium",
      actionPoints: game.actionPoints,
      maxActionPoints: game.maxActionPoints,
      avgRichness: game.indicators.avgWealth,
      avgStability: game.indicators.avgStability,
      avgTension: game.indicators.avgTension,
      factionsText: blocSummaryFromGame(gameId),
      latestEventText: game.events[0]?.title
    });

    const response: AdvisorResponse = {
      provider: ai.providerName,
      narrative: `${monthLabel(game.month)} ${game.year} | ${narrative}`,
      tick: game.tick,
      year: game.year,
      month: game.month
    };

    res.json(response);
  });
}
