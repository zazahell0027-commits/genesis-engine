import type {
  AdvisorResponse,
  AdvisorSuggestion,
  CreateGameInput,
  DiplomacyInput,
  GameState,
  JumpInput,
  QuickActionInput,
  QueueOrderInput,
  RemoveOrderInput,
  TurnOrderKind
} from "@genesis/shared";
import type { Request, Response } from "express";
import type { AIProvider } from "./ai/types.js";
import {
  applyRoundNarrativePatch,
  jumpForward,
  jumpToMajorEvent,
  queueOrderWithOverrides,
  queueQuickAction,
  removeOrder,
  sendDiplomacyMessage
} from "./simulation.js";
import {
  computeIndicators,
  createGame,
  deleteGame,
  earnTokens,
  formatDate,
  getGame,
  getGameSetupOptions,
  getPresetBrowser,
  getTokenBalance,
  listCountries,
  listGameSessions,
  listPresetCategories,
  listScenarios,
  monthLabel,
  saveGame,
  spendTokens
} from "./world.js";

type LoadedGame = NonNullable<ReturnType<typeof getGame>>;
type LoadedCountry = LoadedGame["countries"][number];
type AdvisorFrame = {
  game: LoadedGame;
  locale: "fr" | "en";
  countries: LoadedCountry[];
  indicators: LoadedGame["indicators"];
  tick: number;
  year: number;
  month: number;
  day: number;
  dateLabel: string;
  snapshotId?: string;
  eventIds: string[];
};

type ParsedContextPrompt = {
  surfaceKind: "country" | "ocean" | "void" | "orbital" | "lunar" | "unknown";
  placeLabel: string;
  coordinates: string;
};

function actionTagForKind(kind: TurnOrderKind, french: boolean): string {
  if (kind === "diplomacy") return french ? "Canal diplomatique" : "Diplomatic channel";
  if (kind === "defend") return french ? "Defense locale" : "Local defense";
  if (kind === "stabilize") return french ? "Stabilisation" : "Stabilization";
  if (kind === "invest") return french ? "Projection" : "Projection";
  if (kind === "pressure") return french ? "Pression" : "Pressure";
  return french ? "Offensive" : "Offensive";
}

function contextActionTag(
  surfaceKind: ParsedContextPrompt["surfaceKind"],
  kind: TurnOrderKind,
  french: boolean
): string {
  if (surfaceKind === "country") {
    if (kind === "diplomacy") return french ? "Canal local" : "Local channel";
    if (kind === "defend") return french ? "Defense locale" : "Local defense";
    if (kind === "stabilize") return french ? "Stabilisation locale" : "Local stabilization";
    if (kind === "invest") return french ? "Action territoriale" : "Territorial move";
    if (kind === "pressure") return french ? "Pression locale" : "Local pressure";
    return french ? "Offensive locale" : "Local offensive";
  }

  if (surfaceKind === "ocean") {
    if (kind === "defend") return french ? "Veille navale" : "Naval watch";
    if (kind === "invest") return french ? "Route maritime" : "Sea route";
    if (kind === "stabilize") return french ? "Reconnaissance maritime" : "Maritime reconnaissance";
    if (kind === "diplomacy") return french ? "Canal maritime" : "Maritime channel";
    return french ? "Projection navale" : "Naval projection";
  }

  if (surfaceKind === "void" || surfaceKind === "unknown") {
    if (kind === "stabilize") return french ? "Renseignement" : "Intelligence";
    if (kind === "invest") return french ? "Extension de carte" : "Map expansion";
    if (kind === "defend") return french ? "Surveillance" : "Surveillance";
    if (kind === "diplomacy") return french ? "Observation" : "Observation";
    return french ? "Exploration" : "Exploration";
  }

  if (surfaceKind === "orbital" || surfaceKind === "lunar") {
    if (kind === "invest") return french ? "Point d'appui" : "Anchor point";
    if (kind === "stabilize") return french ? "Veille spatiale" : "Space watch";
    if (kind === "diplomacy") return french ? "Preparation orbitale" : "Orbital prep";
    if (kind === "defend") return french ? "Bouclier orbital" : "Orbital shield";
    return french ? "Projection spatiale" : "Space projection";
  }

  return actionTagForKind(kind, french);
}

const STRATEGIC_COUNTRY_IDS = new Set([
  "united states",
  "china",
  "russia",
  "france",
  "united kingdom",
  "germany",
  "japan",
  "india",
  "italy",
  "turkey",
  "brazil",
  "poland",
  "iran",
  "ukraine",
  "saudi arabia"
]);

function ensureString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function blocSummaryFromGame(gameId: string) {
  const game = getGame(gameId);
  if (!game) return "";
  return blocSummaryFromCountries(game.countries);
}

function blocSummaryFromCountries(countries: LoadedCountry[]): string {
  const blocCounts = new Map<string, number>();
  for (const country of countries) {
    blocCounts.set(country.bloc, (blocCounts.get(country.bloc) ?? 0) + 1);
  }

  return [...blocCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bloc, count]) => `${bloc}(${count})`)
    .join(", ");
}

function pickStrategicThreat(frame: AdvisorFrame): LoadedCountry | undefined {
  const { game, countries } = frame;
  const player = countries.find((country) => country.id === game.playerCountryId) ?? countries[0];
  const scoped = countries
    .filter((country) => country.id !== game.playerCountryId)
    .filter((country) => (
      country.continent === player.continent ||
      STRATEGIC_COUNTRY_IDS.has(country.id) ||
      game.preset.recommendedCountries.includes(country.id)
    ));
  const candidates = scoped.length > 0
    ? scoped
    : countries
      .filter((country) => country.id !== game.playerCountryId)
      .filter((country) => country.power >= 45 || country.army >= 6);
  const recommendedPool = countries
    .filter((country) => country.id !== game.playerCountryId)
    .filter((country) => game.preset.recommendedCountries.includes(country.id));
  const threatPool = recommendedPool.length > 0 ? recommendedPool : candidates;

  return threatPool
    .map((country) => ({
      country,
      score:
        Math.max(0, -country.relationToPlayer) * 1.8 +
        country.tension * 1.05 +
        country.power * 0.9 +
        country.army * 2.2 +
        (country.continent === player.continent ? 26 : -10) +
        (STRATEGIC_COUNTRY_IDS.has(country.id) || game.preset.recommendedCountries.includes(country.id) ? 22 : -8)
    }))
    .sort((a, b) => b.score - a.score)[0]?.country;
}

