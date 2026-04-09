import type {
  DiplomacyExchange,
  GameEvent,
  GameState,
  JumpStep,
  TurnOrder,
  TurnOrderKind
} from "@genesis/shared";
import {
  advanceCalendar,
  computeIndicators,
  normalizeCountryId,
  pushEvent,
  safeCountryName,
  saveGame
} from "./world.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  countryId?: string
): GameEvent {
  return {
    id: `${game.id}-evt-${game.tick}-${game.events.length + 1}`,
    type,
    tick: game.tick,
    year: game.year,
    month: game.month,
    title,
    description,
    countryId
  };
}

function detectOrderKind(text: string): TurnOrderKind {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(stabil|pacif|ordre|secur|calm|secure)\b/.test(normalized)) return "stabilize";
  if (/\b(invest|industry|eco|infrastructure|budget|commerce)\b/.test(normalized)) return "invest";
  if (/\b(alliance|treaty|pact|negot|diplom|talk|cooper)\b/.test(normalized)) return "diplomacy";
  if (/\b(attack|war|invade|military|offensive|strike)\b/.test(normalized)) return "military";
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

function applyOrderEffect(game: GameState, order: TurnOrder, highlights: string[]): void {
  const target = getCountry(game, order.targetCountryId);
  if (!target) return;

  const before = {
    wealth: target.wealth,
    stability: target.stability,
    tension: target.tension,
    relation: target.relationToPlayer
  };

  if (order.kind === "stabilize") {
    target.stability = clamp(target.stability + 8, 0, 100);
    target.tension = clamp(target.tension - 7, 0, 100);
    target.relationToPlayer = clamp(target.relationToPlayer + 3, -100, 100);
  } else if (order.kind === "invest") {
    target.wealth = clamp(target.wealth + 10, 0, 100);
    target.stability = clamp(target.stability + 3, 0, 100);
    target.tension = clamp(target.tension + 1, 0, 100);
  } else if (order.kind === "diplomacy") {
    target.relationToPlayer = clamp(target.relationToPlayer + 10, -100, 100);
    target.tension = clamp(target.tension - 3, 0, 100);
    target.stability = clamp(target.stability + 1, 0, 100);
  } else if (order.kind === "military") {
    target.tension = clamp(target.tension + 12, 0, 100);
    target.stability = clamp(target.stability - 8, 0, 100);
    target.wealth = clamp(target.wealth - 4, 0, 100);
    target.relationToPlayer = clamp(target.relationToPlayer - 12, -100, 100);
  } else {
    target.tension = clamp(target.tension + 7, 0, 100);
    target.stability = clamp(target.stability - 2, 0, 100);
    target.relationToPlayer = clamp(target.relationToPlayer - 6, -100, 100);
  }

  highlights.push(
    `${order.kind.toUpperCase()} on ${target.name}: W ${before.wealth}->${target.wealth}, S ${before.stability}->${target.stability}, T ${before.tension}->${target.tension}`
  );

  pushEvent(
    game,
    createEvent(
      game,
      "order",
      `Order Applied: ${order.kind}`,
      `${safeCountryName(game, order.targetCountryId)} impacted by order: "${order.text}".`,
      order.targetCountryId
    )
  );
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

    if (country.id !== game.playerCountryId) {
      const relationDrift = country.relationToPlayer > 0 ? -1 : country.relationToPlayer < 0 ? 1 : 0;
      country.relationToPlayer = clamp(country.relationToPlayer + relationDrift, -100, 100);
    }
  }

  const indicators = computeIndicators(game.countries);
  const highTension = game.countries.filter((country) => country.tension >= 74);
  const worstRelation = [...game.countries].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];

  if (highTension.length >= Math.ceil(game.countries.length * 0.2)) {
    const target = [...highTension].sort((a, b) => b.tension - a.tension)[0];
    return createEvent(
      game,
      "major_crisis",
      "Regional Crisis Escalates",
      `${target.name} becomes a flashpoint with severe domestic pressure and external risk.`,
      target.id
    );
  }

  if (indicators.avgStability >= 66 && game.tick % 4 === 0) {
    return createEvent(
      game,
      "major_diplomacy",
      "Bloc Summit",
      "A new diplomatic summit reshapes alignments between major blocs."
    );
  }

  if (indicators.avgWealth >= 64 && game.tick % 6 === 0) {
    return createEvent(
      game,
      "major_growth",
      "Global Growth Wave",
      "Economic momentum spreads across multiple regions, accelerating strategic competition."
    );
  }

  if (worstRelation && worstRelation.relationToPlayer <= -65 && game.tick % 5 === 0) {
    return createEvent(
      game,
      "major_conflict",
      "Strategic Confrontation",
      `${worstRelation.name} enters open confrontation rhetoric against your bloc.`,
      worstRelation.id
    );
  }

  return null;
}

function runRound(game: GameState): GameEvent | null {
  const queued = [...game.queuedOrders];
  game.queuedOrders = [];

  const highlights: string[] = [];
  for (const order of queued) {
    order.status = "resolved";
    applyOrderEffect(game, order, highlights);
  }

  game.tick += 1;
  advanceCalendar(game);

  const majorEvent = simulateNaturalDynamics(game);
  if (majorEvent) {
    pushEvent(game, majorEvent);
  }

  game.actionPoints = game.maxActionPoints;
  game.indicators = computeIndicators(game.countries);

  game.lastRoundSummary = {
    tick: game.tick,
    year: game.year,
    month: game.month,
    appliedOrders: queued.length,
    highlights:
      highlights.length > 0
        ? highlights.slice(0, 8)
        : ["No direct orders were applied this round. World evolution came from simulation dynamics."]
  };

  pushEvent(
    game,
    createEvent(
      game,
      "system",
      "Round Resolved",
      `${queued.length} order(s) resolved. Global tension ${game.indicators.avgTension}, stability ${game.indicators.avgStability}.`
    )
  );

  return majorEvent;
}

