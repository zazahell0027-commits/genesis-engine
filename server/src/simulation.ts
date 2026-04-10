import type {
  DiplomacyExchange,
  GameEvent,
  GameState,
  JumpStep,
  MapEffect,
  QuickActionKind,
  TurnOrder,
  TurnOrderKind
} from "@genesis/shared";
import {
  advanceCalendar,
  buildEventWindowForTickRange,
  computeCountryPowerScore,
  createSnapshot,
  computeIndicators,
  formatDate,
  normalizeCountryId,
  pushEvent,
  safeCountryName,
  saveGame
} from "./world.js";

export type QueuedOrderOverrides = {
  kind?: TurnOrderKind;
  targetCountryId?: string;
  cleanedText?: string;
};

export type DiplomacyOutcome = {
  stance: DiplomacyExchange["stance"];
  reply: string;
  relationDelta: number;
  tensionDelta: number;
  stabilityDelta: number;
};

export type RoundNarrativePatch = {
  type?: GameEvent["type"];
  title: string;
  description: string;
  mapChangeSummary: string;
  factionLabel?: string;
  locationLabel?: string;
  highlights?: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampTokens(value: number): number {
  return Number(Math.max(0.111, value).toFixed(3));
}

function hash(seed: string): number {
  let result = 0;
  for (let i = 0; i < seed.length; i += 1) {
    result = (result * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  return result;
}

function seededDelta(seed: string): number {
  return (hash(seed) % 5) - 2;
}

function createEvent(
  game: GameState,
  type: GameEvent["type"],
  title: string,
  description: string,
  options?: {
    countryId?: string;
    locationLabel?: string;
    factionLabel?: string;
    mapChangeSummary?: string;
    mapEffects?: MapEffect[];
  }
): GameEvent {
  return {
    id: `${game.id}-evt-${game.tick}-${game.events.length + 1}`,
    type,
    tick: game.tick,
    year: game.year,
    month: game.month,
    day: game.day,
    dateLabel: formatDate(game.year, game.month, game.day),
    title,
    description,
    countryId: options?.countryId,
    locationLabel: options?.locationLabel,
    factionLabel: options?.factionLabel,
    mapChangeSummary: options?.mapChangeSummary,
    mapEffects: options?.mapEffects
  };
}

function createMapEffect(
  eventId: string,
  tick: number,
  kind: MapEffect["kind"],
  countryId: string,
  label: string,
  intensity: number,
  options?: {
    sourceCountryId?: string;
    persistent?: boolean;
  }
): MapEffect {
  return {
    id: `${eventId}-${kind}-${countryId}-${intensity}`,
    kind,
    countryId,
    sourceCountryId: options?.sourceCountryId,
    intensity,
    label,
    tick,
    persistent: options?.persistent
  };
}

function buildOrderMapEffects(game: GameState, eventId: string, order: TurnOrder, playerCountryId: string): MapEffect[] {
  const targetName = safeCountryName(game, order.targetCountryId);
  const playerName = safeCountryName(game, playerCountryId);

  if (order.kind === "attack" || order.kind === "military") {
    return [
      createMapEffect(eventId, game.tick, "army", playerCountryId, `${playerName} moves troops toward ${targetName}.`, 3, {
        sourceCountryId: order.targetCountryId
      }),
      createMapEffect(eventId, game.tick, "crisis", order.targetCountryId, `${targetName} becomes an active frontline.`, 3, {
        sourceCountryId: playerCountryId
      })
    ];
  }

  if (order.kind === "defend") {
    return [
      createMapEffect(eventId, game.tick, "fortification", playerCountryId, `${playerName} fortifies the frontier facing ${targetName}.`, 3, {
        sourceCountryId: order.targetCountryId
      }),
      createMapEffect(eventId, game.tick, "army", playerCountryId, `${playerName} concentrates defensive troops near ${targetName}.`, 2, {
        sourceCountryId: order.targetCountryId
      })
    ];
  }

  if (order.kind === "invest") {
    return [
      createMapEffect(eventId, game.tick, "industry", playerCountryId, `${playerName} expands industry and logistics.`, 3, {
        persistent: true
      })
    ];
  }

  if (order.kind === "stabilize") {
    return [
      createMapEffect(eventId, game.tick, "stability", playerCountryId, `${playerName} restores internal order.`, 2, {
        persistent: true
      })
    ];
  }

  if (order.kind === "diplomacy") {
    return [
      createMapEffect(eventId, game.tick, "diplomacy", order.targetCountryId, `${playerName} opens talks with ${targetName}.`, 2, {
        sourceCountryId: playerCountryId
      })
    ];
  }

  return [
    createMapEffect(eventId, game.tick, "crisis", order.targetCountryId, `${targetName} faces renewed political pressure.`, 2, {
      sourceCountryId: playerCountryId
    })
  ];
}

function detectOrderKind(text: string): TurnOrderKind {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(defend|fortify|protect|hold line)\b/.test(normalized)) return "defend";
  if (/\b(attack|war|invade|offensive|strike)\b/.test(normalized)) return "attack";
  if (/\b(stabil|pacif|ordre|secur|calm|secure)\b/.test(normalized)) return "stabilize";
  if (/\b(invest|industry|eco|infrastructure|budget|commerce)\b/.test(normalized)) return "invest";
  if (/\b(alliance|treaty|pact|negot|diplom|talk|cooper)\b/.test(normalized)) return "diplomacy";
  if (/\b(military|arm|mobiliz)\b/.test(normalized)) return "military";
  return "pressure";
}

function detectTargetCountryId(game: GameState, text: string): string {
  const normalizedText = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const byLongestName = [...game.countries].sort((a, b) => b.name.length - a.name.length);
  for (const country of byLongestName) {
    const normalizedCountry = country.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalizedCountry.length >= 3 && normalizedText.includes(normalizedCountry)) {
      return country.id;
    }
  }

  return game.playerCountryId;
}

function getCountry(game: GameState, countryId: string) {
  return game.countries.find((country) => country.id === countryId);
}

function createQuickActionText(kind: QuickActionKind, targetName: string): string {
  if (kind === "attack") {
    return `Prepare a coordinated offensive against ${targetName}, focusing on pressure, logistics, and territorial gains.`;
  }
  if (kind === "defend") {
    return `Fortify the frontier facing ${targetName}, rotate reserves, and prioritize territorial defense.`;
  }
  if (kind === "invest") {
    return `Accelerate industrial and infrastructure investment with a focus on outpacing ${targetName}.`;
  }
  return `Launch an internal stabilization effort while managing pressure linked to ${targetName}.`;
}

function fallbackDiplomacyOutcome(game: GameState, targetCountryId: string, message: string): DiplomacyOutcome {
  const target = getCountry(game, targetCountryId);
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aggressive = /\b(attack|war|ultimatum|sanction|threat|invade)\b/.test(normalized);
  const cooperative = /\b(alliance|pact|trade|peace|cooperation|accord)\b/.test(normalized);

  if (aggressive || (target?.relationToPlayer ?? 0) <= -35 || (target?.tension ?? 0) >= 70) {
    return {
      stance: "hostile",
      reply: `${safeCountryName(game, targetCountryId)} rejects your position and shifts to defensive mobilization.`,
      relationDelta: -10,
      tensionDelta: 4,
      stabilityDelta: 0
    };
  }

  if (cooperative || (target?.relationToPlayer ?? 0) >= 25 || (target?.tension ?? 50) <= 40) {
    return {
      stance: "friendly",
      reply: `${safeCountryName(game, targetCountryId)} accepts opening a negotiation channel and signals willingness for a phased agreement.`,
      relationDelta: 10,
      tensionDelta: -3,
      stabilityDelta: 1
    };
  }

  return {
    stance: "neutral",
    reply: `${safeCountryName(game, targetCountryId)} remains cautious and requests concrete guarantees before committing.`,
    relationDelta: 1,
    tensionDelta: 0,
    stabilityDelta: 0
  };
}

function applyOrderEffect(game: GameState, order: TurnOrder, highlights: string[], eventIds: string[]): void {
  const target = getCountry(game, order.targetCountryId);
  const player = getCountry(game, game.playerCountryId);
  if (!target || !player) return;

  const before = {
    wealth: target.wealth,
    stability: target.stability,
    tension: target.tension,
    relation: target.relationToPlayer
  };

  if (order.kind === "stabilize") {
    player.stability = clamp(player.stability + 7, 0, 100);
    player.tension = clamp(player.tension - 6, 0, 100);
    player.wealth = clamp(player.wealth + 2, 0, 100);
    player.unrest = clamp(player.unrest - 2, 0, 10);
  } else if (order.kind === "invest") {
    player.wealth = clamp(player.wealth + 8, 0, 100);
    player.stability = clamp(player.stability + 3, 0, 100);
    player.tension = clamp(player.tension - 1, 0, 100);
    player.industry = clamp(player.industry + 2, 0, 12);
    target.relationToPlayer = clamp(target.relationToPlayer + 2, -100, 100);
  } else if (order.kind === "diplomacy") {
    target.relationToPlayer = clamp(target.relationToPlayer + 10, -100, 100);
    target.tension = clamp(target.tension - 4, 0, 100);
    target.stability = clamp(target.stability + 2, 0, 100);
    player.unrest = clamp(player.unrest - 1, 0, 10);
  } else if (order.kind === "defend") {
    player.stability = clamp(player.stability + 4, 0, 100);
    player.wealth = clamp(player.wealth - 2, 0, 100);
    player.army = clamp(player.army + 1, 0, 12);
    player.fortification = clamp(player.fortification + 2, 0, 10);
    target.tension = clamp(target.tension + 5, 0, 100);
    target.relationToPlayer = clamp(target.relationToPlayer - 5, -100, 100);
  } else if (order.kind === "attack" || order.kind === "military") {
    target.tension = clamp(target.tension + 12, 0, 100);
    target.stability = clamp(target.stability - 8, 0, 100);
    target.wealth = clamp(target.wealth - 4, 0, 100);
    target.unrest = clamp(target.unrest + 2, 0, 10);
    target.fortification = clamp(target.fortification + 1, 0, 10);
    target.relationToPlayer = clamp(target.relationToPlayer - 14, -100, 100);
    player.tension = clamp(player.tension + 5, 0, 100);
    player.army = clamp(player.army + 2, 0, 12);
    player.unrest = clamp(player.unrest + 1, 0, 10);
  } else {
    target.tension = clamp(target.tension + 7, 0, 100);
    target.stability = clamp(target.stability - 2, 0, 100);
    target.unrest = clamp(target.unrest + 1, 0, 10);
    target.relationToPlayer = clamp(target.relationToPlayer - 6, -100, 100);
    player.army = clamp(player.army + 1, 0, 12);
  }

  player.power = computeCountryPowerScore(player);
  target.power = computeCountryPowerScore(target);

  highlights.push(
    `${order.kind.toUpperCase()} toward ${target.name}: W ${before.wealth}->${target.wealth}, S ${before.stability}->${target.stability}, T ${before.tension}->${target.tension}, Army ${player.army}`
  );

  const event = createEvent(
    game,
    "order",
    `Order Applied: ${order.kind}`,
    `${safeCountryName(game, order.targetCountryId)} reacted to "${order.text}".`,
    {
      countryId: order.targetCountryId,
      locationLabel: safeCountryName(game, order.targetCountryId),
      factionLabel: game.playerCountryName,
      mapChangeSummary:
        order.kind === "attack" || order.kind === "military"
          ? "Border pressure increased and regional stability dipped."
          : order.kind === "defend"
            ? "Defensive readiness improved with a visible military posture shift."
            : "Political and economic pressure changed the local balance."
    }
  );
  event.mapEffects = buildOrderMapEffects(game, event.id, order, player.id);

  pushEvent(game, event);
  eventIds.push(event.id);
}

function simulateNaturalDynamics(game: GameState): GameEvent | null {
  const tensionByContinent = new Map<string, { total: number; count: number }>();
  for (const country of game.countries) {
    const acc = tensionByContinent.get(country.continent) ?? { total: 0, count: 0 };
    acc.total += country.tension;
    acc.count += 1;
    tensionByContinent.set(country.continent, acc);
  }

  for (const country of game.countries) {
    const acc = tensionByContinent.get(country.continent);
    const continentAvgTension = acc ? Math.round(acc.total / Math.max(1, acc.count)) : country.tension;

    const noise = seededDelta(`${game.id}:${game.tick}:${country.id}`);
    const tensionTrend = country.tension < continentAvgTension ? 1 : country.tension > continentAvgTension ? -1 : 0;

    country.wealth = clamp(
      country.wealth + noise + (country.stability >= 62 ? 1 : 0) - (country.tension >= 68 ? 2 : 0),
      0,
      100
    );
    country.tension = clamp(
      country.tension + tensionTrend + (country.relationToPlayer <= -40 ? 1 : 0) + (noise > 1 ? 1 : 0),
      0,
      100
    );
    country.stability = clamp(
      country.stability + (country.tension >= 70 ? -2 : 1) + (country.wealth <= 35 ? -1 : 0) + (country.relationToPlayer >= 45 ? 1 : 0),
      0,
      100
    );
    country.army = clamp(country.army + (country.tension >= 68 ? 1 : country.tension <= 28 ? -1 : 0), 0, 12);
    country.industry = clamp(country.industry + (country.wealth >= 68 ? 1 : country.wealth <= 30 ? -1 : 0), 0, 12);
    country.fortification = clamp(country.fortification + (country.tension >= 74 ? 1 : 0), 0, 10);
    country.unrest = clamp(
      country.unrest + (country.tension >= 66 ? 1 : 0) + (country.stability <= 42 ? 1 : 0) - (country.stability >= 64 ? 1 : 0),
      0,
      10
    );
    country.power = computeCountryPowerScore(country);

    if (country.id !== game.playerCountryId) {
      const relationDrift = country.relationToPlayer > 0 ? -1 : country.relationToPlayer < 0 ? 1 : 0;
      country.relationToPlayer = clamp(country.relationToPlayer + relationDrift, -100, 100);
    }
  }

  const indicators = computeIndicators(game.countries);
  const highTension = game.countries.filter((country) => country.tension >= 74);
  const worstRelation = [...game.countries].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];

  if (highTension.length >= Math.ceil(game.countries.length * 0.15)) {
    const target = [...highTension].sort((a, b) => b.tension - a.tension)[0];
    return createEvent(
      game,
      "major_crisis",
      "Regional Crisis Escalates",
      `${target.name} becomes a flashpoint with severe domestic pressure and external risk.`,
      {
        countryId: target.id,
        locationLabel: target.name,
        factionLabel: target.bloc,
        mapChangeSummary: "Regional alertness spikes and nearby actors harden their posture.",
        mapEffects: [
          createMapEffect(`major-crisis-${game.id}-${game.tick}`, game.tick, "crisis", target.id, `${target.name} enters a severe crisis phase.`, 3)
        ]
      }
    );
  }

  if (indicators.avgStability >= 66 && game.tick % 4 === 0) {
    return createEvent(
      game,
      "major_diplomacy",
      "Bloc Summit",
      "A new diplomatic summit reshapes alignments between major blocs.",
      {
        locationLabel: "Global",
        factionLabel: "Major Blocs",
        mapChangeSummary: "Influence balances shift without immediate border change.",
        mapEffects: [
          createMapEffect(`bloc-summit-${game.id}-${game.tick}`, game.tick, "diplomacy", game.playerCountryId, `${game.playerCountryName} enters a fresh diplomatic phase.`, 2)
        ]
      }
    );
  }

  if (indicators.avgWealth >= 64 && game.tick % 6 === 0) {
    return createEvent(
      game,
      "major_growth",
      "Global Growth Wave",
      "Economic momentum spreads across multiple regions, accelerating strategic competition.",
      {
        locationLabel: "Global Markets",
        factionLabel: "Trade Networks",
        mapChangeSummary: "Infrastructure and industrial capacity trend upward.",
        mapEffects: [
          createMapEffect(`growth-wave-${game.id}-${game.tick}`, game.tick, "industry", game.playerCountryId, `${game.playerCountryName} benefits from a new growth wave.`, 2)
        ]
      }
    );
  }

  if (worstRelation && worstRelation.relationToPlayer <= -65 && game.tick % 5 === 0) {
    return createEvent(
      game,
      "major_conflict",
      "Strategic Confrontation",
      `${worstRelation.name} enters open confrontation rhetoric against your bloc.`,
      {
        countryId: worstRelation.id,
        locationLabel: worstRelation.name,
        factionLabel: worstRelation.bloc,
        mapChangeSummary: "Military pressure rises and diplomacy becomes more brittle.",
        mapEffects: [
          createMapEffect(`strategic-conflict-${game.id}-${game.tick}`, game.tick, "army", worstRelation.id, `${worstRelation.name} mobilizes around a confrontation.`, 3),
          createMapEffect(`strategic-conflict-${game.id}-${game.tick}`, game.tick, "crisis", worstRelation.id, `${worstRelation.name} becomes a confrontation hotspot.`, 2)
        ]
      }
    );
  }

  return null;
}

