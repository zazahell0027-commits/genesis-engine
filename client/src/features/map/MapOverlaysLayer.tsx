import React from "react";
import { clamp } from "./camera";
import { artifactGlyph, artifactMarkerPath, cityMarkerPath, effectGlyph } from "./presentation";
import type { MapSceneCopyProps } from "./stage-model";

type MapOverlaysLayerProps = Pick<
  MapSceneCopyProps,
  | "copyKey"
  | "zoomBand"
  | "borderScale"
  | "markerScaleBase"
  | "showFrontlineLayer"
  | "showEffectsLayer"
  | "showArtifactsLayer"
  | "showCitiesLayer"
  | "latestEffectTick"
  | "countriesById"
  | "effectMarkers"
  | "artifactMarkers"
  | "cityMarkers"
  | "frontlineLinks"
  | "showTooltipFromClientPoint"
  | "clearTooltip"
>;

export function MapOverlaysLayer(props: MapOverlaysLayerProps): React.JSX.Element | null {
  const {
    copyKey,
    zoomBand,
    borderScale,
    markerScaleBase,
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
    showTooltipFromClientPoint,
    clearTooltip
  } = props;

  if (!showFrontlineLayer && !showEffectsLayer && !showArtifactsLayer && !showCitiesLayer) {
    return null;
  }

  return (
    <>
      {showFrontlineLayer && frontlineLinks.map((line, index) => (
        <line
          key={`frontline-${copyKey}-${line.from.countryId}-${line.to.countryId}-${index}`}
          x1={line.from.centroid.x}
          y1={line.from.centroid.y}
          x2={line.to.centroid.x}
          y2={line.to.centroid.y}
          className="frontline-link"
          style={{ strokeWidth: Math.min(0.22, 0.075 + line.intensity * 0.018) * borderScale }}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {showEffectsLayer && effectMarkers.map((marker) => {
        const radius = clamp((0.21 + marker.intensity * 0.028) * markerScaleBase, 0.085, 0.42);
        return (
          <g
            key={`effect-${copyKey}-${marker.id}`}
            className={`map-effect-marker kind-${marker.kind}${marker.latestTick >= latestEffectTick ? " is-recent" : ""}`}
            transform={`translate(${marker.x.toFixed(3)} ${marker.y.toFixed(3)})`}
            onMouseMove={(event) => {
              const countryName = countriesById.get(marker.countryId)?.name ?? marker.countryId;
              showTooltipFromClientPoint(event.clientX, event.clientY, countryName, marker.label);
            }}
            onMouseLeave={clearTooltip}
          >
            <circle r={radius} />
            <text textAnchor="middle" dominantBaseline="central">
              {effectGlyph(marker.kind)}
            </text>
          </g>
        );
      })}

      {showArtifactsLayer && artifactMarkers.map((marker) => {
        const radius = clamp((0.2 + marker.strength * 0.02) * markerScaleBase, 0.085, 0.44);
        return (
          <g
            key={`artifact-${copyKey}-${marker.id}`}
            className={`map-artifact-marker kind-${marker.kind}`}
            transform={`translate(${marker.x.toFixed(3)} ${marker.y.toFixed(3)})`}
            onMouseMove={(event) => {
              const countryName = countriesById.get(marker.countryId)?.name ?? marker.countryId;
              showTooltipFromClientPoint(event.clientX, event.clientY, `${countryName} | Force ${marker.strength}`, marker.label);
            }}
            onMouseLeave={clearTooltip}
          >
            <path d={artifactMarkerPath(marker.kind, radius)} />
            <text textAnchor="middle" dominantBaseline="central">
              {artifactGlyph(marker.kind)}
            </text>
          </g>
        );
      })}

      {showCitiesLayer && cityMarkers.map((marker) => {
        const radius = (marker.tier === "capital" ? 0.25 : 0.18) * markerScaleBase;
        const showCityLabel = zoomBand === "detail" || (zoomBand === "close" && marker.tier === "capital");
        return (
          <g
            key={`city-${copyKey}-${marker.id}`}
            className={`city-marker tier-${marker.tier}`}
            transform={`translate(${marker.x.toFixed(3)} ${marker.y.toFixed(3)})`}
            onMouseMove={(event) => {
              showTooltipFromClientPoint(
                event.clientX,
                event.clientY,
                marker.label,
                marker.tier === "capital" ? "Capitale strategique" : "Ville majeure"
              );
            }}
            onMouseLeave={clearTooltip}
          >
            <path d={cityMarkerPath(marker.tier, radius)} />
            {showCityLabel && (
              <text
                className={`city-marker-label tier-${marker.tier}`}
                x={marker.tier === "capital" ? 0.4 * markerScaleBase : 0.3 * markerScaleBase}
                y={marker.tier === "capital" ? -0.3 * markerScaleBase : -0.22 * markerScaleBase}
                style={{
                  fontSize: zoomBand === "detail"
                    ? (marker.tier === "capital" ? 0.36 : 0.3)
                    : 0.27
                }}
              >
                {marker.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
