import React from "react";

type MapBackdropCopyProps = {
  copyKey: string;
  translatedOffset: number;
};

export function MapBackdropCopy({ copyKey, translatedOffset }: MapBackdropCopyProps): React.JSX.Element {
  return (
    <g key={`backdrop-${copyKey}`} transform={`translate(${translatedOffset}, 0)`} className="map-backdrop-copy">
      <rect x="0" y="0" width="100" height="50" fill="url(#oceanGradient)" />
      <rect x="0" y="0" width="100" height="50" fill="url(#oceanCurrents)" opacity="0.48" />
      <rect x="0" y="0" width="100" height="50" fill="url(#oceanGrain)" opacity="0.18" />
      <rect x="0" y="0" width="100" height="50" fill="url(#oceanBloom)" opacity="0.2" />
      <rect x="0" y="0" width="100" height="50" fill="url(#oceanDepth)" opacity="0.86" />
    </g>
  );
}
