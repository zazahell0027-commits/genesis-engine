import type { ZoomBand } from "./pipeline";
import { clusterByGrid, declutterByBounds, declutterByDistance } from "./spatial";

type BoxLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PointLike = {
  x: number;
  y: number;
};

type ProvinceFeatureLike = {
  parentCountryId: string;
  bbox: BoxLike;
};

type EffectMarkerLike = PointLike & {
  countryId: string;
  intensity: number;
  latestTick: number;
  label: string;
};

type ArtifactMarkerLike = PointLike & {
  countryId: string;
  strength: number;
  label: string;
};

type CityMarkerLike = PointLike & {
  countryId: string;
  tier: "capital" | "major";
  label: string;
};

export function selectVisibleProvinceFeatures<T extends ProvinceFeatureLike>(input: {
  provinceFeatures: T[];
  showProvinceLayer: boolean;
  selectedCountryId: string | null;
  showInvisible: boolean;
  preferSelectedCountry: boolean;
  isDetailZoom: boolean;
  viewBox: BoxLike;
}): T[] {
  if (!input.showProvinceLayer) return [];

  return input.provinceFeatures
    .filter((feature) => {
      if (input.showInvisible) return true;
      if (!input.selectedCountryId) return false;
      if (input.isDetailZoom || input.preferSelectedCountry) {
        return feature.parentCountryId === input.selectedCountryId;
      }
      return feature.parentCountryId === input.selectedCountryId;
    })
    .filter((feature) => !(
      feature.bbox.x > input.viewBox.x + input.viewBox.width
      || feature.bbox.x + feature.bbox.width < input.viewBox.x
      || feature.bbox.y > input.viewBox.y + input.viewBox.height
      || feature.bbox.y + feature.bbox.height < input.viewBox.y
    ));
}

export function selectVisibleEffectMarkers<T extends EffectMarkerLike>(input: {
  raw: T[];
  zoomBand: ZoomBand;
  selectedCountryId: string | null;
  showInvisible: boolean;
  minDistance: number;
  maxCount: number;
}): T[] {
  if (input.raw.length === 0) return [];

  const filtered = filterMarkersByZoomFocus(input.raw, input.zoomBand, input.selectedCountryId, input.showInvisible);
  const ranked = [...filtered].sort((a, b) => b.intensity - a.intensity);
  const clustered = clusterByGrid(ranked, {
    cellSize: input.zoomBand === "close" ? 1.8 : 1.2,
    maxCount: input.maxCount,
    merge: (bucket) => {
      const strongest = [...bucket].sort((left, right) => right.intensity - left.intensity)[0] ?? bucket[0];
      const intensity = Math.round(bucket.reduce((sum, marker) => sum + marker.intensity, 0));
      const latestTick = Math.max(...bucket.map((marker) => marker.latestTick));
      const x = bucket.reduce((sum, marker) => sum + marker.x, 0) / bucket.length;
      const y = bucket.reduce((sum, marker) => sum + marker.y, 0) / bucket.length;
      return {
        ...strongest,
        intensity,
        latestTick,
        x,
        y,
        label: bucket.length > 1 ? `${strongest.label} (+${bucket.length - 1})` : strongest.label
      };
    },
    sort: (left, right) => right.intensity - left.intensity
  });

  return declutterByDistance(clustered, input.minDistance, input.maxCount);
}

export function selectVisibleArtifactMarkers<T extends ArtifactMarkerLike>(input: {
  raw: T[];
  zoomBand: ZoomBand;
  selectedCountryId: string | null;
  showInvisible: boolean;
  minDistance: number;
  maxCount: number;
}): T[] {
  if (input.raw.length === 0) return [];

  const filtered = filterMarkersByZoomFocus(input.raw, input.zoomBand, input.selectedCountryId, input.showInvisible);
  const ranked = [...filtered].sort((a, b) => b.strength - a.strength);
  const clustered = clusterByGrid(ranked, {
    cellSize: input.zoomBand === "close" ? 1.55 : 1.05,
    maxCount: input.maxCount,
    merge: (bucket) => {
      const strongest = [...bucket].sort((left, right) => right.strength - left.strength)[0] ?? bucket[0];
      const strength = Math.round(bucket.reduce((sum, marker) => sum + marker.strength, 0));
      const x = bucket.reduce((sum, marker) => sum + marker.x, 0) / bucket.length;
      const y = bucket.reduce((sum, marker) => sum + marker.y, 0) / bucket.length;
      return {
        ...strongest,
        strength,
        x,
        y,
        label: bucket.length > 1 ? `${strongest.label} (+${bucket.length - 1})` : strongest.label
      };
    },
    sort: (left, right) => right.strength - left.strength
  });

  return declutterByDistance(clustered, input.minDistance, input.maxCount);
}

