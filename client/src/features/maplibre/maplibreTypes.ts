import type { CountryState, MapArtifact, MapEffect, PresetSummary, SpatialProgressState } from "@genesis/shared";
import type { Geometry, Position } from "geojson";

export type MapViewMode = "terre" | "globe" | "orbite" | "lune";

export type MapViewport = {
  zoom: number;
  width: number;
  height: number;
  center: [number, number];
  bounds: [number, number, number, number];
  bearing: number;
  pitch: number;
  pixelRatio: number;
};

export type MapLibreWorldMapProps = {
  countries: CountryState[];
  preset: PresetSummary;
  playerCountryId: string;
  playerCountryName: string;
  uiLocale?: "fr" | "en";
  briefingMomentTitle: string;
  briefingMomentText: string;
  briefingSummary: string;
  selectedCountryId: string | null;
  selectedProvinceId?: string | null;
  mapEffects?: MapEffect[];
  mapArtifacts?: MapArtifact[];
  spatialProgress: SpatialProgressState;
  highlightedCountryIds?: string[];
  focusCountryIds?: string[];
  focusProvinceIds?: string[];
  focusToken?: number;
  onSelectCountry: (countryId: string) => void;
  onSelectProvince?: (provinceId: string, countryId: string) => void;
  onRequestContextMenu?: (payload: {
    countryId: string | null;
    countryName: string | null;
    surfaceKind: "country" | "ocean" | "void" | "orbital" | "lunar";
    surfaceLabel: string;
    longitude: number;
    latitude: number;
    viewMode: MapViewMode;
    clientX: number;
    clientY: number;
  }) => void;
};

export type CountryGeometry = {
  id: string;
  name: string;
  geometry: Geometry;
  centroid: Position;
  bbox: [number, number, number, number];
};

export type CountryFeatureProperties = {
  countryId: string;
  name: string;
  fillColor: string;
  discovered: boolean;
  selected: boolean;
  highlighted: boolean;
  focused: boolean;
  power: number;
  stability: number;
  tension: number;
  army: number;
  industry: number;
  descriptor: string;
  labelSize: number;
  labelOpacity: number;
  labelVisible: boolean;
  labelPriority: number;
  labelRotate: number;
  labelTracking: number;
  labelRank: number;
};

export type PointFeatureProperties = {
  id: string;
  kind: string;
  countryId: string;
  label: string;
  intensity: number;
  color: string;
  symbol: string;
  labelSize: number;
  sort: number;
};

export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const SOURCES = {
  countries: "genesis-political-countries",
  countryLabels: "genesis-country-labels",
  cities: "genesis-strategic-cities",
  effects: "genesis-gameplay-effects",
  artifacts: "genesis-gameplay-artifacts"
} as const;

export const LAYERS = {
  countryFill: "genesis-country-fill",
  countryBorder: "genesis-country-border",
  countryHighlight: "genesis-country-highlight",
  countrySelected: "genesis-country-selected",
  countryLabels: "genesis-country-labels",
  cityClusters: "genesis-city-clusters",
  cityClusterLabels: "genesis-city-cluster-labels",
  cityDots: "genesis-city-dots",
  cityLabels: "genesis-city-labels",
  effectClusters: "genesis-effect-clusters",
  effectClusterLabels: "genesis-effect-cluster-labels",
  effectDots: "genesis-effect-dots",
  effectLabels: "genesis-effect-labels",
  artifactClusters: "genesis-artifact-clusters",
  artifactClusterLabels: "genesis-artifact-cluster-labels",
  artifactDots: "genesis-artifact-dots",
  artifactLabels: "genesis-artifact-labels"
} as const;
