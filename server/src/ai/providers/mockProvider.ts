import type {
  AIProvider,
  DiplomacyReply,
  DiplomacyReplyInput,
  OrderInterpretation,
  OrderInterpretationInput,
  RoundNarrative,
  RoundNarrativeInput,
  WorldNarrativeInput
} from "../types.js";

function tensionLabel(avgTension: number): string {
  if (avgTension >= 65) return "very unstable";
  if (avgTension >= 50) return "under pressure";
  return "relatively calm";
}

function isFrenchLocale(locale?: string): boolean {
  return locale === "fr";
}

function worldToneLabel(avgTension: number, locale?: string): string {
  if (isFrenchLocale(locale)) {
    if (avgTension >= 65) return "tres instable";
    if (avgTension >= 50) return "sous pression";
    return "assez calme";
  }

  return tensionLabel(avgTension);
}

function renderWorldNarrative(input: WorldNarrativeInput): string {
  const french = isFrenchLocale(input.locale);
  const tone = worldToneLabel(input.avgTension, input.locale);
  const latest = input.latestEventText
    ? french ? `Dernier evenement: ${input.latestEventText}.` : `Latest event: ${input.latestEventText}.`
    : french ? "Aucun grand evenement signale pour le moment." : "No major event reported yet.";
  const queuedOrders = input.queuedOrdersText
    ? french ? `Ordres en file: ${input.queuedOrdersText}.` : `Queued orders: ${input.queuedOrdersText}.`
    : french ? "Aucun ordre en file." : "No queued orders.";
  const recentEvents = input.recentEventsText ? `${french ? "Evenements recents" : "Recent events"}: ${input.recentEventsText}.` : "";
  const diplomacy = input.diplomacyContextText ? `${french ? "Diplomatie" : "Diplomacy"}: ${input.diplomacyContextText}.` : "";
  const question = input.advisorQuestion ? `${french ? "Question guide" : "Focus question"}: ${input.advisorQuestion}.` : "";

  if (french) {
    return [
      `${input.worldName} | scenario ${input.scenarioId} | date ${input.dateLabel}.`,
      `Tour ${input.tick}: le monde est ${tone}, stabilite ${input.avgStability}, richesse ${input.avgRichness}.`,
      `Points d'action ${input.actionPoints}/${input.maxActionPoints}. Factions: ${input.factionsText}.`,
      input.playerStateText ? `Etat du joueur: ${input.playerStateText}.` : "",
      queuedOrders,
      diplomacy,
      recentEvents,
      latest,
      question
    ].join(" ");
  }

  return [
    `${input.worldName} | scenario ${input.scenarioId} | date ${input.dateLabel}.`,
    `Tick ${input.tick}: world is ${tone}, stability ${input.avgStability}, wealth ${input.avgRichness}.`,
    `Action points ${input.actionPoints}/${input.maxActionPoints}. Factions: ${input.factionsText}.`,
    input.playerStateText ? `Player state: ${input.playerStateText}.` : "",
    queuedOrders,
    diplomacy,
    recentEvents,
    latest,
    question
  ].join(" ");
}

function detectOrderKind(text: string): OrderInterpretation["kind"] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(defend|fortify|protect|hold|secure)\b/.test(normalized)) return "defend";
  if (/\b(attack|war|invade|offensive|strike)\b/.test(normalized)) return "attack";
  if (/\b(stabil|pacif|ordre|calm)\b/.test(normalized)) return "stabilize";
  if (/\b(invest|industry|eco|infrastructure|budget|commerce)\b/.test(normalized)) return "invest";
  if (/\b(alliance|treaty|pact|diplom|talk|cooper|trade|peace)\b/.test(normalized)) return "diplomacy";
  if (/\b(military|arm|mobiliz)\b/.test(normalized)) return "military";
  return "pressure";
}

function detectTargetCountryName(input: OrderInterpretationInput): string {
  const normalizedText = input.orderText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const countries = [...input.countries].sort((a, b) => b.name.length - a.name.length);
  for (const country of countries) {
    const normalizedCountry = country.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalizedCountry.length >= 3 && normalizedText.includes(normalizedCountry)) {
      return country.name;
    }
  }

  return input.playerCountryName;
}

