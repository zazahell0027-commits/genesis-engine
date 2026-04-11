import type {
  AIQuality,
  CountryDescriptor,
  CountryState,
  CreateGameInput,
  DifficultyLevel,
  EventWindow,
  GameEvent,
  GameSessionSummary,
  GameState,
  GameUiState,
  JumpOption,
  PresetBrowserPayload,
  PresetCategory,
  PresetRail,
  PresetSummary,
  QuickAction,
  RoundSnapshot,
  ScenarioDescriptor,
  TimelineEntry,
  WorldIndicators
} from "@genesis/shared";
import { COUNTRY_ANCHORS, normalizeCountryKey } from "./data/countryAnchors.js";
import {
  deletePersistedGame,
  getWalletBalance,
  initializeDatabase,
  loadPersistedGames,
  setWalletBalance,
  upsertGameState
} from "./database.js";
import { config } from "./config.js";

const games = new Map<string, GameState>();
const gameUpdatedAt = new Map<string, number>();

function getLocalWalletBalance(fallback: number): number {
  const stored = getWalletBalance(config.localUserId);
  if (stored !== null) {
    return Number(Math.max(0, stored).toFixed(3));
  }

  const seeded = Number(Math.max(0, fallback).toFixed(3));
  setWalletBalance(config.localUserId, seeded);
  return seeded;
}

function syncWalletWithGame(game: GameState): void {
  setWalletBalance(config.localUserId, game.tokenBalance);
}

const JUMP_OPTIONS: JumpOption[] = [
  { step: "week", label: "1 week" },
  { step: "month", label: "1 month" },
  { step: "six_months", label: "6 months" },
  { step: "year", label: "1 year" }
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "attack",
    kind: "attack",
    label: "Attack",
    description: "Commit pressure and offensive preparation toward the selected country.",
    promptTemplate: "Prepare a coordinated offensive plan against {{country}} while protecting supply lines."
  },
  {
    id: "defend",
    kind: "defend",
    label: "Defend",
    description: "Fortify, mobilize reserves, and prioritize territorial defense.",
    promptTemplate: "Fortify the frontier facing {{country}} and prioritize defensive readiness over expansion."
  },
  {
    id: "stabilize",
    kind: "stabilize",
    label: "Stabilize",
    description: "Reduce internal pressure and reinforce cohesion at home.",
    promptTemplate: "Launch an internal stabilization campaign with policing, relief, and political messaging."
  },
  {
    id: "invest",
    kind: "invest",
    label: "Invest",
    description: "Shift resources into infrastructure, industry, and long-term capacity.",
    promptTemplate: "Accelerate infrastructure, logistics, and industrial investment to strengthen the state."
  }
];