function cadenceForStep(step: JumpStep): "week" | "month" {
  return step === "week" ? "week" : "month";
}

function loopsForStep(step: JumpStep): number {
  if (step === "week") return 1;
  if (step === "month") return 1;
  if (step === "six_months") return 6;
  return 12;
}

function runRound(game: GameState, cadence: "week" | "month"): GameEvent | null {
  const queued = [...game.queuedOrders];
  game.queuedOrders = [];

  const highlights: string[] = [];
  const eventIds: string[] = [];
  for (const order of queued) {
    order.status = "resolved";
    applyOrderEffect(game, order, highlights, eventIds);
  }

  game.tick += 1;
  advanceCalendar(game, cadence);

  const majorEvent = simulateNaturalDynamics(game);
  if (majorEvent) {
    pushEvent(game, majorEvent);
    eventIds.push(majorEvent.id);
  }

  game.actionPoints = game.maxActionPoints;
  game.indicators = computeIndicators(game.countries);

  const summaryText =
    highlights.length > 0
      ? highlights[0]
      : "No direct orders resolved this round. The world drifted under simulation pressure.";

  game.lastRoundSummary = {
    tick: game.tick,
    year: game.year,
    month: game.month,
    day: game.day,
    displayDate: formatDate(game.year, game.month, game.day),
    appliedOrders: queued.length,
    highlights:
      highlights.length > 0
        ? highlights.slice(0, 8)
        : ["No direct orders were applied this round. World evolution came from simulation dynamics."]
  };

  const roundEvent = createEvent(
    game,
    "system",
    "Round Resolved",
    `${queued.length} order(s) resolved. Global tension ${game.indicators.avgTension}, stability ${game.indicators.avgStability}.`,
    {
      locationLabel: game.playerCountryName,
      factionLabel: game.preset.title,
      mapChangeSummary: "The world map has been updated for the new round."
    }
  );

  pushEvent(game, roundEvent);
  eventIds.push(roundEvent.id);

  game.snapshots.push(createSnapshot(game, summaryText, eventIds));
  if (game.snapshots.length > 28) {
    game.snapshots = game.snapshots.slice(-28);
  }

  return majorEvent;
}

