import type { CreateWorldInput, EventType, World } from "@genesis/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type WorldBriefing = {
  provider: string;
  narrative: string;
  tick: number;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function createWorld(input: CreateWorldInput): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return parseJson<World>(response);
}

export async function createDemoWorld(): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/demo`, {
    method: "POST"
  });

  return parseJson<World>(response);
}

export async function tickWorld(worldId: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId })
  });

  return parseJson<World>(response);
}

export async function triggerWorldEvent(worldId: string, type?: EventType): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, type })
  });

  return parseJson<World>(response);
}

export async function getWorldBriefing(worldId: string): Promise<WorldBriefing> {
  const response = await fetch(`${API_BASE_URL}/world/briefing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId })
  });

  return parseJson<WorldBriefing>(response);
}
