import type { EventType, PlayerActionType, World } from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import { applyPlayerAction, tickWorld, triggerWorldEvent } from "./simulation.js";
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

  app.post("/world/action", (req: Request, res: Response) => {
    const worldId = String(req.body?.worldId ?? "").trim();
    const cellId = String(req.body?.cellId ?? "").trim();
    const action = req.body?.action as PlayerActionType | undefined;

    if (!worldId || !cellId || !action) {
      res.status(400).json({ error: "worldId, cellId and action are required" });
      return;
    }

    if (!["stabilize", "invest", "influence", "disrupt", "incite"].includes(action)) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    const world = getWorld(worldId);
    if (!world) {
      res.status(404).json({ error: "World not found" });
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
      tick: world.tick,
      role: world.role,
      kind: world.kind,
      complexity: world.complexity,
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