function queueOrderWithKind(game: GameState, text: string, overrides?: QueuedOrderOverrides): GameState {
  const trimmed = (overrides?.cleanedText ?? text).trim();
  if (!trimmed) {
    throw new Error("Order text cannot be empty.");
  }

  if (game.actionPoints <= 0 || game.queuedOrders.length >= game.maxActionPoints) {
    throw new Error("No action points available. Jump forward to start a new round.");
  }

  const resolvedKind = overrides?.kind ?? detectOrderKind(trimmed);
  const resolvedTargetCountryId = overrides?.targetCountryId ?? detectTargetCountryId(game, trimmed);

  const order: TurnOrder = {
    id: `${game.id}-order-${game.tick}-${game.queuedOrders.length + 1}`,
    text: trimmed,
    kind: resolvedKind,
    targetCountryId: resolvedTargetCountryId,
    status: "queued",
    tickSubmitted: game.tick
  };

  game.queuedOrders.push(order);
  game.actionPoints = clamp(game.actionPoints - 1, 0, game.maxActionPoints);
  game.selectedCountryId = resolvedTargetCountryId;
  game.tokenBalance = clampTokens(game.tokenBalance - 0.021);

  pushEvent(
    game,
    createEvent(
      game,
      "order",
      "Order Queued",
      `${resolvedKind.toUpperCase()} queued for ${safeCountryName(game, resolvedTargetCountryId)}.`,
      {
        countryId: resolvedTargetCountryId,
        locationLabel: safeCountryName(game, resolvedTargetCountryId),
        factionLabel: game.playerCountryName,
        mapChangeSummary: "The action is queued and will resolve on the next jump."
      }
    )
  );

  saveGame(game);
  return game;
}

