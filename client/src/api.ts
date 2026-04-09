import type {
  AdvisorResponse,
  CountryDescriptor,
  DiplomacyExchange,
  GameState,
  JumpStep,
  ScenarioDescriptor
} from "@genesis/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

export async function getScenarios(): Promise<ScenarioDescriptor[]> {
  const response = await fetch(`${API_BASE_URL}/scenarios`);
  return parseJson<ScenarioDescriptor[]>(response);
}

export async function getCountries(scenarioId: string): Promise<CountryDescriptor[]> {
  const response = await fetch(`${API_BASE_URL}/countries?scenarioId=${encodeURIComponent(scenarioId)}`);
  return parseJson<CountryDescriptor[]>(response);
}

export async function startGame(scenarioId: string, countryId: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId, countryId })
  });

  return parseJson<GameState>(response);
}

export async function getGame(gameId: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/${gameId}`);
  return parseJson<GameState>(response);
}

export async function queueOrder(gameId: string, text: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, text })
  });

  return parseJson<GameState>(response);
}

export async function removeOrder(gameId: string, orderId: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/order/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, orderId })
  });

  return parseJson<GameState>(response);
}

export async function jumpForward(gameId: string, step: JumpStep): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/jump`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, step })
  });

  return parseJson<GameState>(response);
}

export async function jumpToMajorEvent(gameId: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/jump/major-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId })
  });

  return parseJson<GameState>(response);
}

export async function sendDiplomacy(
  gameId: string,
  targetCountryId: string,
  message: string
): Promise<DiplomacyExchange> {
  const response = await fetch(`${API_BASE_URL}/game/diplomacy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, targetCountryId, message })
  });

  return parseJson<DiplomacyExchange>(response);
}

export async function getAdvisor(gameId: string): Promise<AdvisorResponse> {
  const response = await fetch(`${API_BASE_URL}/game/advisor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId })
  });

  return parseJson<AdvisorResponse>(response);
}