function pickStrategicPartner(frame: AdvisorFrame): LoadedCountry | undefined {
  const { game, countries } = frame;
  const player = countries.find((country) => country.id === game.playerCountryId) ?? countries[0];
  const scoped = countries
    .filter((country) => country.id !== game.playerCountryId)
    .filter((country) => (
      country.continent === player.continent ||
      STRATEGIC_COUNTRY_IDS.has(country.id) ||
      game.preset.recommendedCountries.includes(country.id)
    ));
  const candidates = scoped.length > 0
    ? scoped
    : countries
      .filter((country) => country.id !== game.playerCountryId)
      .filter((country) => country.power >= 42 || country.relationToPlayer >= 18);
  const recommendedPool = countries
    .filter((country) => country.id !== game.playerCountryId)
    .filter((country) => game.preset.recommendedCountries.includes(country.id));
  const partnerPool = recommendedPool.length > 0 ? recommendedPool : candidates;

  return partnerPool
    .map((country) => ({
      country,
      score:
        country.relationToPlayer * 1.9 +
        country.stability * 1.1 +
        country.wealth * 0.7 +
        country.power * 0.75 -
        country.tension * 0.85 +
        (country.continent === player.continent ? 18 : 0) +
        (STRATEGIC_COUNTRY_IDS.has(country.id) || game.preset.recommendedCountries.includes(country.id) ? 14 : -6)
    }))
    .sort((a, b) => b.score - a.score)[0]?.country;
}

function buildAdvisorInsights(frame: AdvisorFrame): string[] {
  const { game, countries, indicators } = frame;
  const player = countries.find((country) => country.id === game.playerCountryId) ?? countries[0];
  const topThreat = pickStrategicThreat(frame);
  const bestPartner = pickStrategicPartner(frame);
  const french = frame.locale === "fr";

  const insights: string[] = [
    french
      ? `Pression mondiale: stabilite ${indicators.avgStability}, richesse ${indicators.avgWealth}, tension ${indicators.avgTension} (${indicators.conflictLevel}).`
      : `World pressure: stability ${indicators.avgStability}, wealth ${indicators.avgWealth}, tension ${indicators.avgTension} (${indicators.conflictLevel}).`,
    french
      ? `${player.name}: stabilite ${player.stability}, agitation ${player.unrest}, armee ${player.army}, industrie ${player.industry}.`
      : `${player.name}: stability ${player.stability}, unrest ${player.unrest}, army ${player.army}, industry ${player.industry}.`
  ];

  if (topThreat) {
    insights.push(
      french
        ? `Menace principale: ${topThreat.name} (relation ${topThreat.relationToPlayer}, tension ${topThreat.tension}).`
        : `Primary threat: ${topThreat.name} (relation ${topThreat.relationToPlayer}, tension ${topThreat.tension}).`
    );
  }
  if (bestPartner && bestPartner.relationToPlayer > 0) {
    insights.push(
      french
        ? `Meilleur canal diplomatique: ${bestPartner.name} (relation ${bestPartner.relationToPlayer}).`
        : `Best diplomatic channel: ${bestPartner.name} (relation ${bestPartner.relationToPlayer}).`
    );
  }

  return insights.slice(0, 4);
}