export function queueOrder(game: GameState, text: string): GameState {
  return queueOrderWithKind(game, text);
}

export function queueOrderWithOverrides(game: GameState, text: string, overrides?: QueuedOrderOverrides): GameState {
  return queueOrderWithKind(game, text, overrides);
}

export function queueQuickAction(game: GameState, targetCountryId: string, kind: QuickActionKind): GameState {
  const target = getCountry(game, normalizeCountryId(targetCountryId));
  if (!target) {
    throw new Error("Target country not found.");
  }

  return queueOrderWithKind(game, createQuickActionText(kind, target.name), { kind, targetCountryId: target.id });
}

export function removeOrder(game: GameState, orderId: string): GameState {
  const index = game.queuedOrders.findIndex((order) => order.id === orderId);
  if (index < 0) {
    throw new Error("Order not found.");
  }

  const [removed] = game.queuedOrders.splice(index, 1);
  if (removed.status === "queued") {
    game.actionPoints = clamp(game.actionPoints + 1, 0, game.maxActionPoints);
  }

  removed.status = "cancelled";
  pushEvent(
    game,
    createEvent(
      game,
      "order",
      "Order Removed",
      `${removed.kind.toUpperCase()} removed from queue for ${safeCountryName(game, removed.targetCountryId)}.`,
      {
        countryId: removed.targetCountryId,
        locationLabel: safeCountryName(game, removed.targetCountryId),
        factionLabel: game.playerCountryName,
        mapChangeSummary: "The queued action has been cancelled before simulation."
      }
    )
  );

  saveGame(game);
  return game;
}

