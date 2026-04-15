import React from "react";
import type { CountryState, PresetSummary } from "@genesis/shared";
import { FlatMapRenderer } from "./FlatMapRenderer";
import { GlobeMapRenderer } from "./GlobeMapRenderer";
import type { OverlayMode } from "./MapChrome";
import { MapStageDefs } from "./MapStageDefs";
import type { ZoomBand } from "./pipeline";
import type { CountryLabelEntry, FrontlineLink, ProvinceLabelEntry } from "./stage-model";
import type { ArtifactMarker, CityMarker, EffectMarker, Feature, ProvinceFeature, ViewBox } from "./types";

type MapStageProps = {
  viewBox: ViewBox;
  preset: PresetSummary;
  zoomBand: ZoomBand;
  isGlobeMode: boolean;
  shouldTileFlat: boolean;
  globeRotation: number;
  borderScale: number;
  markerScaleBase: number;
  overlayMode: OverlayMode;
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
  onWheel: React.WheelEventHandler<SVGSVGElement>;
  onPointerDown: React.PointerEventHandler<SVGSVGElement>;
  onPointerMove: React.PointerEventHandler<SVGSVGElement>;
  onPointerUp: React.PointerEventHandler<SVGSVGElement>;
  onDoubleClick: React.MouseEventHandler<SVGSVGElement>;
  onPointerLeave: React.PointerEventHandler<SVGSVGElement>;
  showTooltipFromClientPoint: (clientX: number, clientY: number, title: string, subtitle: string) => void;
  clearTooltip: () => void;
  mapLoadState: "loading" | "ready" | "error";
};

export function MapStage(props: MapStageProps): React.JSX.Element {
  const {
    viewBox,
    preset,
    zoomBand,
    isGlobeMode,
    shouldTileFlat,
    globeRotation,
    borderScale,
    markerScaleBase,
    overlayMode,
    mapReady,
    selectedCountryId,
    selectedProvinceId,
    countryFeatures,
    visibleProvinceFeatures,
    countryLabelFeatures,
    provinceLabelFeatures,
    showProvinceLayer,
    showCountryLabels,
    showRegionLabels,
    showFrontlineLayer,
    showEffectsLayer,
    showArtifactsLayer,
    showCitiesLayer,
    latestEffectTick,
    countriesById,
    effectMarkers,
    artifactMarkers,
    cityMarkers,
    frontlineLinks,
    highlightedSet,
    focusSet,
    countryLabelZoomFactor,
    showOwnerColors,
    localeProvinceName,
    onSelectCountry,
    onSelectProvince,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    onPointerLeave,
    showTooltipFromClientPoint,
    clearTooltip,
    mapLoadState
  } = props;

  const sharedRendererProps = {
    viewBox,
    preset,
    zoomBand,
    overlayMode,
    borderScale,
    markerScaleBase,
    mapReady,
    selectedCountryId,
    selectedProvinceId,
    countryFeatures,
    visibleProvinceFeatures,
    countryLabelFeatures,
    provinceLabelFeatures,
    showProvinceLayer,
    showCountryLabels,
    showRegionLabels,
    showFrontlineLayer,
    showEffectsLayer,
    showArtifactsLayer,
    showCitiesLayer,
    latestEffectTick,
    countriesById,
    effectMarkers,
    artifactMarkers,
    cityMarkers,
    frontlineLinks,
    highlightedSet,
    focusSet,
    countryLabelZoomFactor,
    showOwnerColors,
    localeProvinceName,
    onSelectCountry,
    onSelectProvince,
    showTooltipFromClientPoint,
    clearTooltip
  };

  return (
    <>
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="world-map-svg"
        role="img"
        aria-label={`Carte du monde pour ${preset.title}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={onPointerLeave}
      >
        <MapStageDefs preset={preset} />

        {isGlobeMode ? (
          <GlobeMapRenderer
            {...sharedRendererProps}
            globeRotation={globeRotation}
          />
        ) : (
          <FlatMapRenderer
            {...sharedRendererProps}
            shouldTileFlat={shouldTileFlat}
          />
        )}
      </svg>

      {!mapReady && (
        <div className={`map-loading-overlay${mapLoadState === "error" ? " is-error" : ""}`}>
          <div className="map-loading-card">
            <strong>{mapLoadState === "error" ? "Chargement de la carte echoue" : "Chargement de la carte..."}</strong>
            <span>
              {mapLoadState === "error"
                ? "Le jeu ne peut pas lire les fichiers GeoJSON. Rafraichissez la page."
                : "Preparation des pays, provinces, villes strategiques et overlays tactiques."}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