function parseContextPrompt(question: string): ParsedContextPrompt | null {
  const surfaceMatch = question.match(/Surface:\s*([^\.]+)\./i);
  const placeMatch = question.match(/L'utilisateur a clique droit sur\s+(.+?)\./i) ?? question.match(/The user right-clicked on\s+(.+?)\./i);
  const coordinatesMatch = question.match(/Coordonnees:\s*([^\.\n]+)/i) ?? question.match(/Coordinates:\s*([^\.\n]+)/i);
  if (!surfaceMatch && !placeMatch && !coordinatesMatch) return null;

  const surfaceValue = (surfaceMatch?.[1] ?? "").trim().toLowerCase();
  const surfaceKind: ParsedContextPrompt["surfaceKind"] =
    surfaceValue.includes("terre") || surfaceValue.includes("land") ? "country" :
    surfaceValue.includes("ocean") || surfaceValue.includes("maritime") ? "ocean" :
    surfaceValue.includes("orbite") || surfaceValue.includes("orbital") ? "orbital" :
    surfaceValue.includes("lune") || surfaceValue.includes("lunar") ? "lunar" :
    surfaceValue.includes("vide") || surfaceValue.includes("empty") ? "void" :
    "unknown";

  return {
    surfaceKind,
    placeLabel: (placeMatch?.[1] ?? "").trim(),
    coordinates: (coordinatesMatch?.[1] ?? "").trim()
  };
}

function buildContextSuggestions(frame: AdvisorFrame, question: string): AdvisorSuggestion[] | null {
  const context = parseContextPrompt(question);
  if (!context) return null;
  const parsedContext = context;

  const french = frame.locale === "fr";
  const player = frame.countries.find((country) => country.id === frame.game.playerCountryId) ?? frame.countries[0];
  const baseLabel = parsedContext.placeLabel || (french ? frame.game.playerCountryName : frame.game.playerCountryName);

  function suggestion(
    label: string,
    rationale: string,
    impact: string,
    kind: TurnOrderKind,
    orderText: string,
    urgency: AdvisorSuggestion["urgency"] = "medium"
  ): AdvisorSuggestion {
    return {
      id: `context:${kind}:${frame.game.playerCountryId}:${label}`,
      label,
      actionTag: contextActionTag(parsedContext.surfaceKind, kind, french),
      rationale,
      impact,
      kind,
      urgency,
      orderText,
      targetCountryId: parsedContext.surfaceKind === "country" ? frame.game.selectedCountryId : frame.game.playerCountryId,
      targetCountryName: baseLabel
    };
  }

  if (parsedContext.surfaceKind === "country") {
    return [
      suggestion(
        french ? `Analyser ${baseLabel}` : `Analyze ${baseLabel}`,
        french
          ? "Lire la position locale, la pression et les angles d'action."
          : "Read the local position, pressure, and possible angles of action.",
        french
          ? "Donne une base claire avant tout engagement."
          : "Gives a clear base before any commitment.",
        "pressure",
        french
          ? `Analysez la situation locale autour de ${baseLabel} et identifiez le point faible principal.`
          : `Analyze the local situation around ${baseLabel} and identify the main weak point.`,
        "high"
      ),
      suggestion(
        french ? `Ouvrir des canaux avec ${baseLabel}` : `Open channels with ${baseLabel}`,
        french
          ? "Proposer un échange ou une détente peut ouvrir le jeu sans surcoût immédiat."
          : "Offering an exchange or de-escalation can open the game without immediate cost.",
        french
          ? "Baisse de tension et meilleure lecture diplomatique."
          : "Lower tension and better diplomatic reading.",
        "diplomacy",
        french
          ? `Proposez un canal diplomatique ciblé avec ${baseLabel}.`
          : `Propose a targeted diplomatic channel with ${baseLabel}.`,
        "medium"
      ),
      suggestion(
        french ? `Préparer une action locale sur ${baseLabel}` : `Prepare a local move on ${baseLabel}`,
        french
          ? "Investissement, pression ou stabilisation selon le contexte local."
          : "Investment, pressure, or stabilization depending on the local context.",
        french
          ? "Action concrète liée à l'endroit exact."
          : "Concrete action tied to the exact spot.",
        "invest",
        french
          ? `Préparez une action locale cohérente sur ${baseLabel} en tenant compte des frontières voisines.`
          : `Prepare a local action on ${baseLabel} that fits the surrounding borders.`,
        "medium"
      )
    ];
  }

  if (parsedContext.surfaceKind === "void" || parsedContext.surfaceKind === "unknown") {
    return [
      suggestion(
        french ? "Lire le vide" : "Read the empty zone",
        french
          ? "Utiliser les coordonnees pour comprendre ce que la carte ne montre pas encore."
          : "Use the coordinates to understand what the map does not yet reveal.",
        french
          ? "Preparer la prochaine couche de lecture."
          : "Prepares the next reading layer.",
        "stabilize",
        french
          ? `Analysez la zone vide autour de ${baseLabel}${parsedContext.coordinates ? ` (${parsedContext.coordinates})` : ""}.`
          : `Analyze the empty area around ${baseLabel}${parsedContext.coordinates ? ` (${parsedContext.coordinates})` : ""}.`,
        "low"
      ),
      suggestion(
        french ? "Prolonger la lecture" : "Extend the reading",
        french
          ? "Un point sans acteur peut encore devenir utile par exploration ou projection."
          : "A point without an actor can still become useful through exploration or projection.",
        french
          ? "Ouvre une piste de reconnaissance."
          : "Opens a reconnaissance path.",
        "invest",
        french
          ? "Etendez la lecture locale vers la zone la plus proche de votre frontiere active."
          : "Extend the local reading toward the nearest active frontier.",
        "medium"
      ),
      suggestion(
        french ? "Orienter la surveillance" : "Orient surveillance",
        french
          ? "Le vide cartographique sert souvent de couloir pour des deplacements ou des surprises."
          : "Map voids often become corridors for movement or surprise.",
        french
          ? "Renforce le renseignement sans engager de front."
          : "Strengthens intelligence without committing to a front.",
        "defend",
        french
          ? "Placez une surveillance sur ce point pour reveler toute mutation locale."
          : "Place surveillance on this point to reveal local change.",
        "medium"
      )
    ];
  }

  if (parsedContext.surfaceKind === "ocean") {
    return [
      suggestion(
        french ? "Surveiller la zone maritime" : "Monitor the sea zone",
        french
          ? "Lire la route, les risques et les couloirs de passage."
          : "Read the route, risks, and transit corridors.",
        french
          ? "Vision navale et renseignement renforcés."
          : "Improved naval awareness and intelligence.",
        "defend",
        french
          ? "Installez une surveillance navale sur cette zone maritime."
          : "Install naval surveillance over this sea zone.",
        "medium"
      ),
      suggestion(
        french ? "Tracer une route" : "Plot a route",
        french
          ? "Une route commerciale ou logistique peut transformer l'océan en levier."
          : "A commercial or logistical route can turn the ocean into leverage.",
        french
          ? "Prépare la circulation et la projection."
          : "Prepares movement and projection.",
        "invest",
        french
          ? "Tracez une route maritime utile autour de ce point."
          : "Plot a useful maritime route around this point.",
        "low"
      ),
      suggestion(
        french ? "Déployer reconnaissance" : "Deploy reconnaissance",
        french
          ? "Chercher des opportunités ou des menaces invisibles à l'échelle terrestre."
          : "Search for opportunities or threats invisible at land scale.",
        french
          ? "Renseignement et exploration stratégique."
          : "Strategic reconnaissance and exploration.",
        "stabilize",
        french
          ? "Déployez une reconnaissance sur cette zone pour révéler le terrain caché."
          : "Deploy reconnaissance over this area to reveal hidden terrain.",
        "medium"
      )
    ];
  }

  if (parsedContext.surfaceKind === "orbital" || parsedContext.surfaceKind === "lunar") {
    return [
      suggestion(
        french ? "Identifier un point d'appui" : "Identify an anchor point",
        french
          ? "Choisir une position utile pour l'orbite ou la surface lunaire."
          : "Pick a useful position for orbit or lunar surface operations.",
        french
          ? "Base de projection spatiale."
          : "Space projection base.",
        "invest",
        french
          ? "Choisissez un point d'appui pour la couche spatiale."
          : "Choose an anchor point for the space layer.",
        "high"
      ),
      suggestion(
        french ? "Lancer une veille spatiale" : "Launch space watch",
        french
          ? "Observer la zone pour repérer fenêtres et risques."
          : "Observe the zone to identify windows and risks.",
        french
          ? "Meilleure lecture des opportunités orbitales."
          : "Better reading of orbital opportunities.",
        "stabilize",
        french
          ? "Lancez une veille spatiale sur cette zone."
          : "Launch space watch over this area.",
        "medium"
      ),
      suggestion(
        french ? "Préparer la suite" : "Prepare the next step",
        french
          ? "Transformer cette lecture en objectif de progression."
          : "Turn this reading into a progression objective.",
        french
          ? "Aide à passer de la Terre à l'orbite ou à la Lune."
          : "Helps move from Earth to orbit or to the Moon.",
        "diplomacy",
        french
          ? "Préparez la prochaine étape spatiale autour de ce point."
          : "Prepare the next space step around this point.",
        "medium"
      )
    ];
  }

  return null;
}

function buildAdvisorSuggestions(frame: AdvisorFrame, question?: string): AdvisorSuggestion[] {
  if (question) {
    const contextual = buildContextSuggestions(frame, question);
    if (contextual && contextual.length > 0) return contextual.slice(0, 3);
  }

  const { game, countries } = frame;
  const player = countries.find((country) => country.id === game.playerCountryId) ?? countries[0];
  const rivals = countries.filter((country) => country.id !== game.playerCountryId);
  const topThreat = pickStrategicThreat(frame);
  const bestPartner = pickStrategicPartner(frame);
  const weakestState = [...rivals]
    .filter((country) => country.power >= 34)
    .sort((a, b) => a.stability - b.stability)[0];
  const playerCountryId = game.playerCountryId;
  const french = frame.locale === "fr";

  const suggestions: AdvisorSuggestion[] = [];
  function pushSuggestion(input: {
    label: string;
    actionTag: string;
    rationale: string;
    impact: string;
    kind: TurnOrderKind;
    urgency: AdvisorSuggestion["urgency"];
    orderText: string;
    targetCountryId?: string;
    targetCountryName?: string;
  }): void {
    const idBase = `${input.kind}:${input.targetCountryId ?? playerCountryId}:${suggestions.length + 1}`;
    suggestions.push({
      id: idBase,
      ...input
    });
  }

  if (topThreat) {
    pushSuggestion({
      label: french ? `Renforcer la frontiere face a ${topThreat.name}` : `Harden frontier vs ${topThreat.name}`,
      actionTag: actionTagForKind("defend", french),
      rationale: french
        ? `${topThreat.name} est actuellement votre principale source de pression.`
        : `${topThreat.name} is currently your strongest pressure source.`,
      impact: french
        ? "Posture defensive renforcee, risque de stabilite immediate contenu."
        : "Defensive posture up, short-term stability risk contained.",
      kind: "defend",
      urgency: topThreat.relationToPlayer <= -35 || topThreat.tension >= 70 ? "high" : "medium",
      orderText: french
        ? `Fortifiez les positions face a ${topThreat.name}, faites tourner les reserves, et priorisez la defense plutot que l'expansion.`
        : `Fortify frontier positions facing ${topThreat.name}, rotate reserves, and prioritize defensive readiness over expansion.`,
      targetCountryId: topThreat.id,
      targetCountryName: topThreat.name
    });
  }

  if (player.unrest >= 4 || player.stability <= 55) {
    pushSuggestion({
      label: french ? "Stabiliser la pression interne" : "Stabilize internal pressure",
      actionTag: actionTagForKind("stabilize", french),
      rationale: french
        ? `La pression interne est elevee (${player.unrest} agitation, ${player.stability} stabilite).`
        : `Domestic pressure is elevated (${player.unrest} unrest, ${player.stability} stability).`,
      impact: french
        ? "Stabilite en hausse, tension en baisse, prochains sauts plus surs."
        : "Stability up, tension down, safer next jumps.",
      kind: "stabilize",
      urgency: player.unrest >= 6 || player.stability <= 46 ? "high" : "medium",
      orderText: french
        ? "Lancez un paquet de stabilisation interne avec aide, maintien de l'ordre et communication politique pour reduire l'agitation."
        : "Launch a domestic stabilization package with relief, policing, and political messaging to reduce unrest.",
      targetCountryId: game.playerCountryId,
      targetCountryName: game.playerCountryName
    });
  }

  if (player.industry <= 6 || player.wealth <= 57) {
    pushSuggestion({
      label: french ? "Renforcer l'industrie et la logistique" : "Boost industry and logistics",
      actionTag: actionTagForKind("invest", french),
      rationale: french
        ? "La profondeur economique reste sous votre seuil d'expansion."
        : "Economic depth is below your expansion threshold.",
      impact: french
        ? "Croissance de l'industrie et de la richesse pour renforcer le levier moyen terme."
        : "Industry and wealth growth for medium-term leverage.",
      kind: "invest",
      urgency: "medium",
      orderText: french
        ? "Accélérez l'investissement industriel et logistique, avec un focus sur le rail, les ports et la production critique."
        : "Accelerate industrial and logistics investment focused on rail, ports, and critical production.",
      targetCountryId: game.playerCountryId,
      targetCountryName: game.playerCountryName
    });
  }

  if (bestPartner && bestPartner.relationToPlayer >= 8) {
    pushSuggestion({
      label: french ? `Ouvrir des discussions avec ${bestPartner.name}` : `Open talks with ${bestPartner.name}`,
      actionTag: actionTagForKind("diplomacy", french),
      rationale: french
        ? "C'est votre meilleure ouverture diplomatique actuelle."
        : "This is your best current diplomatic opening.",
      impact: french
        ? "Gain relationnel potentiel et baisse de tension regionale."
        : "Potential relation gain and lower regional tension.",
      kind: "diplomacy",
      urgency: "medium",
      orderText: french
        ? `Proposez a ${bestPartner.name} un accord progressif de securite et d'echanges, avec verification et clauses de non-agression.`
        : `Propose a phased security and trade understanding with ${bestPartner.name}, with verification and non-aggression clauses.`,
      targetCountryId: bestPartner.id,
      targetCountryName: bestPartner.name
    });
  }

  if (topThreat && (topThreat.relationToPlayer <= -58 || topThreat.tension >= 78) && player.power >= topThreat.power - 3) {
    pushSuggestion({
      label: french ? `Preparer une pression sur ${topThreat.name}` : `Prepare pressure on ${topThreat.name}`,
      actionTag: actionTagForKind("attack", french),
      rationale: french
        ? "Les conditions d'escalade sont reunies et votre rapport de force le permet."
        : "Escalation conditions are met and your balance of power is viable.",
      impact: french
        ? "Pression et dissuasion plus fortes, au prix d'une tension accrue."
        : "Higher pressure and deterrence at the cost of tension.",
      kind: "attack",
      urgency: "medium",
      orderText: french
        ? `Preparez une campagne de pression coordonnee contre ${topThreat.name} avec readiness militaire et escalation controlee.`
        : `Prepare a coordinated pressure campaign against ${topThreat.name} with military readiness and controlled escalation.`,
      targetCountryId: topThreat.id,
      targetCountryName: topThreat.name
    });
  } else if (weakestState && weakestState.stability <= 42) {
    pushSuggestion({
      label: french ? `Exploiter l'instabilite autour de ${weakestState.name}` : `Exploit instability around ${weakestState.name}`,
      actionTag: actionTagForKind("pressure", french),
      rationale: french
        ? `${weakestState.name} est le systeme voisin le plus fragile de ce tour.`
        : `${weakestState.name} is the weakest nearby system this round.`,
      impact: french
        ? "Hausse de l'influence regionale avec un cout diplomatique maitrise."
        : "Regional leverage increase with manageable diplomatic fallout.",
      kind: "pressure",
      urgency: "low",
      orderText: french
        ? `Appliquez une pression politique et economique calibree autour de ${weakestState.name} tout en conservant un degre de deniabilite.`
        : `Apply calibrated political and economic pressure around ${weakestState.name} while keeping deniability.`,
      targetCountryId: weakestState.id,
      targetCountryName: weakestState.name
    });
  }

  if (suggestions.length === 0) {
    pushSuggestion({
      label: french ? "Consolider l'arriere" : "Consolidate home front",
      actionTag: actionTagForKind("stabilize", french),
      rationale: french
        ? "Aucun declencheur externe urgent n'a ete detecte sur ce tour."
        : "No urgent external trigger was detected this round.",
      impact: french
        ? "Base plus sure avant le prochain saut."
        : "Safer baseline before the next jump.",
      kind: "stabilize",
      urgency: "low",
      orderText: french
        ? "Consolidez la stabilite interne, renforcez la resilience et evitez toute escalation inutile."
        : "Consolidate domestic stability, improve resilience, and avoid unnecessary escalation.",
      targetCountryId: game.playerCountryId,
      targetCountryName: game.playerCountryName
    });
  }

  return suggestions.slice(0, 5);
}

function buildAdvisorFrame(game: LoadedGame, locale: "fr" | "en", snapshotId?: string): AdvisorFrame {
  if (!snapshotId) {
    return {
      game,
      locale,
      countries: game.countries,
      indicators: game.indicators,
      tick: game.tick,
      year: game.year,
      month: game.month,
      day: game.day,
      dateLabel: game.displayDate,
      eventIds: game.eventWindow.eventIds
    };
  }

  const snapshot = game.snapshots.find((entry) => entry.id === snapshotId);
  if (!snapshot) {
    return {
      game,
      locale,
      countries: game.countries,
      indicators: game.indicators,
      tick: game.tick,
      year: game.year,
      month: game.month,
      day: game.day,
      dateLabel: game.displayDate,
      eventIds: game.eventWindow.eventIds
    };
  }

  return {
    game,
    locale,
    countries: snapshot.countries,
    indicators: computeIndicators(snapshot.countries),
    tick: snapshot.tick,
    year: snapshot.year,
    month: snapshot.month,
    day: snapshot.day,
    dateLabel: snapshot.displayDate,
    snapshotId: snapshot.id,
    eventIds: snapshot.eventIds
  };
}

function summarizeQueuedOrders(game: LoadedGame): string {
  if (game.queuedOrders.length === 0) return "none";
  return game.queuedOrders
    .slice(0, 4)
    .map((order) => `${order.kind.toUpperCase()} -> ${order.targetCountryId}`)
    .join("; ");
}

function summarizeRecentDiplomacy(game: LoadedGame, targetCountryId?: string): string {
  const selected = game.diplomacyLog
    .filter((entry) => !targetCountryId || entry.targetCountryId === targetCountryId)
    .slice(0, 4);

  if (selected.length === 0) return "no recent diplomatic exchanges";
  return selected
    .map((entry) => `${entry.dateLabel} ${entry.targetCountryName} (${entry.stance}): ${entry.message}`)
    .join(" | ");
}

function summarizeRecentEvents(game: LoadedGame, eventIds?: string[]): string {
  const selectedEvents = (eventIds && eventIds.length > 0
    ? eventIds
      .map((id) => game.events.find((event) => event.id === id) ?? null)
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
    : game.events.slice(0, 6));

  if (selectedEvents.length === 0) return "no recent event context";
  return selectedEvents
    .slice(0, 4)
    .map((event) => `${event.dateLabel} ${event.title}`)
    .join(" | ");
}

function summarizeCountryPulse(frame: AdvisorFrame): string {
  const hottest = [...frame.countries].sort((a, b) => b.tension - a.tension)[0];
  const weakest = [...frame.countries].sort((a, b) => a.stability - b.stability)[0];
  const strongest = [...frame.countries].sort((a, b) => b.power - a.power)[0];
  const sections: string[] = [];

  if (hottest) sections.push(`Highest tension: ${hottest.name} (${hottest.tension})`);
  if (weakest) sections.push(`Lowest stability: ${weakest.name} (${weakest.stability})`);
  if (strongest) sections.push(`Highest power: ${strongest.name} (${strongest.power})`);

  return sections.join("; ");
}

function summarizePlayerState(frame: AdvisorFrame): string {
  const player = frame.countries.find((country) => country.id === frame.game.playerCountryId) ?? frame.countries[0];
  if (!player) return "player state unavailable";

  return [
    `Power ${player.power}`,
    `Stability ${player.stability}`,
    `Tension ${player.tension}`,
    `Army ${player.army}`,
    `Industry ${player.industry}`,
    `Fortification ${player.fortification}`,
    `Unrest ${player.unrest}`
  ].join(", ");
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resolveCountryIdByName(gameId: string, countryName: string): string | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;

  const wanted = normalizeLoose(countryName);
  if (!wanted) return undefined;

  const exact = game.countries.find((country) => normalizeLoose(country.name) === wanted);
  if (exact) return exact.id;

  const partial = game.countries.find((country) => normalizeLoose(country.name).includes(wanted) || wanted.includes(normalizeLoose(country.name)));
  return partial?.id;
}

function resolveMentionedCountryId(gameId: string, text: string): string | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;

  const normalizedText = normalizeLoose(text);
  return [...game.countries]
    .sort((a, b) => b.name.length - a.name.length)
    .find((country) => {
      const normalizedCountry = normalizeLoose(country.name);
      return normalizedCountry.length >= 3 && normalizedText.includes(normalizedCountry);
    })?.id;
}

