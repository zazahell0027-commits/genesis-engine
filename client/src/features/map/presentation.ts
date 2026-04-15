import type { CountryState, MapArtifact, MapEffect, PresetSummary } from "@genesis/shared";
import type { OverlayMode } from "./MapChrome";
import type { ArtifactMarker, CityMarker } from "./types";

const COUNTRY_PALETTE = [
  "#3f88b8",
  "#b17838",
  "#768c34",
  "#875ca6",
  "#bb554d",
  "#37788a",
  "#b1ab3c",
  "#5e6ea1",
  "#6f885f",
  "#9d6850",
  "#58779b",
  "#8e723b",
  "#427c56",
  "#7a4f71",
  "#94674d"
];

export const MARKER_OFFSETS = [
  { x: -1.05, y: -0.7 },
  { x: 1.05, y: -0.7 },
  { x: -1.05, y: 0.75 },
  { x: 1.05, y: 0.75 },
  { x: 0, y: -1.2 },
  { x: 0, y: 1.2 }
];

export function hash(seed: string): number {
  let result = 0;
  for (let i = 0; i < seed.length; i += 1) {
    result = (result * 33 + seed.charCodeAt(i)) % 1000003;
  }
  return result;
}

export function tint(hex: string, amount: number): string {
  const sanitized = hex.replace("#", "");
  const full = sanitized.length === 3
    ? sanitized.split("").map((char) => char + char).join("")
    : sanitized.padEnd(6, "0");
  const numeric = Number.parseInt(full, 16);
  const clampChannel = (channel: number): number => Math.max(0, Math.min(255, channel + amount));
  const r = clampChannel((numeric >> 16) & 255);
  const g = clampChannel((numeric >> 8) & 255);
  const b = clampChannel(numeric & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function countryFill(country: CountryState, preset: PresetSummary, mode: OverlayMode, showOwnerColors: boolean): string {
  if (mode === "tension") {
    const neutral = showOwnerColors ? "#8d7766" : "#8f8a82";
    return tint(neutral, Math.round((country.tension - 50) * 2.8));
  }

  if (mode === "army") {
    const militaryBase = showOwnerColors ? "#72544e" : "#6d6661";
    return tint(militaryBase, Math.round((country.army * 3.8 + country.fortification * 2.4) - 28));
  }

  if (mode === "fortification") {
    const fortBase = showOwnerColors ? "#6e628f" : "#6e6a86";
    return tint(fortBase, Math.round(country.fortification * 5 - 16));
  }

  if (mode === "industry") {
    const industrialBase = showOwnerColors ? "#3f6b63" : "#4d6460";
    return tint(industrialBase, Math.round((country.industry * 3.3 + country.wealth * 0.4) - 30));
  }

  if (!showOwnerColors) {
    const neutral = "#486277";
    const pressure = Math.round((country.tension - 50) / 3.2);
    return tint(neutral, pressure + Math.round((country.stability - 50) / 4));
  }

  const base = COUNTRY_PALETTE[hash(`${preset.id}:${country.id}`) % COUNTRY_PALETTE.length] ?? "#527aa6";
  const pressure = Math.round((country.tension - 50) / 3.4) + country.unrest;
  const production = Math.round((country.industry - 5) * 1.15);
  const defense = Math.round((country.fortification - 4) * 0.8);
  const wealthBias = Math.round((country.wealth - 50) * 0.35);
  return tint(base, pressure * 2 + production - defense + wealthBias);
}

export function effectGlyph(kind: MapEffect["kind"]): string {
  if (kind === "army") return "A";
  if (kind === "fortification") return "F";
  if (kind === "industry") return "I";
  if (kind === "stability") return "S";
  if (kind === "diplomacy") return "D";
  return "!";
}

export function artifactGlyph(kind: MapArtifact["kind"]): string {
  if (kind === "unit") return "U";
  if (kind === "fort") return "F";
  return "I";
}

export function artifactMarkerPath(kind: ArtifactMarker["kind"], radius: number): string {
  if (kind === "unit") {
    return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
  }

  if (kind === "fort") {
    return `M ${-radius} ${-radius} L ${radius} ${-radius} L ${radius} ${radius} L ${-radius} ${radius} Z`;
  }

  return `M 0 ${-radius} L ${radius * 0.86} ${-radius * 0.5} L ${radius * 0.86} ${radius * 0.5} L 0 ${radius} L ${-radius * 0.86} ${radius * 0.5} L ${-radius * 0.86} ${-radius * 0.5} Z`;
}

export function cityMarkerPath(tier: CityMarker["tier"], radius: number): string {
  if (tier === "capital") {
    return `M 0 ${-radius} L ${radius * 0.42} ${-radius * 0.2} L ${radius} ${-radius * 0.2} L ${radius * 0.52} ${radius * 0.24} L ${radius * 0.7} ${radius} L 0 ${radius * 0.54} L ${-radius * 0.7} ${radius} L ${-radius * 0.52} ${radius * 0.24} L ${-radius} ${-radius * 0.2} L ${-radius * 0.42} ${-radius * 0.2} Z`;
  }

  return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
}