function fallbackDiplomacy(input: DiplomacyReplyInput): DiplomacyReply {
  const normalized = input.message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aggressive = /\b(attack|war|ultimatum|sanction|threat|invade)\b/.test(normalized);
  const cooperative = /\b(alliance|pact|trade|peace|cooperation|accord)\b/.test(normalized);

  if (aggressive || input.relationToPlayer <= -35 || input.tension >= 70) {
    return {
      stance: "hostile",
      reply: `${input.targetCountryName} rejects your position and shifts to defensive mobilization.`,
      relationDelta: -10,
      tensionDelta: 4,
      stabilityDelta: 0
    };
  }

  if (cooperative || input.relationToPlayer >= 25 || input.tension <= 40) {
    return {
      stance: "friendly",
      reply: `${input.targetCountryName} accepts opening a negotiation channel and signals willingness for a phased agreement.`,
      relationDelta: 10,
      tensionDelta: -3,
      stabilityDelta: 1
    };
  }

  return {
    stance: "neutral",
    reply: `${input.targetCountryName} remains cautious and requests concrete guarantees before committing.`,
    relationDelta: 1,
    tensionDelta: 0,
    stabilityDelta: 0
  };
}

export class MockProvider implements AIProvider {
  providerName = "mock";

  async summarizeWorld(input: { worldName: string; tick: number }): Promise<string> {
    return `Mock summary: ${input.worldName} at tick ${input.tick}.`;
  }

  async generateWorldNarrative(input: WorldNarrativeInput): Promise<string> {
    return renderWorldNarrative(input);
  }

  async interpretOrder(input: OrderInterpretationInput): Promise<OrderInterpretation> {
    return {
      kind: detectOrderKind(input.orderText),
      targetCountryName: detectTargetCountryName(input),
      cleanedText: input.orderText.trim()
    };
  }

  async generateDiplomacyReply(input: DiplomacyReplyInput): Promise<DiplomacyReply> {
    const base = fallbackDiplomacy(input);
    const french = isFrenchLocale(input.locale);
    if (!input.recentConversationText && !input.worldPressureText) {
      return base;
    }

    return {
      ...base,
      reply: `${base.reply} ${input.worldPressureText ? `${french ? "Contexte" : "Context"}: ${input.worldPressureText}` : ""}`.trim()
    };
  }

  async generateRoundNarrative(input: RoundNarrativeInput): Promise<RoundNarrative> {
    const french = isFrenchLocale(input.locale);
    const extraPressure = [input.recentEventsText, input.countryPulseText].filter((value) => Boolean(value)).join(" ");
    const title =
      input.avgTension >= 66
        ? french
          ? "La pression regionale monte"
          : "Regional Pressure Rises"
        : input.appliedOrders > 0
          ? french
            ? "Les ordres reconfigurent l'equilibre"
            : "Orders Reshape the Balance"
          : french
            ? "Tour resolu"
            : "Round Resolved";

    return {
      type: input.avgTension >= 66 ? "major_crisis" : input.appliedOrders > 0 ? "order" : "system",
      title,
      description: french
        ? `${input.playerCountryName} avance de ${input.fromDateLabel} a ${input.toDateLabel}. ${input.worldPressureText} ${input.ordersText} ${extraPressure}`.trim()
        : `${input.playerCountryName} advances from ${input.fromDateLabel} to ${input.toDateLabel}. ${input.worldPressureText} ${input.ordersText} ${extraPressure}`.trim(),
      mapChangeSummary: input.avgTension >= 66
        ? french
          ? "Les tensions se propagent et plusieurs acteurs durcissent leur posture."
          : "Tensions spread across the map and multiple actors harden their posture."
        : input.appliedOrders > 0
          ? french
            ? "Les ordres recents ont modifie la pression, la stabilite et la posture."
            : "Recent orders changed the balance of pressure, stability, and posture."
          : french
            ? "Le monde a avance sans intervention directe du joueur."
            : "The world drifted forward with no direct player intervention.",
      factionLabel: input.presetTitle,
      locationLabel: input.playerCountryName,
      highlights: [
        input.ordersText || (french ? "Aucun ordre direct n'a ete soumis." : "No direct orders were submitted."),
        french
          ? `Pression mondiale: stabilite ${input.avgStability}, richesse ${input.avgRichness}, tension ${input.avgTension}.`
          : `World pressure: stability ${input.avgStability}, wealth ${input.avgRichness}, tension ${input.avgTension}.`
      ]
    };
  }

  async generateNarrativeDecision(input: {
    year: number;
    month: number;
    narrativeContext?: string;
    narrativeMemory?: string[];
  }): Promise<string> {
    const memory = input.narrativeMemory?.length ? ` Memory: ${input.narrativeMemory.slice(0, 3).join(" | ")}` : "";
    return `Mock narrative decision for ${input.year}-${input.month}.${memory}${input.narrativeContext ? ` Context: ${input.narrativeContext}` : ""}`;
  }

  async updateNarrativeMemory(_memory: string[]): Promise<void> {
    return;
  }
}