function baselineDiplomacyOutcome(gameId: string, targetCountryId: string, message: string) {
  const game = getGame(gameId);
  const target = game?.countries.find((country) => country.id === targetCountryId);
  if (!target) return null;

  const normalized = normalizeLoose(message);
  const aggressive = /\b(attack|war|ultimatum|sanction|threat|invade)\b/.test(normalized);
  const cooperative = /\b(alliance|pact|trade|peace|cooperation|accord|understanding|intelligence sharing)\b/.test(normalized);

  if (aggressive || target.relationToPlayer <= -35 || target.tension >= 70) {
    return {
      stance: "hostile" as const,
      relationDelta: -10,
      tensionDelta: 4,
      stabilityDelta: 0
    };
  }

  if (cooperative || target.relationToPlayer >= 25 || target.tension <= 40) {
    return {
      stance: "friendly" as const,
      relationDelta: 10,
      tensionDelta: -3,
      stabilityDelta: 1
    };
  }

  return {
    stance: "neutral" as const,
    relationDelta: 1,
    tensionDelta: 0,
    stabilityDelta: 0
  };
}

function clampDiplomacyOutcome(gameId: string, targetCountryId: string, message: string, aiOutcome: {
  stance: "friendly" | "neutral" | "hostile";
  reply: string;
  relationDelta: number;
  tensionDelta: number;
  stabilityDelta: number;
}) {
  const game = getGame(gameId);
  const target = game?.countries.find((country) => country.id === targetCountryId);
  const baseline = baselineDiplomacyOutcome(gameId, targetCountryId, message);
  if (!game || !target || !baseline) return aiOutcome;

  let stance = aiOutcome.stance;
  let relationDelta = aiOutcome.relationDelta;
  let tensionDelta = aiOutcome.tensionDelta;
  let stabilityDelta = aiOutcome.stabilityDelta;

  if (baseline.stance === "hostile") {
    stance = "hostile";
    relationDelta = Math.min(relationDelta, baseline.relationDelta);
    tensionDelta = Math.max(tensionDelta, baseline.tensionDelta);
    stabilityDelta = Math.min(stabilityDelta, baseline.stabilityDelta);
  } else if (baseline.stance === "neutral" && aiOutcome.stance === "friendly" && target.relationToPlayer < 15) {
    stance = "neutral";
    relationDelta = Math.min(relationDelta, 2);
    tensionDelta = Math.max(tensionDelta, 0);
    stabilityDelta = Math.min(stabilityDelta, 0);
  }

  const alliedBloc = new Set(["france", "united kingdom", "united states", "poland"]);
  const axisBloc = new Set(["germany", "italy", "japan"]);
  const inOpposingWw2Blocs =
    game.preset.id === "world-war-ii" &&
    ((alliedBloc.has(game.playerCountryId) && axisBloc.has(targetCountryId)) ||
      (axisBloc.has(game.playerCountryId) && alliedBloc.has(targetCountryId)));

  if (inOpposingWw2Blocs) {
    stance = "hostile";
    relationDelta = Math.min(relationDelta, -8);
    tensionDelta = Math.max(tensionDelta, 2);
    stabilityDelta = Math.min(stabilityDelta, 0);
  }

  let reply = aiOutcome.reply;
  if (stance === "hostile" && /\b(accept|agreement|alliance|willingness|opening a negotiation|cooperate|cooperation|accord|understanding|friendship|shared future)\b/i.test(reply)) {
    reply = `${target.name} rejects the proposal, questions your intentions, and prepares for a harder line in the next exchanges.`;
  } else if (stance === "neutral" && /\b(accept|alliance|agreement reached)\b/i.test(reply)) {
    reply = `${target.name} acknowledges your message but avoids any firm commitment for now.`;
  }

  return {
    stance,
    reply,
    relationDelta,
    tensionDelta,
    stabilityDelta
  };
}

