import type { CountryState, PresetSummary } from "@genesis/shared";
import type { OverlayMode } from "./MapChrome";
import type { ZoomBand } from "./pipeline";
import type { ArtifactMarker, CityMarker, EffectMarker, Feature, ProvinceFeature, ViewBox } from "./types";

export type CountryLabelEntry = {
  feature: Feature;
  country: CountryState;
};

export type ProvinceLabelEntry = {
  x: number;
  y: number;
  label: string;
  feature: ProvinceFeature;
};

export type FrontlineLink = {
  from: Feature;
  to: Feature;
  intensity: number;
};

export type MapSceneCopyProps = {
  copyKey: string;
  translatedOffset: number;
  viewBox: ViewBox;
  preset: PresetSummary;
  zoomBand: ZoomBand;
  overlayMode: OverlayMode;
  borderScale: number;
  markerScaleBase: number;
  mapReady: boolean;
  selectedCountryId: string | null;
  selectedProvinceId: string | null;
  countryFeatures: Feature[];
  visibleProvinceFeatures: ProvinceFeature[];
  countryLabelFeatures: CountryLabelEntry[];
  provinceLabelFeatures: ProvinceLabelEntry[];
  showProvinceLayer: boolean;
  showCountryLabels: boolean;
  showRegionLabels: boolean;
  showFrontlineLayer: boolean;
  showEffectsLayer: boolean;
  showArtifactsLayer: boolean;
  showCitiesLayer: boolean;
  latestEffectTick: number;
  countriesById: Map<string, CountryState>;
  effectMarkers: EffectMarker[];
  artifactMarkers: ArtifactMarker[];
  cityMarkers: CityMarker[];
  frontlineLinks: FrontlineLink[];
  highlightedSet: Set<string>;
  focusSet: Set<string>;
  countryLabelZoomFactor: number;
  showOwnerColors: boolean;
  localeProvinceName: (feature: ProvinceFeature) => string;
  onSelectCountry: (countryId: string) => void;
  onSelectProvince?: (provinceId: string, countryId: string) => void;
  showTooltipFromClientPoint: (clientX: number, clientY: number, title: string, subtitle: string) => void;
  clearTooltip: () => void;
};
