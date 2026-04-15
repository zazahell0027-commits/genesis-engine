import React from "react";
import { GLOBE_CLIP_RADIUS } from "./camera";
import { MapBackdropCopy } from "./MapBackdropCopy";
import { MapSceneCopy } from "./MapSceneCopy";
import type { MapSceneCopyProps } from "./stage-model";

type GlobeMapRendererProps = Omit<MapSceneCopyProps, "copyKey" | "translatedOffset"> & {
  globeRotation: number;
};

export function GlobeMapRenderer(props: GlobeMapRendererProps): React.JSX.Element {
  const { globeRotation } = props;

  return (
    <>
      <rect x="0" y="0" width="100" height="50" fill="url(#globeBackdrop)" opacity="0.82" />
      <g clipPath="url(#globeClip)">
        <MapBackdropCopy copyKey="left-globe" translatedOffset={globeRotation - 100} />
        <MapBackdropCopy copyKey="main-globe" translatedOffset={globeRotation} />
        <MapBackdropCopy copyKey="right-globe" translatedOffset={globeRotation + 100} />
        <MapSceneCopy {...props} copyKey="left-globe" translatedOffset={globeRotation - 100} />
        <MapSceneCopy {...props} copyKey="main-globe" translatedOffset={globeRotation} />
        <MapSceneCopy {...props} copyKey="right-globe" translatedOffset={globeRotation + 100} />
      </g>
      <g className="globe-overlay" pointerEvents="none">
        <circle cx="50" cy="25" r={GLOBE_CLIP_RADIUS} fill="url(#globeShade)" />
        <circle cx="50" cy="25" r={GLOBE_CLIP_RADIUS} className="globe-ring" />
      </g>
    </>
  );
}
