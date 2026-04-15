import React from "react";
import { MapBackdropCopy } from "./MapBackdropCopy";
import { MapSceneCopy } from "./MapSceneCopy";
import type { MapSceneCopyProps } from "./stage-model";

type FlatMapRendererProps = Omit<MapSceneCopyProps, "copyKey" | "translatedOffset"> & {
  shouldTileFlat: boolean;
};

export function FlatMapRenderer(props: FlatMapRendererProps): React.JSX.Element {
  if (!props.shouldTileFlat) {
    return (
      <>
        <MapBackdropCopy copyKey="single-flat" translatedOffset={0} />
        <MapSceneCopy {...props} copyKey="single-flat" translatedOffset={0} />
        <rect x="-100" y="0" width="300" height="50" fill="url(#edgeVignette)" opacity="0.76" pointerEvents="none" />
      </>
    );
  }

  return (
    <>
      <MapBackdropCopy copyKey="left-flat" translatedOffset={-100} />
      <MapBackdropCopy copyKey="main-flat" translatedOffset={0} />
      <MapBackdropCopy copyKey="right-flat" translatedOffset={100} />
      <MapSceneCopy {...props} copyKey="left-flat" translatedOffset={-100} />
      <MapSceneCopy {...props} copyKey="main-flat" translatedOffset={0} />
      <MapSceneCopy {...props} copyKey="right-flat" translatedOffset={100} />
      <rect x="-100" y="0" width="300" height="50" fill="url(#edgeVignette)" opacity="0.72" pointerEvents="none" />
    </>
  );
}
