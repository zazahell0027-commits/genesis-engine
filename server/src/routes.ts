import type { EventType } from "@genesis/shared";
import type { Request, Response } from "express";
import { tickWorld, triggerWorldEvent } from "./simulation.js";
import { createDemoWorld, createWorld, getWorld, saveWorld } from "./world.js";

export function registerRoutes(app: import("express").Express): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "genesis-engine-server" });
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
}
