import React from "react";
import { clamp } from "./camera";
import type { MapSceneCopyProps } from "./stage-model";

type MapLabelsLayerProps = Pick<
  MapSceneCopyProps,
  | "copyKey"
  | "preset"
  | "zoomBand"
  | "selectedCountryId"
  | "countryLabelFeatures"
  | "provinceLabelFeatures"
  | "showCountryLabels"
  | "showRegionLabels"
  | "countryLabelZoomFactor"
>;

export function MapLabelsLayer(props: MapLabelsLayerProps): React.JSX.Element | null {
  const {
    copyKey,
    preset,
    zoomBand,
    selectedCountryId,
    countryLabelFeatures,
    provinceLabelFeatures,
    showCountryLabels,
    showRegionLabels,
    countryLabelZoomFactor
  } = props;

  if (!showCountryLabels && !showRegionLabels) {
    return null;
  }

  return (
    <>
      {showCountryLabels && countryLabelFeatures.map(({ feature, country }) => {
        const fontSize = clamp(feature.bbox.width * 0.027 * countryLabelZoomFactor, 0.28, 0.78);
        return (
          <text
            key={`label-${copyKey}-${feature.id}`}
            x={feature.centroid.x}
            y={feature.centroid.y}
            textAnchor="middle"
            className="world-map-label"
            style={{
              fontSize,
              fill: preset.mapPalette.labelColor,
              letterSpacing: `${Math.max(0.028, fontSize * 0.052)}em`,
              opacity: zoomBand === "close" && country.id !== selectedCountryId ? 0.46 : zoomBand === "far" ? 0.7 : 0.84
            }}
          >
            {country.name.toUpperCase()}
          </text>
        );
      })}

      {showRegionLabels && provinceLabelFeatures.map(({ feature, label, x, y }) => {
        const fontSize = clamp(
          feature.bbox.width * (zoomBand === "detail" ? 0.024 : 0.018),
          zoomBand === "detail" ? 0.17 : 0.15,
          zoomBand === "detail" ? 0.27 : 0.2
        );
        return (
          <text
            key={`province-label-${copyKey}-${feature.provinceId}`}
            x={x}
            y={y}
            textAnchor="middle"
            className="province-label"
            style={{ fontSize, opacity: zoomBand === "detail" ? 0.72 : 0.58 }}
          >
            {label}
          </text>
        );
      })}
    </>
  );
}
