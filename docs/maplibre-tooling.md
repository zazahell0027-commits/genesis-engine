# MapLibre tooling for Genesis

This page keeps the MapLibre examples and plugins that are actually useful for Genesis.
The goal is not to collect everything, only the pieces that help with labels, debug, and tiles.

## Keep now

### 1. `maplibre-gl-inspect`

Use this as the main debug tool for map features and label placement.
It is the fastest way to inspect vector sources, see which feature is on screen, and verify why a label appears twice or disappears.

- Docs: https://maplibre.org/maplibre-gl-inspect/
- Plugins page: https://maplibre.org/maplibre-gl-js/docs/plugins/

### 2. `pmtiles`

Use this if we want a clean single-file tile pipeline for basemaps or overlays.
It fits the MapLibre protocol model and is a good long-term match for a strategy map project.

- PMTiles + MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- PMTiles concepts: https://docs.protomaps.com/pmtiles/
- Plugins page: https://maplibre.org/maplibre-gl-js/docs/plugins/

### 3. `mapgrab`

Use this for screenshot-based map regression tests.
It is useful when we want to compare label placement, zoom bands, or the same scene across branches.

- Plugins page: https://maplibre.org/maplibre-gl-js/docs/plugins/

### 4. `turf`

Use this only for geometry helpers when we want to stop hand-rolling spatial math.
It is helpful for bbox, centroid, area, buffers, and other pre-processing steps.

- Plugins page: https://maplibre.org/maplibre-gl-js/docs/plugins/

## Examples worth keeping

### Labels and fonts

- Display and style rich text labels: https://maplibre.org/maplibre-gl-js/docs/examples/display-and-style-rich-text-labels/
- Style labels with local fonts: https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-local-fonts/
- Style labels with Web fonts: https://maplibre.org/maplibre-gl-js/docs/examples/style-labels-with-web-fonts/

These are the examples that matter most for Pax-like country labels.

### Interaction and polish

- Create a hover effect: https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/
- Add a pattern to a polygon: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-pattern-to-a-polygon/

These are useful for making the map feel alive without changing the label planner.

## Not priority now

I would not spend time on these until the country labels and the map HUD are clean:

- 3D terrain
- globe rendering experiments
- deck.gl overlays
- draw/edit plugins
- geocoding plugins

## Practical rule

For Genesis, the actual label placement logic stays in our planner:

- `polylabel` for the internal anchor
- dominant axis for rotation
- stable zoom bands
- collision only as a safety net

The plugins and examples above are tools around that system, not a replacement for it.
