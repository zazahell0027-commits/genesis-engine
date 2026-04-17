import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

type MaplibreInspectModule = typeof import("@maplibre/maplibre-gl-inspect");

type GlobalPmtilesState = typeof globalThis & {
  __genesisPmtilesProtocol?: Protocol;
};

const inspectMaps = new WeakSet<maplibregl.Map>();
let inspectModulePromise: Promise<MaplibreInspectModule> | null = null;

function isInspectEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_MAPLIBRE_INSPECT !== "false";
}

function getGlobalPmtilesState(): GlobalPmtilesState {
  return globalThis as GlobalPmtilesState;
}

async function loadInspectModule(): Promise<MaplibreInspectModule> {
  if (!inspectModulePromise) {
    inspectModulePromise = Promise.all([
      import("@maplibre/maplibre-gl-inspect"),
      import("@maplibre/maplibre-gl-inspect/dist/maplibre-gl-inspect.css")
    ]).then(([module]) => module);
  }

  return inspectModulePromise;
}

export function ensurePmtilesProtocol(): void {
  const state = getGlobalPmtilesState();
  if (state.__genesisPmtilesProtocol) return;

  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  state.__genesisPmtilesProtocol = protocol;
}

export function installMapLibreInspect(map: maplibregl.Map): void {
  if (!isInspectEnabled()) return;
  if (inspectMaps.has(map)) return;
  inspectMaps.add(map);

  const attachInspectControl = async (): Promise<void> => {
    try {
      const module = await loadInspectModule();
      if (!map.getContainer().isConnected) return;

      const InspectControl = module.default;
      map.addControl(new InspectControl({
        popup: new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: "genesis-map-popup genesis-map-popup-inspect"
        })
      }));
    } catch (error) {
      console.warn("MapLibre inspect control unavailable", error);
    }
  };

  if (map.isStyleLoaded()) {
    void attachInspectControl();
    return;
  }

  map.once("load", () => {
    void attachInspectControl();
  });
}