function describeWorldPressure(gameId: string): string {
  const game = getGame(gameId);
  if (!game) return "";
  return `Global stability ${game.indicators.avgStability}, wealth ${game.indicators.avgWealth}, tension ${game.indicators.avgTension}, conflict ${game.indicators.conflictLevel}.`;
}

function describeFramePressure(frame: AdvisorFrame): string {
  return `Global stability ${frame.indicators.avgStability}, wealth ${frame.indicators.avgWealth}, tension ${frame.indicators.avgTension}, conflict ${frame.indicators.conflictLevel}.`;
}

function sanitizeRoundNarrativeLegacy(gameId: string, narrative: Awaited<ReturnType<AIProvider["generateRoundNarrative"]>>) {
  const game = getGame(gameId);
  if (!game) return narrative;

  const cleanedMapChange = /->|→|attack|defend/i.test(narrative.mapChangeSummary)
    ? narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Fronts are tightening and military pressure is becoming visible on the map."
      : "Recent moves altered the pressure, posture, and diplomatic balance across the map."
    : narrative.mapChangeSummary;

  const cleanedHighlights = (narrative.highlights ?? []).map((line) => {
    if (/->|→/.test(line)) {
      return `${game.playerCountryName} and its rivals adjusted posture after the latest orders.`;
    }
    return line;
  });

  return {
    ...narrative,
    mapChangeSummary: cleanedMapChange,
    highlights: cleanedHighlights.length > 0 ? cleanedHighlights : narrative.highlights
  };
}

