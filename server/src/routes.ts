import { HISTORICAL_START_COUNTRIES, type EventType, type PlayerActionType, type World } from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import {
  applyPlayerAction,
  canAffordAction,
  queuePlayerAction,
  removeQueuedPlayerAction,
  removeTurnCommand,
  resolveWorldTurn,
  submitTurnCommand,
  tickWorld,
  triggerWorldEvent
} from "./simulation.js";
import { createDemoWorld, createWorld, getWorld, saveWorld } from "./world.js";

const historicalCountrySet = new Set<string>(HISTORICAL_START_COUNTRIES);

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function factionSummary(world: World): string {
  return world.factions
    .map((faction) => `${faction.name}(P${faction.power}/R${faction.resources})`)
    .join(", ");
}

function latestEventText(world: World): string | undefined {
  const event = world.events[0];
  if (!event) return undefined;
  return `${event.title}: ${event.description}`;
}

function isHistoricalStartCountry(value: unknown): boolean {
  return typeof value === "string" && historicalCountrySet.has(value);
}

function isAllowedAction(value: unknown): value is PlayerActionType {
  return typeof value === "string" && ["stabilize", "invest", "influence", "disrupt", "incite"].includes(value);
}

function actionTargetGuard(world: World, cellId: string): { ok: true } | { ok: false; status: number; body: object } {
  const target = world.cells.find((cell) => cell.id === cellId);
  if (!target) {
    return { ok: false, status: 404, body: { error: "Cell not found" } };
  }

  if (world.countryLocked && world.role === "nation" && world.playerFactionId && target.owner !== world.playerFactionId) {
    return {
      ok: false,
      status: 403,
      body: {
        error: `Territory not controlled by your nation (${world.playerCountry ?? "locked country"}).`,
        playerFactionId: world.playerFactionId,
        playerCountry: world.playerCountry
      }
    };
  }

  return { ok: true };
}

export function registerRoutes(app: import("express").Express, ai: AIProvider): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "genesis-engine-server", aiProvider: ai.providerName });
  });

  app.get("/world/:worldId", (req: Request, res: Response) => {
    const worldId = String(req.params.worldId ?? "").trim();
    const world = getWorld(worldId);

    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    res.json(world);
  });

  app.post("/world/create", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as {
      kind?: string;
      startCountry?: unknown;
    };

    if (payload.kind === "historical" && payload.startCountry !== undefined && !isHistoricalStartCountry(payload.startCountry)) {
      res.status(400).json({
        error: `Invalid startCountry. Allowed values: ${HISTORICAL_START_COUNTRIES.join(", ")}`
      });
      return;
    }

    const world = createWorld(req.body ?? {});
    res.status(201).json(world);
  });

  app.post("/world/demo", (_req: Request, res: Response) => {
    const world = createDemoWorld();
    res.status(201).json(world);
  });

  app.post("/world/tick", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    if (!worldId) {
      res.status(400).json({ error: "worldId is required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = tickWorld(world);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/event", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const type = req.body?.type as EventType | undefined;

    if (!worldId) {
      res.status(400).json({ error: "worldId is required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = triggerWorldEvent(world, type);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/action/queue", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const cellId = String(req.body?.cellId ?? "").trim();
    const action = req.body?.action;

    if (!worldId || !cellId || !action) {
      res.status(400).json({ error: "worldId, cellId and action are required" });
      return;
    }

    if (!isAllowedAction(action)) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const guard = actionTargetGuard(world, cellId);
    if (!guard.ok) {
      res.status(guard.status).json(guard.body);
      return;
    }

    if (!canAffordAction(world, action)) {
      res.status(409).json({
        error: "Not enough action points",
        actionPoints: world.actionPoints,
        maxActionPoints: world.maxActionPoints
      });
      return;
    }

    const updated = queuePlayerAction(world, cellId, action);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/action/remove", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const queuedActionId = String(req.body?.queuedActionId ?? "").trim();

    if (!worldId || !queuedActionId) {
      res.status(400).json({ error: "worldId and queuedActionId are required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = removeQueuedPlayerAction(world, queuedActionId);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/command/submit", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const text = String(req.body?.text ?? "").trim();

    if (!worldId || !text) {
      res.status(400).json({ error: "worldId and text are required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    if (world.queuedActions.length >= world.maxActionPoints || world.actionPoints <= 0) {
      res.status(409).json({
        error: "No available order slots this turn",
        actionPoints: world.actionPoints,
        maxActionPoints: world.maxActionPoints
      });
      return;
    }

    const before = world.submittedCommands.length;
    const updated = submitTurnCommand(world, text);
    if (updated.submittedCommands.length === before) {
      res.status(422).json({ error: "Unable to parse or queue this command" });
      return;
    }

    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/command/remove", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const commandId = String(req.body?.commandId ?? "").trim();

    if (!worldId || !commandId) {
      res.status(400).json({ error: "worldId and commandId are required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = removeTurnCommand(world, commandId);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/resolve", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    if (!worldId) {
      res.status(400).json({ error: "worldId is required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = resolveWorldTurn(world);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/action", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const cellId = String(req.body?.cellId ?? "").trim();
    const action = req.body?.action;

    if (!worldId || !cellId || !action) {
      res.status(400).json({ error: "worldId, cellId and action are required" });
      return;
    }

    if (!isAllowedAction(action)) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const guard = actionTargetGuard(world, cellId);
    if (!guard.ok) {
      res.status(guard.status).json(guard.body);
      return;
    }

    if (!canAffordAction(world, action)) {
      res.status(409).json({
        error: "Not enough action points",
        actionPoints: world.actionPoints,
        maxActionPoints: world.maxActionPoints
      });
      return;
    }

    const updated = applyPlayerAction(world, cellId, action);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/briefing", async (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    if (!worldId) {
      res.status(400).json({ error: "worldId is required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const avgRichness = average(world.cells.map((cell) => cell.richness));
    const avgStability = average(world.cells.map((cell) => cell.stability));
    const avgTension = average(world.cells.map((cell) => cell.tension));

    const narrative = await ai.generateWorldNarrative({
      worldName: world.name,
      scenarioId: world.scenarioId,
      year: world.year,
      tick: world.tick,
      role: world.role,
      kind: world.kind,
      complexity: world.complexity,
      actionPoints: world.actionPoints,
      maxActionPoints: world.maxActionPoints,
      avgRichness,
      avgStability,
      avgTension,
      factionsText: factionSummary(world),
      latestEventText: latestEventText(world)
    });

    res.json({
      provider: ai.providerName,
      narrative,
      tick: world.tick
    });
  });
}
