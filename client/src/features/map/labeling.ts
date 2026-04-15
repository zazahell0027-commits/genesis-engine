import type { CountryState } from "@genesis/shared";
import type { UiLocale } from "../../i18n";
import type { ZoomBand } from "./pipeline";
import { declutterByBounds } from "./spatial";

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
};

type ProvinceFeatureLike = {
  parentCountryId: string;
  provinceName: string;
  provinceNameNative?: string;
  provinceNameEn?: string;
  centroid: { x: number; y: number };
  bbox: BoxLike;
};

type CountryLabelEntry<TFeature extends CountryFeatureLike> = {
  feature: TFeature;
  country: CountryState;
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
  selectedCountryId: string | null;
  zoomBand: ZoomBand;
  viewWidth: number;
  labelDensityLimit: number;
  labelMinWidth: number;
  labelMinHeight: number;
}): Array<CountryLabelEntry<TFeature>> {
  const selectionOnly = input.zoomBand === "close" || input.zoomBand === "detail" || input.viewWidth < 15;
  const maxCount = selectionOnly ? 1 : input.labelDensityLimit;

  const ranked = input.countryFeatures
    .map((feature) => ({ feature, country: input.countriesById.get(feature.countryId) }))
    .filter((item): item is CountryLabelEntry<TFeature> => Boolean(item.country))
    .sort((a, b) => {
      const selectedBoostA = a.country.id === input.selectedCountryId ? 1 : 0;
      const selectedBoostB = b.country.id === input.selectedCountryId ? 1 : 0;
      if (selectedBoostA !== selectedBoostB) return selectedBoostB - selectedBoostA;
      return b.country.power - a.country.power;
    })
    .filter((item) => item.feature.bbox.width > input.labelMinWidth && item.feature.bbox.height > input.labelMinHeight)
    .filter((item) => (selectionOnly ? item.country.id === input.selectedCountryId : true));

  return declutterByBounds(
    ranked,
    (item) => {
      const width = Math.max(1.4, item.feature.bbox.width * 0.54);
      const height = Math.max(0.34, item.feature.bbox.height * 0.21);
      return {
        x: item.feature.centroid.x - width / 2,
        y: item.feature.centroid.y - height / 2,
        width,
        height
      };
    },
    maxCount,
    input.zoomBand === "far" ? 0.54 : input.zoomBand === "regional" ? 0.28 : 0.22
  );
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

  return declutterByBounds(
    ranked,
    (item) => {
      const estimatedWidth = Math.max(0.68, Math.min(item.feature.bbox.width * 0.42, item.estimatedWidth));
      const estimatedHeight = isDetail ? 0.34 : 0.38;
      return {
        x: item.x - estimatedWidth / 2,
        y: item.y - estimatedHeight / 2,
        width: estimatedWidth,
        height: estimatedHeight
      };
    },
    maxCount,
    isDetail ? 0.1 : 0.16
  ).map(({ x, y, label, feature }) => ({ x, y, label, feature }));
}
