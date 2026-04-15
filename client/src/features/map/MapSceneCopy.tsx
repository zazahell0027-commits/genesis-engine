import React from "react";
import { MapGeographyLayer } from "./MapGeographyLayer";
import { MapLabelsLayer } from "./MapLabelsLayer";
import { MapOverlaysLayer } from "./MapOverlaysLayer";
import type { MapSceneCopyProps } from "./stage-model";

export function MapSceneCopy(props: MapSceneCopyProps): React.JSX.Element {
  const { translatedOffset } = props;

  return (
    <g transform={translatedOffset !== 0 ? `translate(${translatedOffset.toFixed(3)} 0)` : undefined}>
      <MapGeographyLayer {...props} />
      <MapLabelsLayer {...props} />
      <MapOverlaysLayer {...props} />
    </g>
  );
}
