import type { CountryState } from "@genesis/shared";
import type { UiLocale } from "../../i18n";
import type { ZoomBand } from "./pipeline";
import { declutterWithLabelgun } from "./labelCollision";
import {
  computeCountryLabelOpacity,
  computeCountryLabelPriority,
  generateCountryLabelOffsets,
  selectCountryLabels
} from "./countryLabelPlanner";

type BoxLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CountryFeatureLike = {
  countryId: string;
  centroid: { x: number; y: number };
  bbox: BoxLike;
  labelAnchor?: { x: number; y: number };
  labelRotate?: number;
};

type ProvinceFeatureLike = {
  provinceId: string;
  parentCountryId: string;
  provinceName: string;
  provinceNameNative?: string;
  provinceNameEn?: string;
  centroid: { x: number; y: number };
  bbox: BoxLike;
  labelAnchor?: { x: number; y: number };
};

type CountryLabelEntry<TFeature extends CountryFeatureLike> = {
  feature: TFeature;
  country: CountryState;
  labelSize: number;
  labelOpacity: number;
  labelVisible: boolean;
  labelAnchor: { x: number; y: number };
  labelRotate: number;
  labelPriority: number;
  visualArea: number;
};

type ProvinceLabelEntry<TFeature extends ProvinceFeatureLike> = {
  x: number;
  y: number;
  label: string;
  feature: TFeature;
};

const REGION_LABEL_ALIASES: Record<string, Partial<Record<UiLocale, string>>> = {
  "niedersachsen": { fr: "Basse-Saxe", en: "Lower Saxony" },
  "niederosterreich": { fr: "Basse-Autriche", en: "Lower Austria" },
  "vastra gotaland": { fr: "Vastra Gotaland", en: "Vastra Gotaland" },
  "ile de france": { fr: "Ile-de-France", en: "Ile-de-France" },
  "hovedstaden": { fr: "Capitale", en: "Capital Region" }
};

