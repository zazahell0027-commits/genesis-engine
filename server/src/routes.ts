import type { EventType, PlayerActionType, World } from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import {
  applyPlayerAction,
  canAffordAction,
  type JumpStep,
  jumpToNextMajorEvent,
  jumpWorld,
  queuePlayerAction,
  removeQueuedPlayerAction,
  removeTurnCommand,
  resolveWorldTurn,
  submitTurnCommand,
  tickWorld,
  triggerWorldEvent
} from "./simulation.js";
import { createDemoWorld, createWorld, getWorld, saveWorld } from "./world.js";

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

function isAllowedAction(value: unknown): value is PlayerActionType {
  return typeof value === "string" && ["stabilize", "invest", "influence", "disrupt", "incite"].includes(value);
}

function isJumpStep(value: unknown): value is JumpStep {
  return typeof value === "string" && ["week", "month", "quarter", "year"].includes(value);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function averageByCountry(world: World, country: string): { avgStability: number; avgTension: number } | null {
  const target = normalizeText(country);
  const matches = world.cells.filter((cell) => normalizeText(cell.country) === target);
  if (matches.length === 0) return null;

  const avgStability = Math.round(matches.reduce((sum, cell) => sum + cell.stability, 0) / matches.length);
  const avgTension = Math.round(matches.reduce((sum, cell) => sum + cell.tension, 0) / matches.length);
  return { avgStability, avgTension };
}

function buildDiplomacyReply(world: World, targetCountry: string, message: string): {
  stance: "friendly" | "neutral" | "hostile";
  reply: string;
} {
  const normalized = normalizeText(message);
  const countryStats = averageByCountry(world, targetCountry);

  const aggression = /\b(guerre|attaque|ultimatum|sanction|annex|menace)\b/.test(normalized);
  const cooperation = /\b(alliance|accord|paix|commerce|cooperation|pacte)\b/.test(normalized);
  const avgTension = countryStats?.avgTension ?? 50;

  if (aggression || avgTension >= 68) {
    return {
      stance: "hostile",
      reply: `${targetCountry} rejette votre ligne et renforce sa posture defensive. Reponse probable: contre-pression diplomatique et mobilisation limitee.`
    };
  }

  if (cooperation || avgTension <= 38) {
    return {
      stance: "friendly",
      reply: `${targetCountry} accepte d'ouvrir un canal de negociation. Reponse probable: accord graduel sur commerce, securite et stabilisation regionale.`
    };
  }

  return {
    stance: "neutral",
    reply: `${targetCountry} reste prudent. Reponse probable: discussion technique sans engagement immediat, demande de garanties concretes.`
  };
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
    const payload = (req.body ?? {}) as { startCountry?: unknown };
    if (payload.startCountry !== undefined && typeof payload.startCountry !== "string") {
      res.status(400).json({ error: "startCountry must be a string when provided" });
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

  app.post("/world/jump", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const step = req.body?.step;

    if (!worldId) {
      res.status(400).json({ error: "worldId is required" });
      return;
    }

    if (!isJumpStep(step)) {
      res.status(400).json({ error: "step must be one of: week, month, quarter, year" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const updated = jumpWorld(world, step);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/jump/major-event", (req: Request, res: Response) => {
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

    const updated = jumpToNextMajorEvent(world);
    saveWorld(updated);
    res.json(updated);
  });

  app.post("/world/diplomacy/send", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const targetCountry = String(req.body?.targetCountry ?? "").trim();
    const message = String(req.body?.message ?? "").trim();

    if (!worldId || !targetCountry || !message) {
      res.status(400).json({ error: "worldId, targetCountry and message are required" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    const { stance, reply } = buildDiplomacyReply(world, targetCountry, message);

    world.events.unshift({
      id: `${world.id}-evt-diplo-${world.tick}-${world.events.length + 1}`,
      tick: world.tick,
      type: stance === "hostile" ? "troubles" : "alliance",
      title: `Diplomatic Exchange: ${targetCountry}`,
      description: `${message.slice(0, 140)} | Reply: ${reply}`
    });
    if (world.events.length > 80) {
      world.events = world.events.slice(0, 80);
    }

    saveWorld(world);
    res.json({ targetCountry, stance, reply, tick: world.tick, year: world.year });
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