function normalizeNarrativeText(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[*`#_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePromptDump(value: string): boolean {
  const normalized = value.toLowerCase();
  return [
    "event card",
    "orders summary",
    "applied orders",
    "world pressure",
    "global stability",
    "latest event in log",
    "averages",
    "from:",
    "to:"
  ].some((token) => normalized.includes(token));
}

function sanitizeRoundNarrative(gameId: string, narrative: Awaited<ReturnType<AIProvider["generateRoundNarrative"]>>) {
  const game = getGame(gameId);
  if (!game) return narrative;

  const fallbackTitle =
    narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Regional Tension Intensifies"
      : "Round Update";
  const fallbackDescription = `${game.playerCountryName} advances into ${game.displayDate} with ${game.lastRoundSummary?.appliedOrders ?? 0} resolved orders. Global stability is ${game.indicators.avgStability} and tension is ${game.indicators.avgTension}.`;
  const fallbackMapSummary =
    narrative.type === "major_conflict" || narrative.type === "major_crisis"
      ? "Frontline pressure has increased, with visible military and crisis activity."
      : "Recent actions adjusted military posture, diplomacy, and domestic pressure across the map.";

  const cleanedTitle = normalizeNarrativeText(narrative.title);
  const cleanedDescription = normalizeNarrativeText(narrative.description);
  const cleanedMapInput = normalizeNarrativeText(narrative.mapChangeSummary);
  const mergedForValidation = `${cleanedTitle} ${cleanedDescription} ${cleanedMapInput}`;
  const shouldFallback = looksLikePromptDump(mergedForValidation) || cleanedDescription.length < 26;

  const cleanedMapChange = /->|attack|defend/i.test(cleanedMapInput)
    ? fallbackMapSummary
    : cleanedMapInput.length > 0
      ? cleanedMapInput
      : fallbackMapSummary;

  const cleanedHighlights = (narrative.highlights ?? [])
    .map((line) => normalizeNarrativeText(line))
    .filter((line) => line.length > 0 && line.length <= 180 && !looksLikePromptDump(line))
    .map((line) => (
      /->/.test(line)
        ? `${game.playerCountryName} and its rivals adjusted posture after the latest orders.`
        : line
    ));

  const fallbackHighlights = (game.lastRoundSummary?.highlights ?? [])
    .map((line) => normalizeNarrativeText(line))
    .filter((line) => line.length > 0)
    .slice(0, 4);

  return {
    ...narrative,
    title: shouldFallback ? fallbackTitle : (cleanedTitle || fallbackTitle),
    description: shouldFallback ? fallbackDescription : (cleanedDescription || fallbackDescription),
    mapChangeSummary: shouldFallback ? fallbackMapSummary : cleanedMapChange,
    highlights: cleanedHighlights.length > 0 ? cleanedHighlights : (fallbackHighlights.length > 0 ? fallbackHighlights : narrative.highlights)
  };
}

async function enrichJumpNarrative(ai: AIProvider, gameId: string, fromDateLabel: string, locale: "fr" | "en"): Promise<void> {
  const game = getGame(gameId);
  if (!game || !game.lastRoundSummary) return;
  const frame = buildAdvisorFrame(game, locale);

  const eventWindowOrders = game.eventWindow.eventIds
    .map((eventId) => game.events.find((event) => event.id === eventId) ?? null)
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .filter((event) => event.type === "order")
    .map((event) => event.description);

  const ordersText = eventWindowOrders.length > 0
    ? eventWindowOrders.join(" ")
    : game.lastRoundSummary.highlights.join(" ");

  const rawNarrative = await ai.generateRoundNarrative({
    presetTitle: game.preset.title,
    playerCountryName: game.playerCountryName,
    locale,
    fromDateLabel,
    toDateLabel: game.displayDate,
    appliedOrders: game.lastRoundSummary.appliedOrders,
    ordersText,
    avgRichness: game.indicators.avgWealth,
    avgStability: game.indicators.avgStability,
    avgTension: game.indicators.avgTension,
    latestEventText: game.events[0]?.title,
    worldPressureText: describeWorldPressure(gameId),
    recentEventsText: summarizeRecentEvents(game, frame.eventIds),
    countryPulseText: summarizeCountryPulse(frame)
  });
  const narrative = sanitizeRoundNarrative(gameId, rawNarrative);

  applyRoundNarrativePatch(game, narrative);
}

export function registerRoutes(app: import("express").Express, ai: AIProvider): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "genesis-engine-server", aiProvider: ai.providerName });
  });

  app.get("/scenarios", (_req: Request, res: Response) => {
    res.json(listScenarios());
  });

  app.get("/presets", (_req: Request, res: Response) => {
    res.json(getPresetBrowser());
  });
  app.get("/api/presets", (_req: Request, res: Response) => {
    res.json(getPresetBrowser());
  });

  app.get("/presets/categories", (_req: Request, res: Response) => {
    res.json(listPresetCategories());
  });
  app.get("/api/presets/categories", (_req: Request, res: Response) => {
    res.json(listPresetCategories());
  });

  app.get("/presets/:presetId/setup", (req: Request, res: Response) => {
    const presetId = ensureString(req.params.presetId);
    res.json(getGameSetupOptions(presetId));
  });

  app.get("/countries", (req: Request, res: Response) => {
    const presetId = ensureString(req.query.presetId);
    res.json(listCountries(presetId));
  });

  app.get("/games", (_req: Request, res: Response) => {
    res.json(listGameSessions());
  });
  app.get("/api/games", (_req: Request, res: Response) => {
    res.json(listGameSessions());
  });

  app.post("/game/start", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<CreateGameInput>;
    const presetId = ensureString(payload.presetId);
    const countryId = ensureString(payload.countryId);
    const difficulty = ensureString(payload.difficulty) as CreateGameInput["difficulty"];
    const aiQuality = ensureString(payload.aiQuality) as CreateGameInput["aiQuality"];
    const locale = ensureString(payload.locale) === "fr" ? "fr" : "en";

    if (!presetId || !countryId || !difficulty || !aiQuality) {
      res.status(400).json({ error: "presetId, countryId, difficulty and aiQuality are required" });
      return;
    }

    const game = createGame({ presetId, countryId, difficulty, aiQuality, locale });
    res.status(201).json(game);
  });
  app.post("/api/games", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<CreateGameInput>;
    const presetId = ensureString(payload.presetId);
    const countryId = ensureString(payload.countryId);
    const difficulty = ensureString(payload.difficulty) as CreateGameInput["difficulty"];
    const aiQuality = ensureString(payload.aiQuality) as CreateGameInput["aiQuality"];
    const locale = ensureString(payload.locale) === "fr" ? "fr" : "en";

    if (!presetId || !countryId || !difficulty || !aiQuality) {
      res.status(400).json({ error: "presetId, countryId, difficulty and aiQuality are required" });
      return;
    }

    const game = createGame({ presetId, countryId, difficulty, aiQuality, locale });
    res.status(201).json(game);
  });

  app.get("/game/:gameId", (req: Request, res: Response) => {
    const gameId = ensureString(req.params.gameId);
    const game = getGame(gameId);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(game);
  });
  app.get("/api/games/:gameId", (req: Request, res: Response) => {
    const gameId = ensureString(req.params.gameId);
    const game = getGame(gameId);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.json(game);
  });
  app.put("/api/games/:gameId", (req: Request, res: Response) => {
    const gameId = ensureString(req.params.gameId);
    const existing = getGame(gameId);
    if (!existing) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const maybeState = req.body?.state as GameState | undefined;
    if (maybeState && typeof maybeState === "object" && ensureString(maybeState.id) === gameId) {
      saveGame(maybeState);
      res.json(maybeState);
      return;
    }

    const tokenBalance = ensureNumber(req.body?.tokenBalance);
    if (tokenBalance !== null) {
      existing.tokenBalance = Number(Math.max(0, tokenBalance).toFixed(3));
      saveGame(existing);
      res.json(existing);
      return;
    }

    res.status(400).json({ error: "Provide state or tokenBalance." });
  });
  app.delete("/api/games/:gameId", (req: Request, res: Response) => {
    const gameId = ensureString(req.params.gameId);
    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const removed = deleteGame(gameId);
    if (!removed) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    res.status(204).send();
  });

  app.get("/api/tokens", (req: Request, res: Response) => {
    const userId = ensureString(req.query.userId) || undefined;
    const balance = getTokenBalance(userId);
    res.json({ userId: userId ?? "local-player", balance });
  });
  app.post("/api/tokens/earn", (req: Request, res: Response) => {
    const userId = ensureString(req.body?.userId) || undefined;
    const amount = ensureNumber(req.body?.amount);
    if (amount === null || amount <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    const balance = earnTokens(amount, userId);
    res.json({ userId: userId ?? "local-player", balance });
  });
  app.post("/api/tokens/spend", (req: Request, res: Response) => {
    const userId = ensureString(req.body?.userId) || undefined;
    const amount = ensureNumber(req.body?.amount);
    if (amount === null || amount <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    try {
      const balance = spendTokens(amount, userId);
      res.json({ userId: userId ?? "local-player", balance });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to spend tokens" });
    }
  });

  app.post("/game/order", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<QueueOrderInput>;
    const gameId = ensureString(payload.gameId);
    const text = ensureString(payload.text);
    const locale = ensureString(req.body?.locale) === "en" ? "en" : "fr";

    if (!gameId || !text) {
      res.status(400).json({ error: "gameId and text are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const interpretation = await ai.interpretOrder({
        presetTitle: game.preset.title,
        playerCountryName: game.playerCountryName,
        locale,
        dateLabel: game.displayDate,
        orderText: text,
        countries: game.countries.map((country) => ({ id: country.id, name: country.name }))
      });
      const aiTargetCountryId = resolveCountryIdByName(gameId, interpretation.targetCountryName);
      const mentionedCountryId = resolveMentionedCountryId(gameId, text);
      const targetCountryId =
        aiTargetCountryId && !(aiTargetCountryId === game.playerCountryId && mentionedCountryId && mentionedCountryId !== game.playerCountryId)
          ? aiTargetCountryId
          : mentionedCountryId ?? aiTargetCountryId;
      const updated = queueOrderWithOverrides(game, text, {
        kind: interpretation.kind,
        targetCountryId,
        cleanedText: interpretation.cleanedText
      });
      res.json(updated);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to queue order" });
    }
  });

  app.post("/game/quick-action", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<QuickActionInput>;
    const gameId = ensureString(payload.gameId);
    const targetCountryId = ensureString(payload.targetCountryId);
    const kind = ensureString(payload.kind) as QuickActionInput["kind"];

    if (!gameId || !targetCountryId || !kind) {
      res.status(400).json({ error: "gameId, targetCountryId and kind are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const updated = queueQuickAction(game, targetCountryId, kind);
      res.json(updated);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Unable to queue quick action" });
    }
  });

  app.post("/game/order/remove", (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<RemoveOrderInput>;
    const gameId = ensureString(payload.gameId);
    const orderId = ensureString(payload.orderId);

    if (!gameId || !orderId) {
      res.status(400).json({ error: "gameId and orderId are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const updated = removeOrder(game, orderId);
      res.json(updated);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Unable to remove order" });
    }
  });

  app.post("/game/jump", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<JumpInput>;
    const gameId = ensureString(payload.gameId);
    const step = ensureString(payload.step);
    const locale = ensureString(req.body?.locale) === "en" ? "en" : "fr";

    if (!gameId || !step) {
      res.status(400).json({ error: "gameId and step are required" });
      return;
    }

    if (!["week", "month", "six_months", "year"].includes(step)) {
      res.status(400).json({ error: "step must be week, month, six_months or year" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const fromDateLabel = game.displayDate;
    const updated = jumpForward(game, step as JumpInput["step"]);
    await enrichJumpNarrative(ai, updated.id, fromDateLabel, locale);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/jump/major-event", async (req: Request, res: Response) => {
    const gameId = ensureString(req.body?.gameId);
    const locale = ensureString(req.body?.locale) === "en" ? "en" : "fr";
    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const fromDateLabel = game.displayDate;
    const updated = jumpToMajorEvent(game);
    await enrichJumpNarrative(ai, updated.id, fromDateLabel, locale);
    saveGame(updated);
    res.json(updated);
  });

  app.post("/game/diplomacy", async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as Partial<DiplomacyInput>;
    const gameId = ensureString(payload.gameId);
    const targetCountryId = ensureString(payload.targetCountryId);
    const message = ensureString(payload.message);
    const locale = ensureString(req.body?.locale) === "en" ? "en" : "fr";

    if (!gameId || !targetCountryId || !message) {
      res.status(400).json({ error: "gameId, targetCountryId and message are required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    try {
      const target = game.countries.find((country) => country.id === targetCountryId);
      const recentConversationText = summarizeRecentDiplomacy(game, targetCountryId);
      const aiOutcome = target
        ? await ai.generateDiplomacyReply({
          presetTitle: game.preset.title,
          playerCountryName: game.playerCountryName,
          targetCountryName: target.name,
          locale,
          dateLabel: game.displayDate,
          message,
          relationToPlayer: target.relationToPlayer,
          tension: target.tension,
          stability: target.stability,
          worldPressureText: describeWorldPressure(gameId),
          recentConversationText
        })
        : undefined;

      const outcome = aiOutcome ? clampDiplomacyOutcome(gameId, targetCountryId, message, aiOutcome) : undefined;
      const exchange = sendDiplomacyMessage(game, targetCountryId, message, outcome);
      res.json(exchange);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Diplomacy failed" });
    }
  });

  app.post("/game/advisor", async (req: Request, res: Response) => {
    const gameId = ensureString(req.body?.gameId);
    const snapshotIdInput = ensureString(req.body?.snapshotId);
    const question = ensureString(req.body?.prompt);
    const locale = ensureString(req.body?.locale) === "en" ? "en" : "fr";
    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const frame = buildAdvisorFrame(game, locale, snapshotIdInput || undefined);
    const contextEvents = summarizeRecentEvents(game, frame.eventIds);
    const latestContextEvent = (frame.eventIds
      .map((eventId) => game.events.find((event) => event.id === eventId) ?? null)
      .filter((event): event is NonNullable<typeof event> => Boolean(event))[0])
      ?? game.events[0];
    const timelineContext = frame.snapshotId
      ? game.timeline.find((entry) => entry.snapshotId === frame.snapshotId)?.subtitle ?? ""
      : "";

    const narrative = await ai.generateWorldNarrative({
      worldName: game.preset.title,
      scenarioId: game.presetId,
      year: frame.year,
      month: frame.month,
      day: frame.day,
      dateLabel: frame.dateLabel,
      tick: frame.tick,
      role: "nation",
      kind: game.preset.category,
      complexity: game.aiQuality.toLowerCase(),
      playerCountryName: game.playerCountryName,
      locale,
      actionPoints: game.actionPoints,
      maxActionPoints: game.maxActionPoints,
      avgRichness: frame.indicators.avgWealth,
      avgStability: frame.indicators.avgStability,
      avgTension: frame.indicators.avgTension,
      factionsText: blocSummaryFromCountries(frame.countries),
      playerStateText: summarizePlayerState(frame),
      queuedOrdersText: summarizeQueuedOrders(game),
      recentEventsText: contextEvents,
      diplomacyContextText: summarizeRecentDiplomacy(game),
      timelineContextText: timelineContext,
      advisorQuestion: question || undefined,
      latestEventText: latestContextEvent?.title
    });

    game.tokenBalance = Number(Math.max(0.111, game.tokenBalance - 0.034).toFixed(3));
    saveGame(game);

    const cleanedNarrative = narrative
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/\s+/g, " ");
    const insights = buildAdvisorInsights(frame);
    const suggestions = buildAdvisorSuggestions(frame, question || undefined);
    const response: AdvisorResponse = {
      provider: ai.providerName,
      narrative: `${monthLabel(frame.month, locale)} ${frame.day}, ${frame.year} | ${cleanedNarrative}`,
      tick: frame.tick,
      year: frame.year,
      month: frame.month,
      day: frame.day,
      dateLabel: formatDate(frame.year, frame.month, frame.day, locale),
      snapshotId: frame.snapshotId,
      question: question || undefined,
      insights,
      suggestions
    };

    res.json(response);
  });
}
