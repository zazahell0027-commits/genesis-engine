import type {
  CountryDescriptor,
  CountryState,
  CreateGameInput,
  GameEvent,
  GameState,
  ScenarioDescriptor,
  ScenarioId,
  WorldIndicators
} from "@genesis/shared";
import { COUNTRY_ANCHORS, normalizeCountryKey } from "./data/countryAnchors.js";

const games = new Map<string, GameState>();

const SCENARIOS: ScenarioDescriptor[] = [
  {
    id: "earth-2010",
    name: "Earth 2010",
    description: "Historical baseline focused on geopolitical divergence from 2010.",
    startYear: 2010,
    startMonth: 1
  }
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hash(seed: string): number {
  let result = 0;
  for (let i = 0; i < seed.length; i += 1) {
    result = (result * 33 + seed.charCodeAt(i)) % 1000003;
  }
  return result;
}

function seededRange(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hash(seed) % span);
}

function blocForContinent(continent: string): string {
  if (continent === "Europe" || continent === "North America") return "Atlantic Accord";
  if (continent === "Asia") return "Eurasian Compact";
  if (continent === "Oceania") return "Pacific Forum";
  if (continent === "South America") return "Southern League";
  return "Non-Aligned Assembly";
}

function buildCountryCatalog(): CountryDescriptor[] {
  const catalog = new Map<string, CountryDescriptor>();

  for (const anchor of Object.values(COUNTRY_ANCHORS)) {
    if (!anchor.name || !anchor.continent) continue;
    if (anchor.continent === "Seven seas (open ocean)") continue;
    if (anchor.continent === "Antarctica") continue;

    const id = normalizeCountryKey(anchor.name);
    if (!id) continue;
    if (!catalog.has(id)) {
      catalog.set(id, {
        id,
        name: anchor.name,
        continent: anchor.continent
      });
    }
  }

  return [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const COUNTRY_CATALOG = buildCountryCatalog();

function scenarioById(id: ScenarioId): ScenarioDescriptor {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

export function listScenarios(): ScenarioDescriptor[] {
  return SCENARIOS;
}

export function listCountries(_scenarioId?: ScenarioId): CountryDescriptor[] {
  return COUNTRY_CATALOG;
}

function fallbackCountry(id: string): CountryDescriptor {
  const fromCatalog = COUNTRY_CATALOG.find((country) => country.id === id);
  if (fromCatalog) return fromCatalog;

  const customName = id.trim().length > 0 ? id.trim() : "Custom State";
  return {
    id: normalizeCountryKey(customName) || "custom-state",
    name: customName,
    continent: "Europe"
  };
}

function createCountryState(country: CountryDescriptor, playerCountryId: string): CountryState {
  const seed = `country:${country.id}`;

  return {
    id: country.id,
    name: country.name,
    continent: country.continent,
    bloc: blocForContinent(country.continent),
    wealth: seededRange(`${seed}:wealth`, 40, 74),
    stability: seededRange(`${seed}:stability`, 45, 78),
    tension: seededRange(`${seed}:tension`, 18, 55),
    relationToPlayer:
      country.id === playerCountryId
        ? 85
        : seededRange(`${seed}:relation`, -25, 35)
  };
}

export function computeIndicators(countries: CountryState[]): WorldIndicators {
  const count = Math.max(1, countries.length);
  const avgStability = Math.round(countries.reduce((sum, country) => sum + country.stability, 0) / count);
  const avgWealth = Math.round(countries.reduce((sum, country) => sum + country.wealth, 0) / count);
  const avgTension = Math.round(countries.reduce((sum, country) => sum + country.tension, 0) / count);

  let conflictLevel: WorldIndicators["conflictLevel"] = "Low";
  if (avgTension >= 62) conflictLevel = "High";
  else if (avgTension >= 47) conflictLevel = "Medium";

  return { avgStability, avgWealth, avgTension, conflictLevel };
}

function createEvent(
  state: GameState,
  type: GameEvent["type"],
  title: string,
  description: string,
  countryId?: string
): GameEvent {
  return {
    id: `${state.id}-evt-${state.tick}-${state.events.length + 1}`,
    type,
    tick: state.tick,
    year: state.year,
    month: state.month,
    title,
    description,
    countryId
  };
}

export function pushEvent(state: GameState, event: GameEvent): void {
  state.events.unshift(event);
  if (state.events.length > 120) {
    state.events = state.events.slice(0, 120);
  }
}

export function createGame(input: CreateGameInput): GameState {
  const scenario = scenarioById(input.scenarioId);
  const requestedCountryId = normalizeCountryKey(input.countryId);
  const playerCountry = fallbackCountry(requestedCountryId || "france");

  const countries = COUNTRY_CATALOG.map((country) => createCountryState(country, playerCountry.id));
  if (!countries.some((country) => country.id === playerCountry.id)) {
    countries.push(createCountryState(playerCountry, playerCountry.id));
  }

  const id = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const state: GameState = {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    year: scenario.startYear,
    month: scenario.startMonth,
    tick: 0,
    playerCountryId: playerCountry.id,
    playerCountryName: playerCountry.name,
    actionPoints: 3,
    maxActionPoints: 3,
    countries,
    events: [],
    queuedOrders: [],
    diplomacyLog: [],
    indicators: computeIndicators(countries)
  };

  pushEvent(
    state,
    createEvent(
      state,
      "system",
      "Scenario Loaded",
      `${scenario.name} initialized. You are now leading ${state.playerCountryName}.`
    )
  );

  pushEvent(
    state,
    createEvent(
      state,
      "major_diplomacy",
      "World Briefing",
      "Global blocs are active. Your first objective is to issue clear orders before the first jump."
    )
  );

  games.set(state.id, state);
  return state;
}

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function saveGame(game: GameState): void {
  game.indicators = computeIndicators(game.countries);
  games.set(game.id, game);
}

export function countriesById(game: GameState): Map<string, CountryState> {
  return new Map(game.countries.map((country) => [country.id, country]));
}

export function normalizeCountryId(input: string): string {
  return normalizeCountryKey(input);
}

export function safeCountryName(game: GameState, countryId: string): string {
  return game.countries.find((country) => country.id === countryId)?.name ?? countryId;
}

export function monthLabel(month: number): string {
  const labels = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return labels[clamp(month, 1, 12) - 1] ?? "January";
}

export function advanceCalendar(game: GameState): void {
  let month = game.month + 1;
  let year = game.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  game.month = month;
  game.year = year;
}
