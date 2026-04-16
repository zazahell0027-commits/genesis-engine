import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import { LAYERS, SOURCES } from "./maplibreTypes";

function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

function firstCountryLabelLayerId(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.id.startsWith("label_country_"))?.id;
}

function hideNativeCountryLabels(map: maplibregl.Map): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (!layer.id.startsWith("label_country_")) continue;
    if (!map.getLayer(layer.id)) continue;
    map.setLayoutProperty(layer.id, "visibility", "none");
  }
}

function ensureLayer(map: maplibregl.Map, layer: maplibregl.AddLayerObject, beforeId?: string): void {
  if (map.getLayer(layer.id)) return;
  map.addLayer(layer, beforeId);
}

export function addOrUpdateGeoJsonSource(
  map: maplibregl.Map,
  id: string,
  data: FeatureCollection<Geometry, object>,
  options?: Omit<maplibregl.GeoJSONSourceSpecification, "type" | "data">
): void {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(id, {
    type: "geojson",
    data,
    ...options
  });
}

export function installMapLibreLayers(map: maplibregl.Map): void {
  const beforeSymbols = firstSymbolLayerId(map);
  const beforeCountryLabels = firstCountryLabelLayerId(map) ?? beforeSymbols;
  hideNativeCountryLabels(map);

  ensureLayer(map, {
    id: LAYERS.countryFill,
    type: "fill",
    source: SOURCES.countries,
    paint: {
      "fill-color": ["get", "fillColor"],
      "fill-opacity": [
        "case",
        ["boolean", ["get", "selected"], false], 0.72,
        ["boolean", ["get", "highlighted"], false], 0.66,
        ["boolean", ["get", "discovered"], false], 0.5,
        0.16
      ]
    }
  }, beforeSymbols);

  ensureLayer(map, {
    id: LAYERS.countryBorder,
    type: "line",
    source: SOURCES.countries,
    paint: {
      "line-color": "#07101d",
      "line-opacity": 0.82,
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.45, 3, 0.85, 5, 1.25, 8, 1.85]
    }
  }, beforeSymbols);

  ensureLayer(map, {
    id: LAYERS.countryHighlight,
    type: "line",
    source: SOURCES.countries,
    filter: ["any", ["==", ["get", "highlighted"], true], ["==", ["get", "focused"], true]],
    paint: {
      "line-color": "#dceaff",
      "line-opacity": 0.9,
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 4, 1.8, 7, 2.6],
      "line-blur": 0.4
    }
  });

  ensureLayer(map, {
    id: LAYERS.countrySelected,
    type: "line",
    source: SOURCES.countries,
    filter: ["==", ["get", "selected"], true],
    paint: {
      "line-color": "#fff3ba",
      "line-opacity": 0.98,
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 4, 2.5, 7, 3.8],
      "line-blur": 0.3
    }
  });

  ensureLayer(map, {
    id: LAYERS.countryLabels,
    type: "symbol",
    source: SOURCES.countryLabels,
    minzoom: 1.2,
    maxzoom: 8.25,
    filter: ["==", ["get", "discovered"], true],
    layout: {
      "symbol-placement": "line-center",
      "symbol-sort-key": ["get", "labelRank"],
      "text-field": ["get", "name"],
      "text-size": ["get", "labelSize"],
      "text-letter-spacing": 0.09,
      "text-max-angle": 10,
      "text-max-width": 48,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-optional": true,
      "text-keep-upright": true,
      "text-padding": 3
    },
    paint: {
      "text-color": "rgba(242, 247, 255, 0.94)",
      "text-halo-color": "rgba(1, 7, 16, 0.78)",
      "text-halo-width": 2.1,
      "text-halo-blur": 0.8,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 1.2, 0.9, 6.9, 0.82, 8.15, 0.04]
    }
  }, beforeCountryLabels);

  ensureLayer(map, {
    id: LAYERS.cityDots,
    type: "circle",
    source: SOURCES.cities,
    minzoom: 3.1,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3.1, 2.1, 5.2, 3.2, 8.4, 4.8],
      "circle-color": ["get", "color"],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3.1, 0.55, 5.2, 0.86],
      "circle-stroke-color": "#081222",
      "circle-stroke-width": 1.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.cityClusters,
    type: "circle",
    source: SOURCES.cities,
    minzoom: 3.1,
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 10, 8, 15, 20, 20],
      "circle-color": "rgba(232, 239, 255, 0.72)",
      "circle-stroke-color": "#081222",
      "circle-stroke-width": 1.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.cityClusterLabels,
    type: "symbol",
    source: SOURCES.cities,
    minzoom: 3.1,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11
    },
    paint: {
      "text-color": "#07101d",
      "text-halo-color": "rgba(255,255,255,0.38)",
      "text-halo-width": 0.8
    }
  });

  ensureLayer(map, {
    id: LAYERS.cityLabels,
    type: "symbol",
    source: SOURCES.cities,
    minzoom: 4.1,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "symbol-sort-key": ["get", "sort"],
      "text-field": ["get", "label"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.1, ["get", "labelSize"], 8.3, 15],
      "text-offset": [0.7, 0.35],
      "text-anchor": "left",
      "text-allow-overlap": false,
      "text-optional": true
    },
    paint: {
      "text-color": "#edf3ff",
      "text-halo-color": "#081222",
      "text-halo-width": 1.7,
      "text-halo-blur": 0.25,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 4.1, 0.62, 5.6, 0.94]
    }
  });

  ensureLayer(map, {
    id: LAYERS.effectDots,
    type: "circle",
    source: SOURCES.effects,
    minzoom: 2.4,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2.4, 4, 5.6, 7.8, 8.4, 11],
      "circle-color": ["get", "color"],
      "circle-opacity": 0.82,
      "circle-stroke-color": "#f7fbff",
      "circle-stroke-width": 1.35,
      "circle-blur": 0.05
    }
  });

  ensureLayer(map, {
    id: LAYERS.effectClusters,
    type: "circle",
    source: SOURCES.effects,
    minzoom: 2.4,
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 12, 8, 17, 20, 23],
      "circle-color": "rgba(255, 139, 61, 0.74)",
      "circle-stroke-color": "#f7fbff",
      "circle-stroke-width": 1.3
    }
  });

  ensureLayer(map, {
    id: LAYERS.effectClusterLabels,
    type: "symbol",
    source: SOURCES.effects,
    minzoom: 2.4,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11
    },
    paint: {
      "text-color": "#fff7ed",
      "text-halo-color": "#07101d",
      "text-halo-width": 1.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.effectLabels,
    type: "symbol",
    source: SOURCES.effects,
    minzoom: 4.5,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-optional": true
    },
    paint: {
      "text-color": "#f6f8ff",
      "text-halo-color": "#07101d",
      "text-halo-width": 1.6,
      "text-opacity": 0.86
    }
  });

  ensureLayer(map, {
    id: LAYERS.artifactDots,
    type: "symbol",
    source: SOURCES.artifacts,
    minzoom: 3.1,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "symbol"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3.1, 14, 6.2, 19],
      "text-allow-overlap": false,
      "text-optional": true
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-color": "#06101f",
      "text-halo-width": 2.1,
      "text-halo-blur": 0.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.artifactClusters,
    type: "circle",
    source: SOURCES.artifacts,
    minzoom: 3.1,
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 11, 8, 16, 20, 21],
      "circle-color": "rgba(167, 139, 250, 0.74)",
      "circle-stroke-color": "#f7fbff",
      "circle-stroke-width": 1.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.artifactClusterLabels,
    type: "symbol",
    source: SOURCES.artifacts,
    minzoom: 3.1,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 11
    },
    paint: {
      "text-color": "#f8f7ff",
      "text-halo-color": "#07101d",
      "text-halo-width": 1.2
    }
  });

  ensureLayer(map, {
    id: LAYERS.artifactLabels,
    type: "symbol",
    source: SOURCES.artifacts,
    minzoom: 5.3,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-offset": [0, 1.3],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-optional": true
    },
    paint: {
      "text-color": "#f8fbff",
      "text-halo-color": "#06101f",
      "text-halo-width": 1.6,
      "text-opacity": 0.86
    }
  });
}
