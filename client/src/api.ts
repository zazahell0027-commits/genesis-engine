import type {
  AdvisorResponse,
  CountryDescriptor,
  DiplomacyExchange,
  GameSessionSummary,
  GameSetupOptions,
  GameState,
  JumpStep,
  PresetBrowserPayload,
  PresetCategory,
  QuickActionKind
} from "@genesis/shared";

type TokenBalanceResponse = {
  userId: string;
  balance: number;
};

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

export async function getPresetBrowser(): Promise<PresetBrowserPayload> {
  const response = await fetch(`${API_BASE_URL}/presets`);
  return parseJson<PresetBrowserPayload>(response);
}

export async function getPresetCategories(): Promise<PresetCategory[]> {
  const response = await fetch(`${API_BASE_URL}/presets/categories`);
  return parseJson<PresetCategory[]>(response);
}

export async function getSetupOptions(presetId: string): Promise<GameSetupOptions> {
  const response = await fetch(`${API_BASE_URL}/presets/${encodeURIComponent(presetId)}/setup`);
  return parseJson<GameSetupOptions>(response);
}

export async function getCountries(presetId: string): Promise<CountryDescriptor[]> {
  const response = await fetch(`${API_BASE_URL}/countries?presetId=${encodeURIComponent(presetId)}`);
  return parseJson<CountryDescriptor[]>(response);
}

export async function listGames(): Promise<GameSessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/games`);
  return parseJson<GameSessionSummary[]>(response);
}

export async function listGamesApi(): Promise<GameSessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/games`);
  return parseJson<GameSessionSummary[]>(response);
}

export async function startGame(input: {
  presetId: string;
  countryId: string;
  difficulty: string;
  aiQuality: string;
}): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return parseJson<GameState>(response);
}

export async function getGame(gameId: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/${gameId}`);
  return parseJson<GameState>(response);
}

export async function deleteGameSession(gameId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/games/${encodeURIComponent(gameId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    await parseJson<Record<string, unknown>>(response);
  }
}

export async function queueOrder(gameId: string, text: string): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, text })
  });

  return parseJson<GameState>(response);
}

export async function queueQuickAction(
  gameId: string,
  targetCountryId: string,
  kind: QuickActionKind
): Promise<GameState> {
  const response = await fetch(`${API_BASE_URL}/game/quick-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, targetCountryId, kind })
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

export async function getTokens(userId?: string): Promise<TokenBalanceResponse> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/tokens${query}`);
  return parseJson<TokenBalanceResponse>(response);
}

export async function earnTokens(amount: number, userId?: string): Promise<TokenBalanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tokens/earn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, userId })
  });
  return parseJson<TokenBalanceResponse>(response);
}

export async function spendTokens(amount: number, userId?: string): Promise<TokenBalanceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tokens/spend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, userId })
  });
  return parseJson<TokenBalanceResponse>(response);
}
