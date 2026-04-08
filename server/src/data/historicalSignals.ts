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
    year: 2011,
    type: "troubles",
    title: "Arab Spring Shockwave",
    description: "Political unrest spreads across North Africa and the Middle East.",
    continents: ["Africa", "Asia"],
    coverage: 0.28,
    tensionDelta: 8,
    stabilityDelta: -2,
    richnessDelta: -2
  },
  {
    year: 2013,
    type: "troubles",
    title: "Commodity Price Volatility",
    description: "Resource price swings increase political pressure in fragile regions.",
    continents: ["Africa", "South America", "Asia"],
    coverage: 0.3,
    tensionDelta: 5,
    stabilityDelta: -3,
    richnessDelta: -1
  },
  {
    year: 2014,
    type: "expansion",
    title: "European Security Crisis",
    description: "Regional security architecture destabilizes and border pressure rises.",
    continents: ["Europe"],
    coverage: 0.35,
    tensionDelta: 9,
    stabilityDelta: -6,
    richnessDelta: -2
  },
  {
    year: 2016,
    type: "crisis_local",
    title: "Polarization Wave",
    description: "Domestic polarization erodes governance in multiple blocs.",
    continents: ["North America", "Europe", "Asia"],
    coverage: 0.27,
    tensionDelta: 5,
    stabilityDelta: -5,
    richnessDelta: -1
  },
  {
    year: 2018,
    type: "alliance",
    title: "Diplomatic Reset",
    description: "New regional talks lower immediate military risk.",
    continents: ["Europe", "Asia", "Africa"],
    coverage: 0.3,
    tensionDelta: -4,
    stabilityDelta: 4,
    richnessDelta: 1
  },
  {
    year: 2020,
    type: "crisis_local",
    title: "Global Pandemic Shock",
    description: "Public health emergency disrupts economies and governance.",
    continents: ["North America", "South America", "Europe", "Asia", "Africa", "Oceania"],
    coverage: 0.55,
    tensionDelta: 4,
    stabilityDelta: -7,
    richnessDelta: -8
  },
  {
    year: 2022,
    type: "troubles",
    title: "Energy and Supply Shock",
    description: "Energy costs and supply disruptions stress households and states.",
    continents: ["Europe", "Asia", "Africa"],
    coverage: 0.4,
    tensionDelta: 6,
    stabilityDelta: -4,
    richnessDelta: -3
  },
  {
    year: 2024,
    type: "discovery",
    title: "AI Productivity Surge",
    description: "Automation and digital acceleration lift productivity unevenly.",
    continents: ["North America", "Europe", "Asia"],
    coverage: 0.32,
    tensionDelta: -1,
    stabilityDelta: 2,
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
