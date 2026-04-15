import type { MapArtifact, MapEffect } from "@genesis/shared";

export type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GeoGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type GeoFeatureSource = {
  type: "Feature";
  properties: {
    name?: string;
    admin?: string;
    id?: string;
    country?: string;
    countryId?: string;
    NAME_1?: string;
    name_en?: string;
  };
  geometry: GeoGeometry;
};

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeatureSource[];
};

export type Feature = {
  id: number;
  countryId: string;
  name: string;
  path: string;
  centroid: { x: number; y: number };
  bbox: { x: number; y: number; width: number; height: number };
};

export type ProvinceFeature = Feature & {
  provinceId: string;
  provinceName: string;
  provinceNameNative?: string;
  provinceNameEn?: string;
  parentCountryId: string;
};

export type Tooltip = {
  x: number;
  y: number;
  title: string;
  subtitle: string;
};

export type CityMarker = {
  id: string;
  countryId: string;
  tier: "capital" | "major";
  label: string;
  x: number;
  y: number;
};

export type EffectMarker = {
  id: string;
  kind: MapEffect["kind"];
  countryId: string;
  label: string;
  intensity: number;
  latestTick: number;
  x: number;
  y: number;
};

export type ArtifactMarker = {
  id: string;
  kind: MapArtifact["kind"];
  countryId: string;
  label: string;
  strength: number;
  x: number;
  y: number;
};
