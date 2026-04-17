/**
 * Generate curved text paths for country labels that follow the shape of the territory.
 * Inspired by grand strategy games where labels breathe and hug the terrain.
 */

import type { Feature } from "./types";

type CurvedLabelPath = {
  pathD: string;
  pathLength: number;
  textLength: number;
  startOffset: number;
  side: "up" | "down";
  dy: number;
};

/**
 * Generate an S-curve (sigmoid) path that flows through the country bbox.
 * The curve follows the longer dimension of the country.
 * Returns extended path to prevent text clipping at ends.
 */
export function generateCountryLabelPath(
  feature: Feature,
  curveIntensity: number = 0.35
): CurvedLabelPath {
  const { bbox, centroid } = feature;
  const isHorizontal = bbox.width >= bbox.height * 0.8;

  // Base dimensions
  const center = feature.labelAnchor ?? centroid;
  const centerX = center.x;
  const centerY = center.y;

  // Available space for the curve (extended to prevent clipping)
  const spanX = bbox.width * 1.05;
  const spanY = bbox.height * 0.85;

  if (isHorizontal) {
    // Horizontal flowing curve (for wide countries like Brazil, USA)
    const leftX = centerX - spanX / 2;
    const rightX = centerX + spanX / 2;
    const waveY = Math.min(spanY * curveIntensity, bbox.height * 0.22);

    // Bezier control points for gentle S-curve
    const cp1x = leftX + spanX * 0.22;
    const cp2x = rightX - spanX * 0.22;

    // Calculate approximate path length (Bezier approximation)
    const pathLength = spanX * 1.02;

    // Simple horizontal S-curve with extended endpoints
    const startY = centerY - waveY * 0.3;
    const endY = centerY + waveY * 0.3;
    const cp1y = centerY + waveY * 0.7;
    const cp2y = centerY - waveY * 0.7;

    return {
      pathD: `M ${leftX.toFixed(2)} ${startY.toFixed(2)} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${rightX.toFixed(2)} ${endY.toFixed(2)}`,
      pathLength,
      textLength: pathLength * 0.88,
      startOffset: pathLength * 0.06,
      side: "up",
      dy: -0.15, // Slightly above the path for visual centering
    };
  } else {
    // Vertical/slanted curve for tall countries (Chile, Norway)
    const topY = centerY - spanY / 2;
    const bottomY = centerY + spanY / 2;
    const waveX = Math.min(spanX * curveIntensity * 1.2, bbox.width * 0.35);

    const cp1y = topY + spanY * 0.22;
    const cp2y = bottomY - spanY * 0.22;

    const pathLength = spanY * 1.02;

    return {
      pathD: `M ${(centerX + waveX * 0.2).toFixed(2)} ${topY.toFixed(2)} C ${(centerX - waveX * 0.6).toFixed(2)} ${cp1y.toFixed(2)}, ${(centerX + waveX * 0.6).toFixed(2)} ${cp2y.toFixed(2)}, ${(centerX - waveX * 0.3).toFixed(2)} ${bottomY.toFixed(2)}`,
      pathLength,
      textLength: pathLength * 0.88,
      startOffset: pathLength * 0.06,
      side: "up",
      dy: -0.1,
    };
  }
}

/**
 * Generate a gentle arc path for compact countries or small zoom levels
 * Uses quadratic Bezier for smooth arc
 */
export function generateArcLabelPath(
  feature: Feature,
  arcHeight: number = 0.12
): CurvedLabelPath {
  const { bbox, centroid } = feature;
  const span = Math.max(bbox.width, bbox.height) * 0.92;
  const isWide = bbox.width >= bbox.height;
  const center = feature.labelAnchor ?? centroid;

  const startX = center.x - span / 2;
  const endX = center.x + span / 2;

  // Gentler arc for Pax Historia-like feel
  const arcDepth = span * arcHeight;
  const startY = center.y + (isWide ? arcDepth * 0.3 : 0);
  const endY = center.y + (isWide ? arcDepth * 0.3 : 0);
  const cpY = center.y - arcDepth;

  // Arc length approximation for quadratic Bezier
  const pathLength = span * 1.05;

  return {
    pathD: `M ${startX.toFixed(2)} ${startY.toFixed(2)} Q ${centroid.x.toFixed(2)} ${cpY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`,
    pathLength,
    textLength: span * 0.82,
    startOffset: span * 0.09,
    side: "up",
    dy: -0.12,
  };
}

/**
 * Choose the appropriate path type based on country shape and zoom context
 * Pax Historia style: gentle curves that follow territory shape
 */
export function getOptimalLabelPath(
  feature: Feature,
  labelLength: number,
  zoomBand: "far" | "global" | "regional" | "close" | "detail"
): CurvedLabelPath {
  const { bbox } = feature;
  const aspectRatio = bbox.width / Math.max(bbox.height, 0.1);
  const isCompact = bbox.width < 1.5 && bbox.height < 1.5;
  const isVerySmall = bbox.width < 0.8 || bbox.height < 0.8;

  // For very small countries, use minimal arc
  if (isVerySmall) {
    return generateArcLabelPath(feature, 0.06);
  }

  // For compact countries or short labels, use gentle arc
  if (isCompact || labelLength <= 5) {
    return generateArcLabelPath(feature, aspectRatio > 2 ? 0.06 : 0.1);
  }

  // For elongated/wide countries, use stronger S-curve
  const curveIntensity = aspectRatio > 4
    ? 0.18 // very wide (Brazil, Russia)
    : aspectRatio > 2
      ? 0.25 // moderately wide (USA, China)
      : aspectRatio < 0.5
        ? 0.35 // tall countries (Chile, Norway)
        : 0.28; // roughly square/medium

  return generateCountryLabelPath(feature, curveIntensity);
}