function ticksForStep(step: JumpStep): number {
  if (step === "week") return 1;
  if (step === "month") return 1;
  if (step === "quarter") return 3;
  return 12;
}

export function queueOrder(game: GameState, text: string): GameState {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Order text cannot be empty.");
  }

  if (game.actionPoints <= 0 || game.queuedOrders.length >= game.maxActionPoints) {
    throw new Error("No action points available. Jump forward to start a new round.");
  }

  const kind = detectOrderKind(trimmed);
  const targetCountryId = detectTargetCountryId(game, trimmed);

  const order: TurnOrder = {
    id: `${game.id}-order-${game.tick}-${game.queuedOrders.length + 1}`,
    text: trimmed,
    kind,
    targetCountryId,
    status: "queued",
    tickSubmitted: game.tick
  };

  game.queuedOrders.push(order);
  game.actionPoints = clamp(game.actionPoints - 1, 0, game.maxActionPoints);

  pushEvent(
    game,
    createEvent(
      game,
      "order",
      "Order Queued",
      `${kind.toUpperCase()} queued for ${safeCountryName(game, targetCountryId)}.`,
      targetCountryId
    )
  );

  saveGame(game);
  return game;
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
      removed.targetCountryId
    )
  );

  saveGame(game);
  return game;
}

export function jumpForward(game: GameState, step: JumpStep): GameState {
  const ticks = ticksForStep(step);
  const startTick = game.tick;
  const startYear = game.year;
  const startMonth = game.month;

  for (let i = 0; i < ticks; i += 1) {
    runRound(game);
  }

  pushEvent(
    game,
    createEvent(
      game,
      "system",
      "Jump Forward",
      `Jump (${step}) completed: ${startYear}-${startMonth} (tick ${startTick}) -> ${game.year}-${game.month} (tick ${game.tick}).`
    )
  );

  saveGame(game);
  return game;
}

function isMajor(event: GameEvent | null): boolean {
  if (!event) return false;
  return event.type.startsWith("major_");
}

export function jumpToMajorEvent(game: GameState): GameState {
  const maxRounds = 18;
  const startTick = game.tick;
  let found: GameEvent | null = null;

  for (let i = 0; i < maxRounds; i += 1) {
    const major = runRound(game);
    if (isMajor(major)) {
      found = major;
      break;
    }
  }

  pushEvent(
    game,
    createEvent(
      game,
      found ? found.type : "system",
      "Next Major Event",
      found
        ? `Reached major event after ${game.tick - startTick} rounds: ${found.title}.`
        : `No major event detected after ${maxRounds} rounds.`
    )
  );

  saveGame(game);
  return game;
}

export function sendDiplomacyMessage(game: GameState, targetCountryId: string, message: string): DiplomacyExchange {
  const target = getCountry(game, normalizeCountryId(targetCountryId));
  if (!target) {
    throw new Error("Target country not found.");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Diplomacy message cannot be empty.");
  }

  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aggressive = /\b(attack|war|ultimatum|sanction|threat|invade)\b/.test(normalized);
  const cooperative = /\b(alliance|pact|trade|peace|cooperation|accord)\b/.test(normalized);

  let stance: DiplomacyExchange["stance"] = "neutral";
  if (aggressive || target.relationToPlayer <= -35 || target.tension >= 70) {
    stance = "hostile";
  } else if (cooperative || target.relationToPlayer >= 25 || target.tension <= 40) {
    stance = "friendly";
  }

  if (stance === "hostile") {
    target.relationToPlayer = clamp(target.relationToPlayer - 10, -100, 100);
    target.tension = clamp(target.tension + 4, 0, 100);
  } else if (stance === "friendly") {
    target.relationToPlayer = clamp(target.relationToPlayer + 10, -100, 100);
    target.tension = clamp(target.tension - 3, 0, 100);
    target.stability = clamp(target.stability + 1, 0, 100);
  } else {
    target.relationToPlayer = clamp(target.relationToPlayer + 1, -100, 100);
  }

  const reply =
    stance === "hostile"
      ? `${target.name} rejects your position and shifts to defensive mobilization.`
      : stance === "friendly"
        ? `${target.name} accepts opening a negotiation channel and signals willingness for a phased agreement.`
        : `${target.name} remains cautious and requests concrete guarantees before committing.`;

  const exchange: DiplomacyExchange = {
    id: `${game.id}-dip-${game.tick}-${game.diplomacyLog.length + 1}`,
    tick: game.tick,
    year: game.year,
    month: game.month,
    targetCountryId: target.id,
    targetCountryName: target.name,
    message: trimmed,
    stance,
    reply
  };

  game.diplomacyLog.unshift(exchange);
  if (game.diplomacyLog.length > 40) {
    game.diplomacyLog = game.diplomacyLog.slice(0, 40);
  }

  pushEvent(
    game,
    createEvent(
      game,
      "diplomacy",
      `Diplomatic Exchange: ${target.name}`,
      `${trimmed} | Reply: ${reply}`,
      target.id
    )
  );

  game.indicators = computeIndicators(game.countries);
  saveGame(game);
  return exchange;
}
