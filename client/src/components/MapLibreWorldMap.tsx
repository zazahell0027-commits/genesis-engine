import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import {
  buildCountryGeometries,
  makeArtifactCollection,
  makeCitiesCollection,
  makeCountryCollection,
  makeCountryLabelCollection,
  makeEffectCollection
} from "../features/maplibre/maplibreData";
import { addOrUpdateGeoJsonSource, installMapLibreLayers } from "../features/maplibre/maplibreLayers";
import { DEFAULT_STYLE_URL, LAYERS, SOURCES, type CountryFeatureProperties, type CountryGeometry, type MapLibreWorldMapProps } from "../features/maplibre/maplibreTypes";
import type { GeoFeatureCollection } from "../features/map/types";
import type { OverlayMode } from "../features/map/MapChrome";

function mapStyleUrl(): string {
  const envValue = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;
  return envValue?.trim() || DEFAULT_STYLE_URL;
}

function fitCountries(map: maplibregl.Map, geometries: Map<string, CountryGeometry>, countryIds: string[], duration = 650): void {
  const targets = countryIds
    .map((countryId) => geometries.get(countryId) ?? null)
    .filter((item): item is CountryGeometry => Boolean(item));
  if (targets.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  for (const target of targets) {
    bounds.extend([target.bbox[0], target.bbox[1]]);
    bounds.extend([target.bbox[2], target.bbox[3]]);
  }

  map.fitBounds(bounds, {
    padding: { top: 130, right: 420, bottom: 100, left: 420 },
    maxZoom: targets.length === 1 ? 5.2 : 4.4,
    duration
  });
}

export function MapLibreWorldMap({
  countries,
  preset,
  selectedCountryId,
  mapEffects = [],
  mapArtifacts = [],
  highlightedCountryIds = [],
  focusCountryIds = [],
  focusToken,
  onSelectCountry
}: MapLibreWorldMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [countryGeometries, setCountryGeometries] = useState<Map<string, CountryGeometry>>(new Map());
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("balanced");
  const styleUrl = mapStyleUrl();

  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries]
  );
  const countryCollection = useMemo(
    () => makeCountryCollection(countries, countryGeometries, selectedCountryId, highlightedCountryIds, focusCountryIds),
    [countries, countryGeometries, focusCountryIds, highlightedCountryIds, selectedCountryId]
  );
  const labelCollection = useMemo(
    () => makeCountryLabelCollection(countries, countryGeometries),
    [countries, countryGeometries]
  );
  const cityCollection = useMemo(() => makeCitiesCollection(countriesById), [countriesById]);
  const effectCollection = useMemo(
    () => makeEffectCollection(mapEffects, countryGeometries, overlayMode),
    [countryGeometries, mapEffects, overlayMode]
  );
  const artifactCollection = useMemo(
    () => makeArtifactCollection(mapArtifacts, countryGeometries, overlayMode),
    [countryGeometries, mapArtifacts, overlayMode]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCountries(): Promise<void> {
      try {
        const baseUrl = import.meta.env.BASE_URL || "/";
        const response = await fetch(`${baseUrl}maps/world_countries_slim.json`);
        if (!response.ok) throw new Error("GeoJSON countries unavailable");
        const data = await response.json() as GeoFeatureCollection;
        if (!cancelled) setCountryGeometries(buildCountryGeometries(data));
      } catch (error) {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "Impossible de charger les pays");
      }
    }

    void loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [15, 24],
      zoom: 1.62,
      minZoom: 1.15,
      maxZoom: 8.6,
      pitch: 0,
      bearing: 0,
      renderWorldCopies: true,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => setMapReady(true));
    map.on("error", (event) => {
      setMapError(event.error?.message ?? "Erreur de chargement MapLibre");
    });

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "genesis-map-popup"
    });
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    addOrUpdateGeoJsonSource(map, SOURCES.countries, countryCollection as FeatureCollection<Geometry, object>);
    addOrUpdateGeoJsonSource(map, SOURCES.countryLabels, labelCollection as FeatureCollection<Geometry, object>);
    addOrUpdateGeoJsonSource(map, SOURCES.cities, cityCollection as FeatureCollection<Geometry, object>, {
      cluster: true,
      clusterMaxZoom: 4,
      clusterRadius: 42
    });
    addOrUpdateGeoJsonSource(map, SOURCES.effects, effectCollection as FeatureCollection<Geometry, object>, {
      cluster: true,
      clusterMaxZoom: 3,
      clusterRadius: 52
    });
    addOrUpdateGeoJsonSource(map, SOURCES.artifacts, artifactCollection as FeatureCollection<Geometry, object>, {
      cluster: true,
      clusterMaxZoom: 3,
      clusterRadius: 46
    });
    installMapLibreLayers(map);
  }, [artifactCollection, cityCollection, countryCollection, effectCollection, labelCollection, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(LAYERS.countryFill)) return;

    const onMouseMove = (event: maplibregl.MapLayerMouseEvent): void => {
      map.getCanvas().style.cursor = "pointer";
      const properties = event.features?.[0]?.properties as Partial<CountryFeatureProperties> | undefined;
      if (!properties?.countryId) return;
      const country = countriesById.get(properties.countryId);
      if (!country) return;

      popupRef.current
        ?.setLngLat(event.lngLat)
        .setHTML(`
          <strong>${country.name}</strong>
          <span>${country.descriptor}</span>
          <small>Puissance ${country.power} | Stabilite ${country.stability} | Tension ${country.tension}</small>
        `)
        .addTo(map);
    };

    const onMouseLeave = (): void => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };

    const onClick = (event: maplibregl.MapLayerMouseEvent): void => {
      const properties = event.features?.[0]?.properties as Partial<CountryFeatureProperties> | undefined;
      if (properties?.countryId) onSelectCountry(properties.countryId);
    };

    map.on("mousemove", LAYERS.countryFill, onMouseMove);
    map.on("mouseleave", LAYERS.countryFill, onMouseLeave);
    map.on("click", LAYERS.countryFill, onClick);

    return () => {
      map.off("mousemove", LAYERS.countryFill, onMouseMove);
      map.off("mouseleave", LAYERS.countryFill, onMouseLeave);
      map.off("click", LAYERS.countryFill, onClick);
    };
  }, [countriesById, mapReady, onSelectCountry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || focusCountryIds.length === 0) return;
    fitCountries(map, countryGeometries, focusCountryIds);
  }, [countryGeometries, focusCountryIds, focusToken, mapReady]);

  function recenterWorld(): void {
    mapRef.current?.easeTo({ center: [15, 24], zoom: 1.62, pitch: 0, bearing: 0, duration: 650 });
  }

  function focusEurope(): void {
    mapRef.current?.fitBounds([[-12, 34], [45, 72]], {
      padding: { top: 120, right: 120, bottom: 100, left: 120 },
      duration: 650
    });
  }

  function focusSelected(): void {
    const map = mapRef.current;
    if (!map || !selectedCountryId) return;
    fitCountries(map, countryGeometries, [selectedCountryId]);
  }

  function setPitch(enabled: boolean): void {
    mapRef.current?.easeTo({
      pitch: enabled ? 50 : 0,
      bearing: enabled ? -18 : 0,
      duration: 560
    });
  }

  return (
    <div className="world-map-shell maplibre-world-shell">
      <div className="world-map-tools maplibre-map-tools">
        <div className="map-mode-row">
          {([
            ["balanced", "Equilibre"],
            ["tension", "Crises"],
            ["army", "Troupes"],
            ["fortification", "Forts"],
            ["industry", "Industrie"]
          ] as Array<[OverlayMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`map-tool-button mode-button${overlayMode === mode ? " is-active" : ""}`}
              onClick={() => setOverlayMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="map-tool-row">
          <button type="button" className="map-tool-button" onClick={recenterWorld}>Monde</button>
          <button type="button" className="map-tool-button" onClick={focusEurope}>Europe</button>
          <button type="button" className="map-tool-button" onClick={focusSelected} disabled={!selectedCountryId}>Focus</button>
          <button type="button" className="map-tool-button" onClick={() => setPitch(true)}>Relief</button>
          <button type="button" className="map-tool-button" onClick={() => setPitch(false)}>Flat</button>
        </div>
      </div>

      <div className="world-map-legend maplibre-map-legend">
        <span className="legend-item legend-mode">{`MapLibre: ${preset.title}`}</span>
        <span className="legend-item"><i className="legend-dot kind-army" /> Troupes</span>
        <span className="legend-item"><i className="legend-dot kind-fortification" /> Forts</span>
        <span className="legend-item"><i className="legend-dot kind-industry" /> Industrie</span>
        <span className="legend-item"><i className="legend-dot kind-crisis" /> Crise</span>
      </div>

      <div ref={containerRef} className="maplibre-world-map" />

      {!mapReady && !mapError && (
        <div className="maplibre-loading-card">
          <strong>Chargement de la carte...</strong>
          <span>Fond OpenFreeMap, pays, villes et couches gameplay.</span>
        </div>
      )}

      {mapError && (
        <div className="maplibre-loading-card is-error">
          <strong>Carte indisponible</strong>
          <span>{mapError}</span>
          <small>Configurez une autre source via VITE_MAP_STYLE_URL si besoin.</small>
        </div>
      )}
    </div>
  );
}