const PRESETS: PresetSummary[] = [
  {
    id: "world-war-ii",
    title: "World War II",
    subtitle: "Global war sandbox with tense alliances and rapid escalation.",
    category: "historical",
    era: "1900s",
    tags: ["historical", "war", "global", "high-tension"],
    coverImage: "/media/covers/ww2_card.png",
    bannerImage: "/media/covers/ww2_card.png",
    startDate: { year: 1939, month: 9, day: 1, label: "September 1st, 1939" },
    stats: { rounds: "4.0M rounds", games: "401K games", playlists: "11K playlists" },
    featured: true,
    playable: true,
    defaultTokens: 1.974,
    defaultDifficulty: "Standard",
    official: true,
    creator: "Pax Historia",
    accent: "#7c3aed",
    mapPalette: {
      oceanTop: "#91cbff",
      oceanBottom: "#6da5df",
      landStroke: "#141312",
      labelColor: "rgba(60, 55, 52, 0.55)"
    },
    recommendedCountries: ["germany", "united kingdom", "france", "japan", "italy"],
    description: "A classic war-heavy entry point with fast-changing fronts, high pressure diplomacy, and constant escalation."
  },
  {
    id: "modern-day",
    title: "Modern Day",
    subtitle: "Contemporary geopolitics with diplomacy, sanctions, and proxy pressure.",
    category: "historical",
    era: "2000s",
    tags: ["historical", "modern", "diplomacy", "economy"],
    coverImage: "/media/covers/modern_day_card.png",
    bannerImage: "/media/covers/modern_day_card.png",
    startDate: { year: 2025, month: 1, day: 1, label: "January 1st, 2025" },
    stats: { rounds: "3.6M rounds", games: "429K games", playlists: "9K playlists" },
    featured: true,
    playable: true,
    defaultTokens: 1.274,
    defaultDifficulty: "Standard",
    official: true,
    creator: "Pax Historia",
    accent: "#9f67ff",
    mapPalette: {
      oceanTop: "#88c2ff",
      oceanBottom: "#5f95d9",
      landStroke: "#191410",
      labelColor: "rgba(62, 57, 54, 0.46)"
    },
    recommendedCountries: ["united states", "china", "russia", "india", "turkey"],
    description: "The most familiar sandbox: alliances, trade pressure, cyber posturing, and high-speed narrative pivots."
  },
  {
    id: "detailed-2025",
    title: "2025 Detailed and More Provinces",
    subtitle: "A denser version of the contemporary map with extra hotspots.",
    category: "alt-historical",
    era: "2000s",
    tags: ["alt-historical", "detailed", "regional-hotspots"],
    coverImage: "/media/covers/detailed_2025_card.png",
    bannerImage: "/media/covers/detailed_2025_card.png",
    startDate: { year: 2025, month: 1, day: 8, label: "January 8th, 2025" },
    stats: { rounds: "2.3M rounds", games: "226K games", playlists: "6K playlists" },
    featured: true,
    playable: true,
    defaultTokens: 1.274,
    defaultDifficulty: "Challenging",
    official: false,
    creator: "Community",
    accent: "#6366f1",
    mapPalette: {
      oceanTop: "#9fcbff",
      oceanBottom: "#70a7ea",
      landStroke: "#17110d",
      labelColor: "rgba(62, 59, 56, 0.42)"
    },
    recommendedCountries: ["poland", "iran", "ukraine", "saudi arabia", "japan"],
    description: "A busier modern setup with more pressure points and more opportunities for regional divergence."
  },
  {
    id: "victorian-era",
    title: "Victorian Era",
    subtitle: "Empires, prestige, reform, and colonial maneuvering.",
    category: "historical",
    era: "1800s",
    tags: ["historical", "empire", "prestige", "industrial"],
    coverImage: "/media/covers/victorian_card.png",
    bannerImage: "/media/covers/victorian_card.png",
    startDate: { year: 1884, month: 1, day: 1, label: "January 1st, 1884" },
    stats: { rounds: "1.3M rounds", games: "97K games", playlists: "3K playlists" },
    featured: true,
    playable: true,
    defaultTokens: 1.274,
    defaultDifficulty: "Standard",
    official: false,
    creator: "Community",
    accent: "#d97706",
    mapPalette: {
      oceanTop: "#95c7ff",
      oceanBottom: "#729fdb",
      landStroke: "#21150d",
      labelColor: "rgba(71, 54, 38, 0.43)"
    },
    recommendedCountries: ["united kingdom", "france", "russia", "italy", "japan"],
    description: "A slower-burn sandbox centered on prestige, industrial growth, and power-balancing between empires."
  },
  {
    id: "battle-royale",
    title: "Pax Historia Battle Royale",
    subtitle: "A chaotic custom world where diplomacy collapses fast.",
    category: "science-fiction",
    era: "Experimental",
    tags: ["science-fiction", "chaotic", "high-risk"],
    coverImage: "/media/covers/battle_royale_card.png",
    bannerImage: "/media/chronology_panel.webp",
    startDate: { year: 2026, month: 4, day: 1, label: "April 1st, 2026" },
    stats: { rounds: "920K rounds", games: "81K games", playlists: "1.9K playlists" },
    featured: false,
    playable: true,
    defaultTokens: 0.988,
    defaultDifficulty: "Challenging",
    official: false,
    creator: "Community",
    accent: "#ef4444",
    mapPalette: {
      oceanTop: "#7cb9ff",
      oceanBottom: "#547fb9",
      landStroke: "#151111",
      labelColor: "rgba(88, 56, 56, 0.46)"
    },
    recommendedCountries: ["brazil", "india", "turkey", "nigeria", "mexico"],
    description: "A high-volatility scenario built for spectacle, sudden crises, and dramatic maps."
  },
  {
    id: "make-your-own-country",
    title: "Make Your Own Country!!!!! (RP)",
    subtitle: "Roleplay-heavy sandbox for custom states and alternate regimes.",
    category: "historical-fiction",
    era: "Open-ended",
    tags: ["historical-fiction", "roleplay", "sandbox"],
    coverImage: "/media/covers/cannon_card.png",
    bannerImage: "/media/covers/cannon_card.png",
    startDate: { year: 1911, month: 1, day: 1, label: "January 1st, 1911" },
    stats: { rounds: "710K rounds", games: "63K games", playlists: "1.1K playlists" },
    featured: false,
    playable: true,
    defaultTokens: 0.988,
    defaultDifficulty: "Relaxed",
    official: false,
    creator: "Community",
    accent: "#ec4899",
    mapPalette: {
      oceanTop: "#8cc5ff",
      oceanBottom: "#6798db",
      landStroke: "#181211",
      labelColor: "rgba(64, 55, 63, 0.45)"
    },
    recommendedCountries: ["france", "mexico", "egypt", "japan", "argentina"],
    description: "A freer-form prompt-driven experience where political identity matters as much as hard power."
  },
  {
    id: "shattered-americas",
    title: "Shattered Americas",
    subtitle: "Regional fragmentation across North America and the Atlantic world.",
    category: "alt-historical",
    era: "1900s",
    tags: ["alt-historical", "regional", "fragmented"],
    coverImage: "/media/covers/shattered_americas_card.png",
    bannerImage: "/media/world_map_ui.png",
    startDate: { year: 1962, month: 10, day: 1, label: "October 1st, 1962" },
    stats: { rounds: "530K rounds", games: "42K games", playlists: "870 playlists" },
    featured: false,
    playable: true,
    defaultTokens: 1.274,
    defaultDifficulty: "Standard",
    official: false,
    creator: "Community",
    accent: "#22c55e",
    mapPalette: {
      oceanTop: "#8abfff",
      oceanBottom: "#6294d8",
      landStroke: "#181612",
      labelColor: "rgba(49, 64, 53, 0.42)"
    },
    recommendedCountries: ["united states", "canada", "mexico", "brazil", "cuba"],
    description: "Loose blocs and splinter states make this preset ideal for regional plays and tense negotiations."
  },
  {
    id: "thousand-player-sim",
    title: "1000 Players Simulation",
    subtitle: "Massive sandbox energy with dense interaction and fast narrative turnover.",
    category: "fantasy",
    era: "Experimental",
    tags: ["fantasy", "massive", "community"],
    coverImage: "/media/covers/islands_card.png",
    bannerImage: "/media/chronology_panel.webp",
    startDate: { year: 2032, month: 6, day: 1, label: "June 1st, 2032" },
    stats: { rounds: "410K rounds", games: "28K games", playlists: "730 playlists" },
    featured: false,
    playable: true,
    defaultTokens: 0.988,
    defaultDifficulty: "Challenging",
    official: false,
    creator: "Community",
    accent: "#14b8a6",
    mapPalette: {
      oceanTop: "#85c1ff",
      oceanBottom: "#5f8ed2",
      landStroke: "#17120f",
      labelColor: "rgba(50, 64, 67, 0.42)"
    },
    recommendedCountries: ["india", "china", "united states", "nigeria", "indonesia"],
    description: "An intentionally noisy sandbox designed around scale, emergent chaos, and player-like pacing."
  }
];

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: "historical",
    title: "Historical",
    description: "Grounded starts with recognizable borders, pressure points, and familiar actors.",
    eras: ["1800s", "1900s", "2000s"]
  },
  {
    id: "alt-historical",
    title: "Alt-Historical",
    description: "Plausible divergences with sharper regions, riskier balances, and new maps.",
    eras: ["1900s", "2000s"]
  },
  {
    id: "historical-fiction",
    title: "Historical Fiction",
    description: "Story-first presets where alternate regimes and roleplay drive the pacing.",
    eras: ["Open-ended"]
  },
  {
    id: "science-fiction",
    title: "Science Fiction",
    description: "Near-future sandboxes with accelerated instability and speculative geopolitical logic.",
    eras: ["Experimental"]
  },
  {
    id: "fantasy",
    title: "Fantasy",
    description: "Community-designed worlds that prioritize drama, surprise, and unusual setups.",
    eras: ["Experimental"]
  }
];

