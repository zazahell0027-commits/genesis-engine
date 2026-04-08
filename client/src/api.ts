import type { CreateWorldInput, EventType, PlayerActionType, World } from "@genesis/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type WorldBriefing = {
  provider: string;
  narrative: string;
  tick: number;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || "Request failed";
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      message = parsed.error ?? message;
    } catch {
      message = raw || "Request failed";
    }
    throw new Error(message);
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

export async function resolveWorldTurn(worldId: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/resolve`, {
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

export async function applyPlayerAction(worldId: string, cellId: string, action: PlayerActionType): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, cellId, action })
  });

  return parseJson<World>(response);
}

export async function queuePlayerAction(worldId: string, cellId: string, action: PlayerActionType): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/action/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, cellId, action })
  });

  return parseJson<World>(response);
}

export async function removeQueuedPlayerAction(worldId: string, queuedActionId: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/action/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, queuedActionId })
  });

  return parseJson<World>(response);
}

export async function submitTurnCommand(worldId: string, text: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/command/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, text })
  });

  return parseJson<World>(response);
}

export async function removeTurnCommand(worldId: string, commandId: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/command/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId, commandId })
  });

  return parseJson<World>(response);
}