export function selectVisibleCityMarkers<T extends CityMarkerLike>(input: {
  raw: T[];
  zoomBand: ZoomBand;
  selectedCountryId: string | null;
  showInvisible: boolean;
  minDistance: number;
  maxCount: number;
}): T[] {
  if (input.raw.length === 0) return [];

  let filtered = [...input.raw];

  if (input.zoomBand === "close") {
    if (!input.showInvisible && !input.selectedCountryId) return [];
    filtered = filtered.filter((marker) => marker.tier === "capital");
    if (input.selectedCountryId && !input.showInvisible) {
      filtered = filtered.filter((marker) => marker.countryId === input.selectedCountryId);
    }
  }

  if (input.zoomBand === "detail") {
    if (!input.showInvisible && !input.selectedCountryId) return [];
    if (input.selectedCountryId && !input.showInvisible) {
      filtered = filtered.filter((marker) => marker.countryId === input.selectedCountryId);
    }
  }

  const ranked = filtered.sort((a, b) => {
    if (a.countryId === input.selectedCountryId && b.countryId !== input.selectedCountryId) return -1;
    if (b.countryId === input.selectedCountryId && a.countryId !== input.selectedCountryId) return 1;
    if (a.tier !== b.tier) return a.tier === "capital" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const clustered = clusterByGrid(ranked, {
    cellSize: input.zoomBand === "close" ? 2.4 : 1.35,
    maxCount: input.maxCount,
    merge: (bucket) => {
      const capital = bucket.find((marker) => marker.tier === "capital");
      const reference = capital ?? bucket[0];
      const x = bucket.reduce((sum, marker) => sum + marker.x, 0) / bucket.length;
      const y = bucket.reduce((sum, marker) => sum + marker.y, 0) / bucket.length;
      return {
        ...reference,
        x,
        y,
        label: bucket.length > 1 && reference.tier !== "capital"
          ? `${reference.label} (+${bucket.length - 1})`
          : reference.label
      };
    },
    sort: (left, right) => {
      if (left.countryId === input.selectedCountryId && right.countryId !== input.selectedCountryId) return -1;
      if (right.countryId === input.selectedCountryId && left.countryId !== input.selectedCountryId) return 1;
      if (left.tier !== right.tier) return left.tier === "capital" ? -1 : 1;
      return left.label.localeCompare(right.label);
    }
  });

  return declutterByBounds(
    clustered,
    (marker) => {
      const labelFactor = input.zoomBand === "detail" ? 0.115 : 0.095;
      const labelWidth = Math.max(0.5, marker.label.length * labelFactor);
      const markerRadius = marker.tier === "capital" ? 0.42 : 0.3;
      const width = markerRadius + labelWidth;
      const height = input.zoomBand === "detail" ? 0.44 : 0.34;
      return {
        x: marker.x - markerRadius * 0.5,
        y: marker.y - height,
        width,
        height
      };
    },
    input.maxCount,
    input.zoomBand === "detail" ? 0.1 : 0.18
  );
}

function filterMarkersByZoomFocus<T extends { countryId: string }>(
  markers: T[],
  zoomBand: ZoomBand,
  selectedCountryId: string | null,
  showInvisible: boolean
): T[] {
  if (showInvisible) return markers;
  if (zoomBand !== "close" && zoomBand !== "detail") return markers;
  if (!selectedCountryId) return zoomBand === "detail" ? [] : markers.slice(0, Math.min(4, markers.length));
  return markers.filter((marker) => marker.countryId === selectedCountryId);
}
