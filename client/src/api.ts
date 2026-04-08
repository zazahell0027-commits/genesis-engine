import type { CreateWorldInput, World } from "@genesis/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function createWorld(input: CreateWorldInput): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create world");
  }

  return response.json() as Promise<World>;
}

export async function tickWorld(worldId: string): Promise<World> {
  const response = await fetch(`${API_BASE_URL}/world/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId })
  });

  if (!response.ok) {
    throw new Error("Failed to tick world");
  }

  return response.json() as Promise<World>;
}