function normalizeSeed(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function humanizeLabel(value: string): string {
  const cleaned = value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /[A-Z].*[a-z]/.test(cleaned)) {
    return cleaned;
  }

  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length <= 2 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

export function getProvinceDisplayName<TFeature extends ProvinceFeatureLike>(feature: TFeature, locale: UiLocale): string {
  const preferred = locale === "fr"
    ? feature.provinceNameNative ?? feature.provinceNameEn ?? feature.provinceName
    : feature.provinceNameEn ?? feature.provinceNameNative ?? feature.provinceName;

  const alias = REGION_LABEL_ALIASES[normalizeSeed(preferred)]?.[locale];
  return humanizeLabel(alias ?? preferred);
}

export function selectCountryLabelFeatures<TFeature extends CountryFeatureLike>(input: {
  countryFeatures: TFeature[];
  countriesById: Map<string, CountryState>;
  zoomBand: ZoomBand;
  labelDensityLimit: number;
  labelMinWidth: number;
  labelMinHeight: number;
}): Array<CountryLabelEntry<TFeature>> {
  const ranked = input.countryFeatures
    .map((feature) => ({ feature, country: input.countriesById.get(feature.countryId) }))
    .filter((item): item is CountryLabelEntry<TFeature> => Boolean(item.country))
    .sort((a, b) => {
      const areaDelta = (b.feature.bbox.width * b.feature.bbox.height) - (a.feature.bbox.width * a.feature.bbox.height);
      if (areaDelta !== 0) return areaDelta;
      const powerDelta = b.country.power - a.country.power;
      if (powerDelta !== 0) return powerDelta;
      return a.country.name.localeCompare(b.country.name);
    });

  const candidates = ranked.map((entry) => {
    const label = entry.country.name.toUpperCase();
    const anchor = entry.feature.labelAnchor ?? entry.feature.centroid;
    const rotation = entry.feature.labelRotate ?? 0;
    const visualArea = Math.max(0.8, entry.feature.bbox.width * entry.feature.bbox.height) * (
      input.zoomBand === "far"
        ? 13
        : input.zoomBand === "global"
          ? 14
          : input.zoomBand === "regional"
            ? 16
            : input.zoomBand === "close"
              ? 18
              : 20
    );
    const letterCount = Math.max(1, label.replace(/\s+/g, "").length);
    const spaceCount = Math.max(0, label.split(/\s+/).length - 1);
    const footprint = Math.sqrt(Math.max(0.8, entry.feature.bbox.width) * Math.max(0.6, entry.feature.bbox.height));
    const zoomScale = input.zoomBand === "far"
      ? 0.86
      : input.zoomBand === "global"
        ? 0.96
        : input.zoomBand === "regional"
          ? 1.03
          : input.zoomBand === "close"
            ? 1.08
            : 1.14;
    const estimatedWidth = Math.max(
      1.1,
      input.labelMinWidth,
      Math.sqrt(Math.max(0.8, entry.feature.bbox.width * entry.feature.bbox.height)) * 0.42,
      (letterCount * 0.13) + (spaceCount * 0.28)
    );
    const estimatedHeight = Math.max(
      0.28,
      input.labelMinHeight,
      Math.sqrt(Math.max(0.6, entry.feature.bbox.width * entry.feature.bbox.height)) * 0.18
    );
    const fitWidth = entry.feature.bbox.width / Math.max(estimatedWidth, 0.01);
    const fitHeight = entry.feature.bbox.height / Math.max(estimatedHeight, 0.01);
    const fitScore = Math.max(0, Math.min(fitWidth, fitHeight));
    const labelSize = Math.max(
      0.28,
      Math.min(1.1, Math.sqrt(visualArea) * 0.018 * zoomScale)
    );
    const labelOpacity = computeCountryLabelOpacity(visualArea);
    const labelPriority = computeCountryLabelPriority({
      visualArea,
      basePriority: entry.country.power * 42 + entry.country.stability * 8 + entry.country.industry * 18,
      selected: false,
      highlighted: false,
      focused: false,
      known: true
    });
    const candidateOffsets = generateCountryLabelOffsets({
      rotation,
      majorSpan: Math.max(estimatedWidth * 1.4, entry.feature.bbox.width * 0.72),
      minorSpan: Math.max(estimatedHeight * 1.8, entry.feature.bbox.height * 0.54),
      fontSize: labelSize
    });

    return {
      id: entry.feature.countryId,
      countryId: entry.feature.countryId,
      text: label,
      anchor,
      priority: labelPriority,
      weight: Math.round((fitScore * 20_000) + (footprint * 4_000) + (entry.country.power * 40)),
      visualArea,
      fontSize: labelSize,
      opacity: labelOpacity,
      rotation,
      tracking: 0.12 + Math.min(0.08, Math.max(0, (footprint - 3) * 0.01)),
      bounds: {
        x: anchor.x - estimatedWidth / 2,
        y: anchor.y - estimatedHeight / 2,
        width: estimatedWidth,
        height: estimatedHeight
      },
      fitScore: fitScore,
      candidateOffsets,
      item: entry
    };
  });

  return selectCountryLabels({
    candidates,
    zoomBand: input.zoomBand,
    maxCount: input.labelDensityLimit
  }).map((placement) => ({
    feature: placement.item.feature,
    country: placement.item.country,
    labelSize: placement.fontSize,
    labelOpacity: placement.opacity,
    labelVisible: placement.visible,
    labelAnchor: placement.anchor,
    labelRotate: placement.rotation,
    labelPriority: placement.priority,
    visualArea: placement.visualArea
  }));
}

export function selectProvinceLabelFeatures<TFeature extends ProvinceFeatureLike>(input: {
  provinceFeatures: TFeature[];
  selectedCountryId: string | null;
  zoomBand: ZoomBand;
  locale: UiLocale;
  showInvisible: boolean;
}): Array<ProvinceLabelEntry<TFeature>> {
  if (!input.selectedCountryId) return [];

  const isDetail = input.zoomBand === "detail";
  const minWidth = isDetail ? 0.95 : 1.28;
  const minHeight = isDetail ? 0.28 : 0.36;
  const maxCount = input.showInvisible ? (isDetail ? 9 : 5) : (isDetail ? 5 : 3);

  const ranked = input.provinceFeatures
    .filter((feature) => feature.parentCountryId === input.selectedCountryId)
    .filter((feature) => feature.bbox.width > minWidth && feature.bbox.height > minHeight)
    .map((feature) => {
      const label = getProvinceDisplayName(feature, input.locale);
      const estimatedWidth = Math.max(0.68, label.length * (isDetail ? 0.12 : 0.15));
      return {
        x: feature.centroid.x,
        y: feature.centroid.y,
        label,
        feature,
        estimatedWidth
      };
    })
    .filter((entry) => entry.feature.bbox.width >= entry.estimatedWidth * (isDetail ? 1.05 : 1.15))
    .sort((a, b) => {
      const areaDelta = (b.feature.bbox.width * b.feature.bbox.height) - (a.feature.bbox.width * a.feature.bbox.height);
      if (areaDelta !== 0) return areaDelta;
      return a.label.length - b.label.length;
    });

  return declutterWithLabelgun(
    ranked.map((item) => {
      const anchor = item.feature.labelAnchor ?? item.feature.centroid;
      const estimatedWidth = Math.max(0.68, Math.min(item.feature.bbox.width * 0.42, item.estimatedWidth));
      const estimatedHeight = isDetail ? 0.34 : 0.38;
      return {
        id: item.feature.provinceId,
        item,
        weight: (item.feature.bbox.width * item.feature.bbox.height * 1_000) - item.label.length,
        bounds: {
          x: anchor.x - estimatedWidth / 2,
          y: anchor.y - estimatedHeight / 2,
          width: estimatedWidth,
          height: estimatedHeight
        }
      };
    }),
    maxCount
  ).map(({ x, y, label, feature }) => ({ x, y, label, feature }));
}