export function jumpForward(game: GameState, step: JumpStep): GameState {
  const loops = loopsForStep(step);
  const cadence = cadenceForStep(step);
  const start = { tick: game.tick, year: game.year, month: game.month, day: game.day };

  for (let i = 0; i < loops; i += 1) {
    runRound(game, cadence);
  }

  const jumpEvent = createEvent(
    game,
    "system",
    "Jump Forward",
    `Jump (${step.replace("_", " ")}) completed from ${formatDate(start.year, start.month, start.day)} to ${formatDate(game.year, game.month, game.day)}.`,
    {
      locationLabel: "Global",
      factionLabel: game.preset.title,
      mapChangeSummary: "The simulation advanced and the event window has been refreshed."
    }
  );
  pushEvent(game, jumpEvent);
  game.tokenBalance = clampTokens(game.tokenBalance - loops * 0.012);
  game.eventWindow = buildEventWindowForTickRange(
    game,
    { ...start, tick: start.tick + 1 },
    { tick: game.tick, year: game.year, month: game.month, day: game.day }
  );

  saveGame(game);
  return game;
}

function isMajor(event: GameEvent | null): boolean {
  return Boolean(event?.type.startsWith("major_"));
}

export function jumpToMajorEvent(game: GameState): GameState {
  const maxRounds = 18;
  const start = { tick: game.tick, year: game.year, month: game.month, day: game.day };
  let found: GameEvent | null = null;

  for (let i = 0; i < maxRounds; i += 1) {
    const major = runRound(game, "month");
    if (isMajor(major)) {
      found = major;
      break;
    }
  }

  const event = createEvent(
    game,
    found ? found.type : "system",
    "To Next Major Event",
    found
      ? `Reached a major event after ${game.tick - start.tick} rounds: ${found.title}.`
      : `No major event was detected after ${maxRounds} rounds.`,
    {
      locationLabel: found?.locationLabel ?? "Global",
      factionLabel: found?.factionLabel ?? game.preset.title,
      mapChangeSummary: found?.mapChangeSummary ?? "The world kept evolving without a flagship event."
    }
  );
  pushEvent(game, event);
  game.tokenBalance = clampTokens(game.tokenBalance - 0.083);
  game.eventWindow = buildEventWindowForTickRange(
    game,
    { ...start, tick: start.tick + 1 },
    { tick: game.tick, year: game.year, month: game.month, day: game.day }
  );

  saveGame(game);
  return game;
}

