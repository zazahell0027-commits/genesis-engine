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
    const tone = tensionLabel(input.avgTension);
    const latest = input.latestEventText
      ? `Latest event: ${input.latestEventText}.`
      : "No major event reported yet.";

    return [
      `${input.worldName} | scenario ${input.scenarioId} | year ${input.year}.`,
      `Tick ${input.tick}: world is ${tone}, stability ${input.avgStability}, wealth ${input.avgRichness}.`,
      `Action points ${input.actionPoints}/${input.maxActionPoints}. Factions: ${input.factionsText}.`,
      latest
    ].join(" ");
  }

  async interpretOrder(input: OrderInterpretationInput): Promise<OrderInterpretation> {
    return {
      kind: detectOrderKind(input.orderText),
      targetCountryName: detectTargetCountryName(input),
      cleanedText: input.orderText.trim()
    };
  }

  async generateDiplomacyReply(input: DiplomacyReplyInput): Promise<DiplomacyReply> {
    return fallbackDiplomacy(input);
  }

  async generateRoundNarrative(input: RoundNarrativeInput): Promise<RoundNarrative> {
    return {
      type: input.avgTension >= 66 ? "major_crisis" : input.appliedOrders > 0 ? "order" : "system",
      title: input.avgTension >= 66 ? "Regional Pressure Rises" : input.appliedOrders > 0 ? "Orders Reshape the Balance" : "Round Resolved",
      description: `${input.playerCountryName} advances from ${input.fromDateLabel} to ${input.toDateLabel}. ${input.worldPressureText} ${input.ordersText}`.trim(),
      mapChangeSummary: input.avgTension >= 66
        ? "Tensions spread across the map and multiple actors harden their posture."
        : input.appliedOrders > 0
          ? "Recent orders changed the balance of pressure, stability, and posture."
          : "The world drifted forward with no direct player intervention.",
      factionLabel: input.presetTitle,
      locationLabel: input.playerCountryName,
      highlights: [
        input.ordersText || "No direct orders were submitted.",
        `World pressure: stability ${input.avgStability}, wealth ${input.avgRichness}, tension ${input.avgTension}.`
      ]
    };
  }
}
