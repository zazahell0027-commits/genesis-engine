import type { EventType } from "@genesis/shared";

export type HistoricalSignal = {
  year: number;
  type: EventType;
  title: string;
  description: string;
  continents: string[];
  coverage: number;
  tensionDelta: number;
  stabilityDelta: number;
  richnessDelta: number;
};

const historicalSignals: HistoricalSignal[] = [
  {
    year: 1911,
    type: "troubles",
    title: "Imperial Rivalries Harden",
    description: "Competitive alliances intensify pressure across Europe and North Africa.",
    continents: ["Europe", "Africa"],
    coverage: 0.32,
    tensionDelta: 5,
    stabilityDelta: -2,
    richnessDelta: -1
  },
  {
    year: 1912,
    type: "troubles",
    title: "Balkan Shockwave",
    description: "Regional unrest spills into adjacent powers.",
    continents: ["Europe", "Asia"],
    coverage: 0.28,
    tensionDelta: 7,
    stabilityDelta: -3,
    richnessDelta: -1
  },
  {
    year: 1914,
    type: "expansion",
    title: "Great War Fronts",
    description: "Large-scale mobilization shifts borders and drains stability.",
    continents: ["Europe", "Asia", "Africa"],
    coverage: 0.36,
    tensionDelta: 9,
    stabilityDelta: -5,
    richnessDelta: -3
  },
  {
    year: 1917,
    type: "crisis_local",
    title: "Revolutionary Pressure",
    description: "Domestic fractures reduce control in multiple regions.",
    continents: ["Europe", "Asia"],
    coverage: 0.24,
    tensionDelta: 6,
    stabilityDelta: -6,
    richnessDelta: -2
  },
  {
    year: 1918,
    type: "alliance",
    title: "Armistice Momentum",
    description: "Ceasefire dynamics begin reducing immediate pressure.",
    continents: ["Europe", "Asia"],
    coverage: 0.3,
    tensionDelta: -6,
    stabilityDelta: 4,
    richnessDelta: 1
  },
  {
    year: 1923,
    type: "alliance",
    title: "Postwar Settlements",
    description: "Institutions and treaties recover baseline stability.",
    continents: ["Europe", "North America"],
    coverage: 0.24,
    tensionDelta: -4,
    stabilityDelta: 4,
    richnessDelta: 2
  },
  {
    year: 1929,
    type: "crisis_local",
    title: "Global Market Crash",
    description: "Financial shocks spread to core economies.",
    continents: ["North America", "Europe", "Asia"],
    coverage: 0.33,
    tensionDelta: 4,
    stabilityDelta: -5,
    richnessDelta: -10
  },
  {
    year: 1936,
    type: "troubles",
    title: "Rearmament Cycle",
    description: "Military buildup raises tensions before open conflict.",
    continents: ["Europe", "Asia"],
    coverage: 0.3,
    tensionDelta: 6,
    stabilityDelta: -3,
    richnessDelta: -2
  },
  {
    year: 1939,
    type: "expansion",
    title: "Global War Escalation",
    description: "Major powers contest control across multiple theaters.",
    continents: ["Europe", "Asia", "Africa", "Oceania"],
    coverage: 0.38,
    tensionDelta: 10,
    stabilityDelta: -7,
    richnessDelta: -4
  },
  {
    year: 1945,
    type: "discovery",
    title: "Reconstruction Wave",
    description: "Recovery programs and technology accelerate rebuilding.",
    continents: ["Europe", "Asia", "North America"],
    coverage: 0.31,
    tensionDelta: -5,
    stabilityDelta: 6,
    richnessDelta: 7
  }
];

const byYear = new Map<number, HistoricalSignal[]>();

for (const signal of historicalSignals) {
  const list = byYear.get(signal.year) ?? [];
  list.push(signal);
  byYear.set(signal.year, list);
}

export function getHistoricalSignalsForYear(year: number): HistoricalSignal[] {
  return byYear.get(year) ?? [];
}
