import React from "react";
import { countryFill } from "./presentation";
import type { MapSceneCopyProps } from "./stage-model";

type MapGeographyLayerProps = Pick<
  MapSceneCopyProps,
  | "copyKey"
  | "preset"
  | "zoomBand"
  | "overlayMode"
  | "borderScale"
  | "mapReady"
  | "selectedCountryId"
  | "selectedProvinceId"
  | "countryFeatures"
  | "visibleProvinceFeatures"
  | "showProvinceLayer"
  | "countriesById"
  | "highlightedSet"
  | "focusSet"
  | "showOwnerColors"
  | "localeProvinceName"
  | "onSelectCountry"
  | "onSelectProvince"
  | "showTooltipFromClientPoint"
  | "clearTooltip"
>;

export function MapGeographyLayer(props: MapGeographyLayerProps): React.JSX.Element {
  const {
    copyKey,
    preset,
    zoomBand,
    overlayMode,
    borderScale,
    mapReady,
    selectedCountryId,
    selectedProvinceId,
    countryFeatures,
    visibleProvinceFeatures,
    showProvinceLayer,
    countriesById,
    highlightedSet,
    focusSet,
    showOwnerColors,
    localeProvinceName,
    onSelectCountry,
    onSelectProvince,
    showTooltipFromClientPoint,
    clearTooltip
  } = props;

  const countryStrokeWidth = (zoomBand === "detail" ? 0.042 : zoomBand === "close" ? 0.075 : zoomBand === "regional" ? 0.11 : 0.13) * borderScale;
  const selectedStrokeWidth = (zoomBand === "detail" ? 0.11 : zoomBand === "close" ? 0.16 : 0.2) * borderScale;

  return (
    <>
      {zoomBand !== "detail" && (
      <g className="coast-outline-layer">
        {countryFeatures.map((feature) => (
          <path
            key={`coast-${copyKey}-${feature.id}`}
            d={feature.path}
            fill="none"
            stroke="rgba(231, 241, 255, 0.18)"
            strokeWidth={0.055 * borderScale}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>
      )}

      <g className="country-landmass-layer">
        {countryFeatures.map((feature) => {
          const country = countriesById.get(feature.countryId);
          const isSelected = selectedCountryId === feature.countryId;
          const isImpacted = highlightedSet.has(feature.countryId);
          const isFocused = focusSet.has(feature.countryId);

          return (
            <path
              key={`country-${copyKey}-${feature.id}`}
              d={feature.path}
              fill={country ? countryFill(country, preset, overlayMode, showOwnerColors) : "#365370"}
              stroke={isSelected ? "#fff4c6" : preset.mapPalette.landStroke}
              strokeWidth={isSelected ? selectedStrokeWidth : countryStrokeWidth}
              className={`country-shape${country ? " active" : ""}${isSelected ? " is-selected" : ""}${isImpacted ? " has-impact" : ""}${isFocused ? " is-focused" : ""}`}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              onClick={() => {
                if (!country || !mapReady) return;
                onSelectCountry(country.id);
              }}
              onMouseMove={(event) => {
                if (!country) return;
                showTooltipFromClientPoint(
                  event.clientX,
                  event.clientY,
                  country.name,
                  `${country.descriptor} | Puissance ${country.power} | Armee ${country.army} | Industrie ${country.industry}`
                );
              }}
              onMouseLeave={clearTooltip}
            >
              <title>
                {country
                  ? `${country.name} | ${country.descriptor} | Puissance ${country.power} | Armee ${country.army} | Industrie ${country.industry} | Fort ${country.fortification}`
                  : feature.name}
              </title>
            </path>
          );
        })}
      </g>

      {showProvinceLayer && (
        <g className="province-layer">
          {visibleProvinceFeatures.map((feature) => {
            const country = countriesById.get(feature.parentCountryId);
            if (!country) return null;
            const isSelected = selectedProvinceId === feature.provinceId;
            return (
              <path
                key={`province-${copyKey}-${feature.provinceId}`}
                d={feature.path}
                className={`province-shape${isSelected ? " is-selected" : ""}${feature.parentCountryId === selectedCountryId ? " is-player-country" : ""}`}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ strokeWidth: (isSelected ? 0.09 : 0.032) * borderScale }}
                onClick={() => onSelectProvince?.(feature.provinceId, feature.parentCountryId)}
                onMouseMove={(event) => {
                  showTooltipFromClientPoint(event.clientX, event.clientY, localeProvinceName(feature), `${country.name} | Region`);
                }}
                onMouseLeave={clearTooltip}
              />
            );
          })}
        </g>
      )}
    </>
  );
}
