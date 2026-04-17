import React from "react";
import { clamp } from "./camera";
import type { MapSceneCopyProps } from "./stage-model";
import { getOptimalLabelPath } from "./countryLabelPaths";

type MapLabelsLayerProps = Pick<
  MapSceneCopyProps,
  | "copyKey"
  | "preset"
  | "zoomBand"
  | "countryLabelZoomFactor"
  | "countryLabelFeatures"
  | "provinceLabelFeatures"
  | "showCountryLabels"
  | "showRegionLabels"
>;

export function MapLabelsLayer(props: MapLabelsLayerProps): React.JSX.Element | null {
  const {
    copyKey,
    preset,
    zoomBand,
    countryLabelZoomFactor,
    countryLabelFeatures,
    provinceLabelFeatures,
    showCountryLabels,
    showRegionLabels,
  } = props;

  if (!showCountryLabels && !showRegionLabels) {
    return null;
  }

  return (
    <>
      {showCountryLabels && countryLabelFeatures.map((entry) => {
        const {
          feature,
          country,
          labelSize,
          labelOpacity,
          labelVisible,
          labelAnchor,
          labelRotate
        } = entry;

        if (!labelVisible) {
          return null;
        }

        const zoomScale = clamp(countryLabelZoomFactor, 0.72, 1.7);
        const fontSize = clamp(labelSize * zoomScale, 0.28, 1.1);
        const labelText = country.name.toUpperCase();
        const pathId = `label-path-${copyKey}-${feature.countryId}`;

        const curvedPath = getOptimalLabelPath(
          {
            ...feature,
            labelAnchor,
            labelRotate
          },
          labelText.length,
          zoomBand
        );

        const zoomOpacity = zoomBand === "far"
          ? 0.65
          : zoomBand === "global"
            ? 0.75
            : zoomBand === "regional"
              ? 0.85
              : 0.92;

        const charCount = labelText.length;
        const baseSpacing = charCount > 8
          ? 0.22
          : charCount > 5
            ? 0.28
            : 0.35;

        const useTextLength = charCount >= 4 && charCount <= 12;
        const textLengthValue = useTextLength ? curvedPath.textLength : undefined;
        const opacity = clamp(labelOpacity * zoomOpacity, 0, 1);

        return (
          <g key={`label-g-${copyKey}-${feature.countryId}`}>
            <defs>
              <path
                id={pathId}
                d={curvedPath.pathD}
              />
            </defs>
            <text
              className="world-map-label"
              dy={curvedPath.dy}
              style={{
                fontSize,
                fill: preset.mapPalette.labelColor,
                fontWeight: 700,
                fontVariantLigatures: "none",
                letterSpacing: `${baseSpacing}em`,
                opacity
              }}
            >
              <textPath
                xlinkHref={`#${pathId}`}
                href={`#${pathId}`}
                startOffset="50%"
                textAnchor="middle"
                lengthAdjust="spacingAndGlyphs"
                {...(textLengthValue && { textLength: textLengthValue })}
              >
                {labelText}
              </textPath>
            </text>
          </g>
        );
      })}

      {showRegionLabels && provinceLabelFeatures.map(({ feature, label, x, y }) => {
        const anchor = feature.labelAnchor ?? { x, y };
        const rotation = feature.labelRotate ?? 0;
        const fontSize = clamp(
          feature.bbox.width * (zoomBand === "detail" ? 0.03 : 0.022),
          zoomBand === "detail" ? 0.2 : 0.16,
          zoomBand === "detail" ? 0.32 : 0.24
        );
        return (
          <text
            key={`province-label-${copyKey}-${feature.provinceId}`}
            x={anchor.x}
            y={anchor.y}
            textAnchor="middle"
            dominantBaseline="central"
            transform={rotation !== 0 ? `rotate(${rotation.toFixed(3)} ${anchor.x.toFixed(3)} ${anchor.y.toFixed(3)})` : undefined}
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