const PRESET_RAILS: PresetRail[] = [
  {
    id: "most-played",
    title: "Most Played",
    subtitle: "The highest-volume presets across the live sandbox ecosystem.",
    presetIds: ["world-war-ii", "modern-day", "detailed-2025", "victorian-era"]
  },
  {
    id: "popular-community",
    title: "Popular Community Presets",
    subtitle: "High-engagement community worlds with strong replay energy.",
    presetIds: ["make-your-own-country", "shattered-americas", "battle-royale", "thousand-player-sim"]
  },
  {
    id: "recently-sponsored",
    title: "Recently Sponsored",
    subtitle: "Highlighted scenarios with polished art direction and active creators.",
    presetIds: ["victorian-era", "modern-day", "battle-royale"]
  },
  {
    id: "recently-updated",
    title: "Recently Updated",
    subtitle: "Freshly tuned presets with recent balancing and event work.",
    presetIds: ["modern-day", "detailed-2025", "make-your-own-country", "shattered-americas"]
  },
  {
    id: "top-playlists",
    title: "Top Playlists",
    subtitle: "Curated runs grouped by tone, era, and volatility.",
    presetIds: ["world-war-ii", "victorian-era", "modern-day"]
  },
  {
    id: "recent-playlists",
    title: "Recent Playlists",
    subtitle: "Recently created combinations of presets and challenge styles.",
    presetIds: ["detailed-2025", "battle-royale", "thousand-player-sim"]
  },
  {
    id: "your-presets",
    title: "Your Presets",
    subtitle: "Quick access to local favorites and recent starts.",
    presetIds: ["modern-day", "make-your-own-country", "shattered-americas"]
  },
  {
    id: "popular-creators",
    title: "Popular Creators",
    subtitle: "Strong community authors with high-repeat worlds.",
    presetIds: ["victorian-era", "thousand-player-sim", "battle-royale"]
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

function daySuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function difficultyModifier(difficulty: DifficultyLevel): { ap: number; tension: number; stability: number } {
  if (difficulty === "Relaxed") return { ap: 4, tension: -4, stability: 5 };
  if (difficulty === "Challenging") return { ap: 2, tension: 6, stability: -6 };
  return { ap: 3, tension: 0, stability: 0 };
}

function initialTokenBalance(aiQuality: AIQuality): number {
  if (aiQuality === "Premium") return 1.974;
  if (aiQuality === "Fast") return 0.988;
  return 1.274;
}

function blocForContinent(continent: string): string {
  if (continent === "Europe" || continent === "North America") return "Atlantic Accord";
  if (continent === "Asia") return "Eurasian Compact";
  if (continent === "Oceania") return "Pacific Forum";
  if (continent === "South America") return "Southern League";
  return "Non-Aligned Assembly";
}

function descriptorForCountry(country: CountryDescriptor, preset: PresetSummary, wealth: number, tension: number): string {
  if (preset.category === "historical-fiction") return "Story-heavy regional actor";
  if (preset.category === "science-fiction" || preset.category === "fantasy") return "Volatile power broker";
  if (wealth >= 72) return "Industrial heavyweight";
  if (tension >= 65) return "Flashpoint frontier";
  if (country.continent === "Europe") return "Diplomatic hinge state";
  if (country.continent === "Asia") return "Strategic continental power";
  if (country.continent === "Africa") return "Rising regional balance";
  return "Regional actor";
}

function buildCountryCatalog(): CountryDescriptor[] {
  const catalog = new Map<string, CountryDescriptor>();

  for (const anchor of Object.values(COUNTRY_ANCHORS)) {
    if (!anchor.name || !anchor.continent) continue;
    if (anchor.continent === "Seven seas (open ocean)" || anchor.continent === "Antarctica") continue;

    const id = normalizeCountryKey(anchor.name);
    if (!id || catalog.has(id)) continue;
    catalog.set(id, {
      id,
      name: anchor.name,
      continent: anchor.continent
    });
  }

  return [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const COUNTRY_CATALOG = buildCountryCatalog();

function cloneCountries(countries: CountryState[]): CountryState[] {
  return countries.map((country) => ({ ...country }));
}

function createCountryState(
  country: CountryDescriptor,
  playerCountryId: string,
  preset: PresetSummary,
  difficulty: DifficultyLevel
): CountryState {
  const seed = `${preset.id}:${country.id}`;
  const difficultyState = difficultyModifier(difficulty);
  const categoryOffset =
    preset.category === "historical" ? 0 :
      preset.category === "alt-historical" ? 3 :
        preset.category === "historical-fiction" ? 5 :
          8;

  const wealth = clamp(seededRange(`${seed}:wealth`, 34, 79) - (preset.era === "1800s" ? 8 : 0), 16, 96);
  const tension = clamp(seededRange(`${seed}:tension`, 18, 56) + categoryOffset + difficultyState.tension, 8, 95);
  const stability = clamp(seededRange(`${seed}:stability`, 42, 81) + difficultyState.stability - Math.floor(categoryOffset / 2), 10, 96);
  const army = clamp(seededRange(`${seed}:army`, 2, 8) + (preset.id === "world-war-ii" ? 1 : 0), 1, 12);
  const industry = clamp(Math.round(wealth / 12) + seededRange(`${seed}:industry`, -1, 2), 1, 10);
  const fortification = clamp(seededRange(`${seed}:fort`, 0, 4) + (country.continent === "Europe" ? 1 : 0), 0, 9);
  const unrest = clamp(Math.round((tension + (100 - stability)) / 25) + seededRange(`${seed}:unrest`, -1, 1), 0, 9);
  const relationToPlayer =
    country.id === playerCountryId
      ? 85
      : seededRange(`${seed}:relation`, -28, 38) - (difficulty === "Challenging" ? 5 : 0);
  const power = computeCountryPowerScore({ wealth, stability, tension, army, industry, fortification, unrest });

  return {
    id: country.id,
    name: country.name,
    continent: country.continent,
    bloc: blocForContinent(country.continent),
    wealth,
    stability,
    tension,
    relationToPlayer,
    power,
    army,
    industry,
    fortification,
    unrest,
    descriptor: descriptorForCountry(country, preset, wealth, tension)
  };
}

function getPresetById(presetId: string): PresetSummary {
  return PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[1] ?? PRESETS[0];
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

function eventTone(event?: GameEvent): TimelineEntry["tone"] {
  if (!event) return "normal";
  if (event.type === "major_crisis" || event.type === "major_conflict") return "crisis";
  if (event.type === "major_diplomacy" || event.type === "diplomacy") return "diplomacy";
  if (event.type.startsWith("major_")) return "major";
  return "normal";
}

function openingBriefingForPreset(preset: PresetSummary, playerCountryName: string): {
  title: string;
  description: string;
  locationLabel: string;
  factionLabel: string;
  mapChangeSummary: string;
} {
  if (preset.id === "world-war-ii") {
    return {
      title: "Europe Braces for War",
      description: `${playerCountryName} enters a world of hardening fronts, brittle alliances, and rapidly escalating decisions. Use short jumps if you want control over the opening months.`,
      locationLabel: playerCountryName,
      factionLabel: "World War II",
      mapChangeSummary: "No border shift yet. Armies, blocs, and national priorities are locking into place."
    };
  }

  if (preset.id === "modern-day" || preset.id === "detailed-2025") {
    return {
      title: "The Present Order Starts to Fray",
      description: `${playerCountryName} steps into a live modern sandbox shaped by diplomacy, sanctions, pressure campaigns, and sudden regional crises.`,
      locationLabel: playerCountryName,
      factionLabel: preset.title,
      mapChangeSummary: "The map is stable for now, but the diplomatic and economic balance is already shifting."
    };
  }

  if (preset.id === "victorian-era") {
    return {
      title: "Imperial Ambitions Reawaken",
      description: `${playerCountryName} begins inside a prestige-driven world of empires, reform movements, colonial pressure, and slow-burn industrial competition.`,
      locationLabel: playerCountryName,
      factionLabel: "Victorian Era",
      mapChangeSummary: "Prestige and influence are in motion even where borders have not changed."
    };
  }

  return {
    title: "World Briefing",
    description: `The ${preset.title} world is live. Use clear actions, diplomacy, and short jumps to control the opening phase.`,
    locationLabel: playerCountryName,
    factionLabel: preset.title,
    mapChangeSummary: "No territorial change yet. Pressure is building across the map."
  };
}

function relativeUpdatedLabel(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Updated moments ago";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

function createEmptyEventWindow(game: GameState): EventWindow {
  return {
    title: "Evenements entre dates",
    rangeLabel: `${game.displayDate} -> ${game.displayDate}`,
    activeEventId: game.events[0]?.id ?? null,
    eventIds: game.events[0] ? [game.events[0].id] : [],
    startedTick: game.tick,
    endedTick: game.tick
  };
}

function buildTimeline(game: GameState): TimelineEntry[] {
  const eventsById = new Map(game.events.map((event) => [event.id, event]));
  return [...game.snapshots]
    .reverse()
    .slice(0, 14)
    .map((snapshot) => {
      const leadEvent = snapshot.eventIds
        .map((eventId) => eventsById.get(eventId))
        .find((event) => Boolean(event));

      return {
        id: `timeline-${snapshot.id}`,
        snapshotId: snapshot.id,
        tick: snapshot.tick,
        displayDate: snapshot.displayDate,
        title: leadEvent?.title ?? `Round ${snapshot.tick}`,
        subtitle: leadEvent?.description ?? snapshot.summary,
        tone: eventTone(leadEvent)
      };
    });
}

export function hydrateWorldStore(): void {
  initializeDatabase();
  games.clear();
  gameUpdatedAt.clear();

  const persistedGames = loadPersistedGames();
  for (const persistedGame of persistedGames) {
    try {
      saveGame(persistedGame);
    } catch {
      continue;
    }
  }

  if (persistedGames.length === 0) {
    getLocalWalletBalance(initialTokenBalance("Balanced"));
  }
}

export function listScenarios(): ScenarioDescriptor[] {
  return PRESETS;
}

export function listPresets(): PresetSummary[] {
  return PRESETS;
}

export function listPresetCategories(): PresetCategory[] {
  return PRESET_CATEGORIES;
}

export function getPresetBrowser(): PresetBrowserPayload {
  return {
    presets: PRESETS,
    rails: PRESET_RAILS,
    categories: PRESET_CATEGORIES,
    navBadges: [
      { id: "gift", label: "Gift", value: "1", tone: "neutral" },
      { id: "tokens", label: "Tokens", value: "$1.974", tone: "accent" }
    ]
  };
}

export function listCountries(_presetId?: string): CountryDescriptor[] {
  return COUNTRY_CATALOG;
}

export function getGameSetupOptions(presetId: string) {
  const preset = getPresetById(presetId);
  return {
    presetId: preset.id,
    difficultyOptions: ["Relaxed", "Standard", "Challenging"],
    aiQualityOptions: ["Fast", "Balanced", "Premium"],
    defaultDifficulty: "Standard",
    defaultAIQuality: "Balanced",
    defaultCountryId: preset.recommendedCountries[0] ?? "france",
    recommendedCountries: preset.recommendedCountries,
    featuredTips: [
      "Use small time jumps first to calibrate the world response.",
      "Text orders matter more than quick clicks.",
      "Major events are easier to read from the chronology after longer jumps."
    ]
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

export function computeCountryPowerScore(country: Pick<CountryState, "wealth" | "stability" | "tension" | "army" | "industry" | "fortification" | "unrest">): number {
  return clamp(
    Math.round(
      country.wealth * 0.28 +
      country.stability * 0.18 +
      (100 - country.tension) * 0.16 +
      country.army * 3.1 +
      country.industry * 2.8 +
      country.fortification * 1.9 -
      country.unrest * 2.2
    ),
    12,
    99
  );
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

export function formatDate(year: number, month: number, day: number): string {
  return `${monthLabel(month)} ${day}${daySuffix(day)}, ${year}`;
}

export function formatRangeLabel(
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number }
): string {
  return `${formatDate(start.year, start.month, start.day)} -> ${formatDate(end.year, end.month, end.day)}`;
}

export function pushEvent(state: GameState, event: GameEvent): void {
  state.events.unshift(event);
  if (state.events.length > 160) {
    state.events = state.events.slice(0, 160);
  }
}

export function createSnapshot(game: GameState, summary: string, eventIds: string[]): RoundSnapshot {
  return {
    id: `${game.id}-snapshot-${game.tick}`,
    tick: game.tick,
    year: game.year,
    month: game.month,
    day: game.day,
    displayDate: formatDate(game.year, game.month, game.day),
    countries: cloneCountries(game.countries),
    mapArtifacts: game.mapArtifacts.map((artifact) => ({ ...artifact })),
    eventIds,
    summary
  };
}

export function saveGame(game: GameState): void {
  game.mapArtifacts = game.mapArtifacts ?? [];
  game.snapshots = (game.snapshots ?? []).map((snapshot) => ({
    ...snapshot,
    mapArtifacts: (snapshot.mapArtifacts ?? []).map((artifact) => ({ ...artifact }))
  }));
  const selectedCountry =
    game.countries.find((country) => country.id === game.selectedCountryId) ??
    game.countries.find((country) => country.id === game.playerCountryId) ??
    game.countries[0];

  game.displayDate = formatDate(game.year, game.month, game.day);
  game.selectedCountryId = selectedCountry?.id ?? game.playerCountryId;
  game.selectedProvinceId = game.selectedProvinceId ?? null;
  game.selectedCountryName = selectedCountry?.name ?? game.playerCountryName;
  game.indicators = computeIndicators(game.countries);
  game.quickActions = QUICK_ACTIONS;
  game.availableJumpOptions = JUMP_OPTIONS;
  game.uiState = {
    activePanel: game.uiState?.activePanel ?? "none",
    selectedCountryId: game.selectedCountryId,
    viewedSnapshotId: game.uiState?.viewedSnapshotId ?? null
  } satisfies GameUiState;
  game.timeline = buildTimeline(game);
  if (game.eventWindow.eventIds.length === 0 && game.events[0]) {
    game.eventWindow = createEmptyEventWindow(game);
  } else if (game.eventWindow.activeEventId && !game.events.some((event) => event.id === game.eventWindow.activeEventId)) {
    game.eventWindow.activeEventId = game.eventWindow.eventIds[0] ?? game.events[0]?.id ?? null;
  }

  games.set(game.id, game);
  gameUpdatedAt.set(game.id, Date.now());
  upsertGameState(game);
  syncWalletWithGame(game);
}

export function createGame(input: CreateGameInput): GameState {
  const preset = getPresetById(input.presetId);
  const requestedCountryId = normalizeCountryKey(input.countryId);
  const playerCountry = fallbackCountry(requestedCountryId || preset.recommendedCountries[0] || "france");
  const diff = difficultyModifier(input.difficulty);

  const countries = COUNTRY_CATALOG.map((country) => createCountryState(country, playerCountry.id, preset, input.difficulty));
  if (!countries.some((country) => country.id === playerCountry.id)) {
    countries.push(createCountryState(playerCountry, playerCountry.id, preset, input.difficulty));
  }

  const id = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const openingBriefing = openingBriefingForPreset(preset, playerCountry.name);
  const state: GameState = {
    id,
    presetId: preset.id,
    preset,
    year: preset.startDate.year,
    month: preset.startDate.month,
    day: preset.startDate.day,
    tick: 0,
    displayDate: preset.startDate.label,
    playerCountryId: playerCountry.id,
    playerCountryName: playerCountry.name,
    difficulty: input.difficulty,
    aiQuality: input.aiQuality,
    actionPoints: diff.ap,
    maxActionPoints: diff.ap,
    countries,
    mapArtifacts: [],
    selectedCountryId: playerCountry.id,
    selectedProvinceId: null,
    selectedCountryName: playerCountry.name,
    events: [],
    queuedOrders: [],
    diplomacyLog: [],
    indicators: computeIndicators(countries),
    quickActions: QUICK_ACTIONS,
    eventWindow: {
      title: "Evenements entre dates",
      rangeLabel: `${preset.startDate.label} -> ${preset.startDate.label}`,
      activeEventId: null,
      eventIds: [],
      startedTick: 0,
      endedTick: 0
    },
    timeline: [],
    snapshots: [],
    tokenBalance: getLocalWalletBalance(initialTokenBalance(input.aiQuality)),
    availableJumpOptions: JUMP_OPTIONS,
    uiState: {
      activePanel: "events",
      selectedCountryId: playerCountry.id,
      viewedSnapshotId: null
    }
  };

  const systemEvent: GameEvent = {
    id: `${state.id}-evt-boot`,
    type: "system",
    tick: state.tick,
    year: state.year,
    month: state.month,
    day: state.day,
    dateLabel: state.displayDate,
    title: "Scenario Loaded",
    description: `${preset.title} initialized. You are now leading ${state.playerCountryName}.`,
    locationLabel: state.playerCountryName,
    factionLabel: preset.official ? "Official Preset" : "Community Preset",
    mapChangeSummary: "Initial world state ready for inspection.",
    countryId: state.playerCountryId
  };

  const briefingEvent: GameEvent = {
    id: `${state.id}-evt-briefing`,
    type: "major_diplomacy",
    tick: state.tick,
    year: state.year,
    month: state.month,
    day: state.day,
    dateLabel: state.displayDate,
    title: openingBriefing.title,
    description: openingBriefing.description,
    locationLabel: openingBriefing.locationLabel,
    factionLabel: openingBriefing.factionLabel,
    mapChangeSummary: openingBriefing.mapChangeSummary,
    countryId: state.playerCountryId
  };

  pushEvent(state, systemEvent);
  pushEvent(state, briefingEvent);
  state.snapshots.push(createSnapshot(state, "Opening world state loaded.", [briefingEvent.id, systemEvent.id]));
  state.eventWindow = {
    title: "Evenements entre dates",
    rangeLabel: `${preset.startDate.label} -> ${preset.startDate.label}`,
    activeEventId: briefingEvent.id,
    eventIds: [briefingEvent.id, systemEvent.id],
    startedTick: 0,
    endedTick: 0
  };

  saveGame(state);
  return state;
}

export function listGameSessions(): GameSessionSummary[] {
  return [...games.values()]
    .sort((a, b) => (gameUpdatedAt.get(b.id) ?? 0) - (gameUpdatedAt.get(a.id) ?? 0))
    .slice(0, 12)
    .map((game) => ({
      id: game.id,
      presetId: game.presetId,
      presetTitle: game.preset.title,
      coverImage: game.preset.coverImage,
      playerCountryName: game.playerCountryName,
      displayDate: game.displayDate,
      tick: game.tick,
      lastUpdatedLabel: relativeUpdatedLabel(gameUpdatedAt.get(game.id) ?? Date.now()),
      accent: game.preset.accent
    }));
}

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function deleteGame(gameId: string): boolean {
  const hadInMemory = games.delete(gameId);
  gameUpdatedAt.delete(gameId);
  const removedFromDb = deletePersistedGame(gameId);
  return hadInMemory || removedFromDb;
}

export function getTokenBalance(userId = config.localUserId): number {
  const stored = getWalletBalance(userId);
  if (stored !== null) {
    return Number(Math.max(0, stored).toFixed(3));
  }

  return setWalletBalance(userId, initialTokenBalance("Balanced"));
}

export function earnTokens(amount: number, userId = config.localUserId): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const current = getTokenBalance(userId);
  return setWalletBalance(userId, current + safeAmount);
}

export function spendTokens(amount: number, userId = config.localUserId): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const current = getTokenBalance(userId);
  if (safeAmount > current) {
    throw new Error("Insufficient tokens.");
  }
  return setWalletBalance(userId, current - safeAmount);
}

export function normalizeCountryId(input: string): string {
  return normalizeCountryKey(input);
}

export function safeCountryName(game: GameState, countryId: string): string {
  return game.countries.find((country) => country.id === countryId)?.name ?? countryId;
}

export function getPreset(presetId: string): PresetSummary {
  return getPresetById(presetId);
}

export function getQuickActions(): QuickAction[] {
  return QUICK_ACTIONS;
}

export function buildEventWindowForTickRange(
  game: GameState,
  start: { tick: number; year: number; month: number; day: number },
  end: { tick: number; year: number; month: number; day: number }
): EventWindow {
  const matchingEvents = [...game.events]
    .filter((event) => event.tick >= start.tick && event.tick <= end.tick)
    .sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

  return {
    title: "Evenements entre dates",
    rangeLabel: formatRangeLabel(start, end),
    activeEventId: matchingEvents[0]?.id ?? null,
    eventIds: matchingEvents.map((event) => event.id),
    startedTick: start.tick,
    endedTick: end.tick
  };
}

export function advanceCalendar(game: GameState, mode: "week" | "month"): void {
  if (mode === "week") {
    game.day += 7;
    while (game.day > 28) {
      game.day -= 28;
      game.month += 1;
      if (game.month > 12) {
        game.month = 1;
        game.year += 1;
      }
    }
    return;
  }

  game.day = 1;
  game.month += 1;
  if (game.month > 12) {
    game.month = 1;
    game.year += 1;
  }
}
