import lodSpec from "./map-lod-spec.json";
import visualTargets from "./map-visual-targets.json";

export type ZoomBand = "far" | "global" | "regional" | "close" | "detail";

export type LodPolicy = {
  showCountryLabels: boolean;
  showRegionLabels: boolean;
  showProvinceLayer: boolean;
  showFrontlineLayer: boolean;
  showEffectsLayer: boolean;
  showArtifactsLayer: boolean;
  showCitiesLayer: boolean;
  labelDensityLimit: number;
  labelMinWidth: number;
  labelMinHeight: number;
  countryLabelZoomFactor: number;
  effectMinDistance: number;
  effectMaxCount: number;
  artifactMinDistance: number;
  artifactMaxCount: number;
  cityMinDistance: number;
  cityMaxCount: number;
};

export type LodContext = {
  zoomBand: ZoomBand;
  viewWidth: number;
  selectedCountryId: string | null;
  showInvisible: boolean;
  showMapElements: boolean;
  showRegionMarkers: boolean;
  showRegionLabels: boolean;
  showCountryLabels: boolean;
};

type BandSpec = {
  showCountryLabels: boolean;
  showRegionLabels: boolean;
  showProvinceLayer: boolean;
  showFrontlineLayer: boolean;
  showEffectsLayer: boolean;
  showArtifactsLayer: boolean;
  showCitiesLayer: boolean;
  labelDensityLimit: number;
  labelMinWidth: number;
  labelMinHeight: number;
  countryLabelZoomFactorBase: number;
  countryLabelZoomFactorMin: number;
  countryLabelZoomFactorMax: number;
  effectMinDistance: number;
  effectMaxCount: number;
  artifactMinDistance: number;
  artifactMaxCount: number;
  cityMinDistance: number;
  cityMaxCount: number;
};

type LodSpec = {
  version: number;
  thresholds: {
    farMinWidth: number;
    globalMinWidth: number;
    regionalMinWidth: number;
    closeMinWidth: number;
  };
  closeDetailRules: {
    countryLabelsRequireSelection: boolean;
    regionLabelsRequireSelection: boolean;
    regionLabelsCloseMaxWidth: number;
    citiesCloseRequireSelection: boolean;
    citiesDetailRequireSelection: boolean;
    effectsDetailRequireSelection: boolean;
    artifactsDetailRequireSelection: boolean;
    provincesPreferSelectionUntilWidth: number;
  };
  bands: Record<ZoomBand, BandSpec>;
};

const spec = lodSpec as LodSpec;

export function deriveZoomBand(viewWidth: number): ZoomBand {
  if (viewWidth >= spec.thresholds.farMinWidth) return "far";
  if (viewWidth >= spec.thresholds.globalMinWidth) return "global";
  if (viewWidth >= spec.thresholds.regionalMinWidth) return "regional";
  if (viewWidth >= spec.thresholds.closeMinWidth) return "close";
  return "detail";
}

export function getLodPolicy(context: LodContext): LodPolicy {
  const band = spec.bands[context.zoomBand];
  const selection = Boolean(context.selectedCountryId);
  const closeRules = spec.closeDetailRules;

  const showCountryLabels = context.showCountryLabels
    && band.showCountryLabels;

  const showRegionLabels = context.showMapElements
    && context.showRegionLabels
    && band.showRegionLabels
    && (!closeRules.regionLabelsRequireSelection || selection || context.showInvisible)
    && (
      context.zoomBand === "detail"
      || context.viewWidth <= closeRules.regionLabelsCloseMaxWidth
    );

  const showProvinceLayer = context.showMapElements && band.showProvinceLayer;
  const showFrontlineLayer = context.showMapElements && band.showFrontlineLayer;
  const showEffectsLayer = context.showMapElements && context.showRegionMarkers && band.showEffectsLayer;
  const showEffectsLayerResolved = showEffectsLayer && (
    context.zoomBand !== "detail"
    || !closeRules.effectsDetailRequireSelection
    || selection
    || context.showInvisible
  );
  const showArtifactsLayer = context.showMapElements && context.showRegionMarkers && band.showArtifactsLayer;
  const showArtifactsLayerResolved = showArtifactsLayer && (
    context.zoomBand !== "detail"
    || !closeRules.artifactsDetailRequireSelection
    || selection
    || context.showInvisible
  );
  const showCitiesLayer = context.showMapElements
    && context.showRegionMarkers
    && band.showCitiesLayer
    && (
      (
        context.zoomBand !== "close"
        || !closeRules.citiesCloseRequireSelection
        || selection
      )
      && (
        context.zoomBand !== "detail"
        || !closeRules.citiesDetailRequireSelection
        || selection
        || context.showInvisible
      )
    );

  const countryLabelZoomFactor = clamp(
    band.countryLabelZoomFactorBase / Math.max(8, context.viewWidth),
    band.countryLabelZoomFactorMin,
    band.countryLabelZoomFactorMax
  );

  const maxDensityFactor = context.showInvisible ? 1.55 : 1;
  const markerVisibilityFactor = context.showInvisible ? 1.4 : 1;
  const markerDistanceFactor = context.showInvisible ? 0.7 : 1;

  return {
    showCountryLabels,
    showRegionLabels,
    showProvinceLayer,
    showFrontlineLayer,
    showEffectsLayer: showEffectsLayerResolved,
    showArtifactsLayer: showArtifactsLayerResolved,
    showCitiesLayer,
    labelDensityLimit: Math.round(band.labelDensityLimit * maxDensityFactor),
    labelMinWidth: band.labelMinWidth,
    labelMinHeight: band.labelMinHeight,
    countryLabelZoomFactor,
    effectMinDistance: band.effectMinDistance * markerDistanceFactor,
    effectMaxCount: Math.round(band.effectMaxCount * markerVisibilityFactor),
    artifactMinDistance: band.artifactMinDistance * markerDistanceFactor,
    artifactMaxCount: Math.round(band.artifactMaxCount * markerVisibilityFactor),
    cityMinDistance: band.cityMinDistance * markerDistanceFactor,
    cityMaxCount: Math.round(band.cityMaxCount * markerVisibilityFactor)
  };
}

export function shouldPreferSelectedCountryProvinces(viewWidth: number): boolean {
  return viewWidth > spec.closeDetailRules.provincesPreferSelectionUntilWidth;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mapPipelineSnapshotPayload(): Record<string, unknown> {
  return {
    lodSpecVersion: spec.version,
    thresholds: spec.thresholds,
    closeDetailRules: spec.closeDetailRules,
    bands: spec.bands,
    visualTargets
  };
}
