import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

const lodSpecPath = path.join(clientRoot, "src", "features", "map", "map-lod-spec.json");
const visualTargetsPath = path.join(clientRoot, "src", "features", "map", "map-visual-targets.json");
const snapshotPath = path.join(clientRoot, "snapshots", "map-pipeline.snapshot.json");

const shouldUpdate = process.argv.includes("--update");

const lodSpec = readJson(lodSpecPath);
const visualTargets = readJson(visualTargetsPath);

const snapshotPayload = buildSnapshotPayload(lodSpec, visualTargets);
const nextSnapshotText = `${JSON.stringify(snapshotPayload, null, 2)}\n`;

if (shouldUpdate) {
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, nextSnapshotText, "utf8");
  console.log(`[map-snapshot] Updated ${relativeToClient(snapshotPath)}`);
  process.exit(0);
}

if (!fs.existsSync(snapshotPath)) {
  console.error(`[map-snapshot] Missing ${relativeToClient(snapshotPath)}.`);
  console.error("[map-snapshot] Run `npm run map:snapshot` to create it.");
  process.exit(1);
}

const currentSnapshotText = fs.readFileSync(snapshotPath, "utf8");
if (currentSnapshotText !== nextSnapshotText) {
  const nextPath = `${snapshotPath}.new`;
  fs.writeFileSync(nextPath, nextSnapshotText, "utf8");
  console.error("[map-snapshot] Snapshot mismatch detected.");
  console.error(`[map-snapshot] Current hash: ${shortHash(currentSnapshotText)}`);
  console.error(`[map-snapshot] Next hash:    ${shortHash(nextSnapshotText)}`);
  console.error(`[map-snapshot] Proposed snapshot written to ${relativeToClient(nextPath)}.`);
  console.error("[map-snapshot] If changes are intentional, run `npm run map:snapshot`.");
  process.exit(1);
}

console.log("[map-snapshot] Snapshot is up to date.");

function readJson(filePath) {
  const file = fs.readFileSync(filePath, "utf8");
  return JSON.parse(file);
}

function relativeToClient(filePath) {
  return path.relative(clientRoot, filePath).replace(/\\/g, "/");
}

function shortHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deriveZoomBand(width, thresholds) {
  if (width >= thresholds.farMinWidth) return "far";
  if (width >= thresholds.globalMinWidth) return "global";
  if (width >= thresholds.regionalMinWidth) return "regional";
  if (width >= thresholds.closeMinWidth) return "close";
  return "detail";
}

function computePolicy(spec, context) {
  const band = spec.bands[context.zoomBand];
  const selected = Boolean(context.selectedCountryId);
  const closeRules = spec.closeDetailRules;

  const showCountryLabels = context.showCountryLabels
    && band.showCountryLabels
    && (context.zoomBand !== "close" || !closeRules.countryLabelsRequireSelection || selected);

  const showRegionLabels = context.showMapElements
    && context.showRegionLabels
    && band.showRegionLabels
    && (!closeRules.regionLabelsRequireSelection || selected || context.showInvisible)
    && (
      context.zoomBand === "detail"
      || context.viewWidth <= closeRules.regionLabelsCloseMaxWidth
    );

  const showProvinceLayer = context.showMapElements && band.showProvinceLayer;
  const showFrontlineLayer = context.showMapElements && band.showFrontlineLayer;
  const showEffectsLayer = context.showMapElements && context.showRegionMarkers && band.showEffectsLayer;
  const showEffectsLayerResolved = showEffectsLayer && (
    context.zoomBand !== "detail"
    || !closeRules.effectsDetailRequireSelection
    || selected
    || context.showInvisible
  );
  const showArtifactsLayer = context.showMapElements && context.showRegionMarkers && band.showArtifactsLayer;
  const showArtifactsLayerResolved = showArtifactsLayer && (
    context.zoomBand !== "detail"
    || !closeRules.artifactsDetailRequireSelection
    || selected
    || context.showInvisible
  );
  const showCitiesLayer = context.showMapElements
    && context.showRegionMarkers
    && band.showCitiesLayer
    && (
      (
        context.zoomBand !== "close"
        || !closeRules.citiesCloseRequireSelection
        || selected
      )
      && (
        context.zoomBand !== "detail"
        || !closeRules.citiesDetailRequireSelection
        || selected
        || context.showInvisible
      )
    );

  const countryLabelZoomFactor = clamp(
    band.countryLabelZoomFactorBase / Math.max(8, context.viewWidth),
    band.countryLabelZoomFactorMin,
    band.countryLabelZoomFactorMax
  );

  const maxDensityFactor = context.showInvisible ? 1.55 : 1;
  const markerVisibilityFactor = context.showInvisible ? 1.4 : 1;
  const markerDistanceFactor = context.showInvisible ? 0.7 : 1;

  return {
    showCountryLabels,
    showRegionLabels,
    showProvinceLayer,
    showFrontlineLayer,
    showEffectsLayer: showEffectsLayerResolved,
    showArtifactsLayer: showArtifactsLayerResolved,
    showCitiesLayer,
    labelDensityLimit: Math.round(band.labelDensityLimit * maxDensityFactor),
    labelMinWidth: band.labelMinWidth,
    labelMinHeight: band.labelMinHeight,
    countryLabelZoomFactor: round3(countryLabelZoomFactor),
    effectMinDistance: round3(band.effectMinDistance * markerDistanceFactor),
    effectMaxCount: Math.round(band.effectMaxCount * markerVisibilityFactor),
    artifactMinDistance: round3(band.artifactMinDistance * markerDistanceFactor),
    artifactMaxCount: Math.round(band.artifactMaxCount * markerVisibilityFactor),
    cityMinDistance: round3(band.cityMinDistance * markerDistanceFactor),
    cityMaxCount: Math.round(band.cityMaxCount * markerVisibilityFactor)
  };
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function buildSnapshotPayload(spec, visual) {
  const contexts = [
    {
      id: "default-unselected",
      selectedCountryId: null,
      showInvisible: false,
      showMapElements: true,
      showRegionMarkers: true,
      showRegionLabels: true,
      showCountryLabels: true
    },
    {
      id: "default-selected",
      selectedCountryId: "france",
      showInvisible: false,
      showMapElements: true,
      showRegionMarkers: true,
      showRegionLabels: true,
      showCountryLabels: true
    },
    {
      id: "invisible-selected",
      selectedCountryId: "france",
      showInvisible: true,
      showMapElements: true,
      showRegionMarkers: true,
      showRegionLabels: true,
      showCountryLabels: true
    }
  ];

  return {
    schemaVersion: 1,
    lodSpecVersion: spec.version,
    visualTargetsVersion: visual.version,
    thresholds: spec.thresholds,
    closeDetailRules: spec.closeDetailRules,
    targets: visual.targets.map((target) => {
      const zoomBand = deriveZoomBand(target.cameraWidth, spec.thresholds);
      return {
        id: target.id,
        label: target.label,
        cameraWidth: target.cameraWidth,
        zoomBand,
        expectations: target.expectations,
        contexts: contexts.map((context) => ({
          id: context.id,
          policy: computePolicy(spec, {
            ...context,
            zoomBand,
            viewWidth: target.cameraWidth
          })
        }))
      };
    })
  };
}