export function sendDiplomacyMessage(
  game: GameState,
  targetCountryId: string,
  message: string,
  outcome?: DiplomacyOutcome
): DiplomacyExchange {
  const target = getCountry(game, normalizeCountryId(targetCountryId));
  if (!target) {
    throw new Error("Target country not found.");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Diplomacy message cannot be empty.");
  }

  const resolved = outcome ?? fallbackDiplomacyOutcome(game, target.id, trimmed);
  target.relationToPlayer = clamp(target.relationToPlayer + resolved.relationDelta, -100, 100);
  target.tension = clamp(target.tension + resolved.tensionDelta, 0, 100);
  target.stability = clamp(target.stability + resolved.stabilityDelta, 0, 100);

  const exchange: DiplomacyExchange = {
    id: `${game.id}-dip-${game.tick}-${game.diplomacyLog.length + 1}`,
    tick: game.tick,
    year: game.year,
    month: game.month,
    day: game.day,
    dateLabel: formatDate(game.year, game.month, game.day),
    targetCountryId: target.id,
    targetCountryName: target.name,
    message: trimmed,
    stance: resolved.stance,
    reply: resolved.reply
  };

  game.diplomacyLog.unshift(exchange);
  if (game.diplomacyLog.length > 50) {
    game.diplomacyLog = game.diplomacyLog.slice(0, 50);
  }

  pushEvent(
    game,
    createEvent(
      game,
      "diplomacy",
      `Diplomatic Exchange: ${target.name}`,
      `${trimmed} | Reply: ${resolved.reply}`,
      {
        countryId: target.id,
        locationLabel: target.name,
        factionLabel: resolved.stance.toUpperCase(),
        mapChangeSummary:
          resolved.stance === "hostile" ? "Relations deteriorated." :
            resolved.stance === "friendly" ? "Relations improved." :
              "Relations remain uncertain."
      }
    )
  );

  game.tokenBalance = clampTokens(game.tokenBalance - 0.018);
  game.selectedCountryId = target.id;
  game.indicators = computeIndicators(game.countries);
  saveGame(game);
  return exchange;
}

export function applyRoundNarrativePatch(game: GameState, patch: RoundNarrativePatch): GameState {
  const targetEventId = game.eventWindow.activeEventId ?? game.eventWindow.eventIds[0] ?? game.events[0]?.id ?? null;
  const targetEvent = targetEventId ? game.events.find((event) => event.id === targetEventId) ?? null : null;

  if (targetEvent) {
    targetEvent.type = patch.type ?? targetEvent.type;
    targetEvent.title = patch.title;
    targetEvent.description = patch.description;
    targetEvent.mapChangeSummary = patch.mapChangeSummary;
    targetEvent.factionLabel = patch.factionLabel ?? targetEvent.factionLabel;
    targetEvent.locationLabel = patch.locationLabel ?? targetEvent.locationLabel;
  }

  if (game.lastRoundSummary && patch.highlights && patch.highlights.length > 0) {
    game.lastRoundSummary.highlights = patch.highlights;
  }

  const latestSnapshot = game.snapshots[game.snapshots.length - 1];
  if (latestSnapshot) {
    latestSnapshot.summary = patch.highlights?.[0] ?? patch.description;
  }

  saveGame(game);
  return game;
}
