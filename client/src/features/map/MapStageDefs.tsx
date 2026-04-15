import React from "react";
import type { PresetSummary } from "@genesis/shared";
import { GLOBE_CLIP_RADIUS } from "./camera";

type MapStageDefsProps = {
  preset: PresetSummary;
};

export function MapStageDefs({ preset }: MapStageDefsProps): React.JSX.Element {
  return (
    <defs>
      <linearGradient id="oceanGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={preset.mapPalette.oceanTop} />
        <stop offset="38%" stopColor="#123867" />
        <stop offset="100%" stopColor={preset.mapPalette.oceanBottom} />
      </linearGradient>
      <pattern id="oceanCurrents" x="0" y="0" width="18" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
        <path d="M -2 5 C 2 1, 6 10, 10 5 S 18 1, 22 5" fill="none" stroke="rgba(206, 231, 255, 0.08)" strokeWidth="0.26" />
        <path d="M -1 10 C 3 6, 7 14, 11 10 S 19 6, 23 10" fill="none" stroke="rgba(6, 14, 30, 0.16)" strokeWidth="0.32" />
      </pattern>
      <pattern id="oceanGrain" x="0" y="0" width="1.25" height="1.25" patternUnits="userSpaceOnUse">
        <rect width="1.25" height="1.25" fill="transparent" />
        <circle cx="0.24" cy="0.3" r="0.03" fill="rgba(255,255,255,0.08)" />
        <circle cx="0.88" cy="0.52" r="0.025" fill="rgba(255,255,255,0.06)" />
        <circle cx="0.62" cy="0.98" r="0.026" fill="rgba(5,14,29,0.18)" />
      </pattern>
      <pattern id="landGrain" x="0" y="0" width="3.8" height="3.8" patternUnits="userSpaceOnUse">
        <rect width="3.8" height="3.8" fill="rgba(255,255,255,0.018)" />
        <path d="M -0.4 2.7 C 0.8 1.9, 1.8 3.2, 3.2 2.1 C 4 1.5, 4.8 1.8, 5.2 2.4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.045" />
        <path d="M 0.2 0.8 C 1.4 1.6, 2.4 0.1, 3.9 1" fill="none" stroke="rgba(2,7,16,0.1)" strokeWidth="0.05" />
        <circle cx="0.9" cy="1.2" r="0.045" fill="rgba(255,255,255,0.08)" />
        <circle cx="2.8" cy="2.9" r="0.04" fill="rgba(1,6,15,0.14)" />
      </pattern>
      <pattern id="landContours" x="0" y="0" width="9" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
        <path d="M -2 2 C 0 0.8, 2 3.1, 4 1.8 S 8 0.8, 11 2.2" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="0.08" />
        <path d="M -2 5.3 C 0 4.1, 2 6.2, 4.4 4.9 S 8.6 4.3, 11 5.4" fill="none" stroke="rgba(2,8,19,0.09)" strokeWidth="0.09" />
      </pattern>
      <linearGradient id="landLightSweep" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="48%" stopColor="#ffffff" stopOpacity="0.02" />
        <stop offset="100%" stopColor="#020711" stopOpacity="0.14" />
      </linearGradient>
      <radialGradient id="oceanBloom" cx="50%" cy="40%" r="74%">
        <stop offset="0%" stopColor="#b9d8ff" stopOpacity="0.18" />
        <stop offset="46%" stopColor="#7aa7ea" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="oceanDepth" cx="50%" cy="54%" r="78%">
        <stop offset="0%" stopColor="#98c0ff" stopOpacity="0.08" />
        <stop offset="56%" stopColor="#06162e" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#010915" stopOpacity="0.68" />
      </radialGradient>
      <radialGradient id="edgeVignette" cx="50%" cy="50%" r="72%">
        <stop offset="60%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#01040b" stopOpacity="0.56" />
      </radialGradient>
      <filter id="coastGlow">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.18" result="blurred" />
        <feColorMatrix
          in="blurred"
          type="matrix"
          values="1 0 0 0 0.35  0 1 0 0 0.47  0 0 1 0 0.78  0 0 0 0.7 0"
          result="tinted"
        />
        <feMerge>
          <feMergeNode in="tinted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="landLift">
        <feDropShadow dx="0" dy="0.08" stdDeviation="0.14" floodColor="#020814" floodOpacity="0.42" />
      </filter>
      <radialGradient id="globeShade" cx="41%" cy="34%" r="68%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
        <stop offset="54%" stopColor="#10274f" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#010915" stopOpacity="0.56" />
      </radialGradient>
      <radialGradient id="globeBackdrop" cx="50%" cy="50%" r="62%">
        <stop offset="30%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#010611" stopOpacity="0.82" />
      </radialGradient>
      <clipPath id="globeClip">
        <circle cx="50" cy="25" r={GLOBE_CLIP_RADIUS} />
      </clipPath>
    </defs>
  );
}
