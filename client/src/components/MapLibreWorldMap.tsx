import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import {
  buildCountryGeometries,
  makeArtifactCollection,
  makeCitiesCollection,
  makeCountryCollection,
  makeCountryLabelCollection,
  makeEffectCollection,
  getZoomBandFromMapLibreZoom
} from "../features/maplibre/maplibreData";
import { addOrUpdateGeoJsonSource, installMapLibreLayers } from "../features/maplibre/maplibreLayers";
import { ensurePmtilesProtocol, installMapLibreInspect } from "../features/maplibre/maplibrePlugins";
import {
  DEFAULT_STYLE_URL,
  LAYERS,
  SOURCES,
  type CountryFeatureProperties,
  type CountryGeometry,
  type MapViewport,
  type MapLibreWorldMapProps,
  type MapViewMode
} from "../features/maplibre/maplibreTypes";
import type { GeoFeatureCollection } from "../features/map/types";
import type { OverlayMode } from "../features/map/MapChrome";
import { translateCountryDescriptor, translateCountryName, translateSpatialBriefingLabel } from "../i18n";

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

function defaultViewModeFromProgress(knowledgeTier: string, orbitUnlocked: boolean, moonUnlocked: boolean): MapViewMode {
  if (moonUnlocked) return "lune";
  if (orbitUnlocked) return "orbite";
  if (knowledgeTier === "limited") return "terre";
  return "globe";
}

function readMapViewport(map: maplibregl.Map): MapViewport {
  const canvas = map.getCanvas();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth || Math.round(canvas.width / pixelRatio) || 1);
  const height = Math.max(1, canvas.clientHeight || Math.round(canvas.height / pixelRatio) || 1);
  const bounds = map.getBounds();

  return {
    zoom: map.getZoom(),
    width,
    height,
    center: [map.getCenter().lng, map.getCenter().lat],
    bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    pixelRatio
  };
}

function sameViewport(left: MapViewport | null, right: MapViewport): boolean {
  if (!left) return false;
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;

  return (
    close(left.zoom, right.zoom)
    && close(left.width, right.width)
    && close(left.height, right.height)
    && close(left.center[0], right.center[0])
    && close(left.center[1], right.center[1])
    && close(left.bounds[0], right.bounds[0])
    && close(left.bounds[1], right.bounds[1])
    && close(left.bounds[2], right.bounds[2])
    && close(left.bounds[3], right.bounds[3])
    && close(left.bearing, right.bearing)
    && close(left.pitch, right.pitch)
    && close(left.pixelRatio, right.pixelRatio)
  );
}

export function MapLibreWorldMap({
  countries,
  preset,
  playerCountryId,
  playerCountryName,
  briefingMomentTitle,
  briefingMomentText,
  briefingSummary,
  uiLocale = "fr",
  selectedCountryId,
  mapEffects = [],
  mapArtifacts = [],
  spatialProgress,
  highlightedCountryIds = [],
  focusCountryIds = [],
  focusToken,
  onSelectCountry,
  onRequestContextMenu
}: MapLibreWorldMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupDelayRef = useRef<number | null>(null);
  const popupHideRef = useRef<number | null>(null);
  const viewportSyncFrameRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [countryGeometries, setCountryGeometries] = useState<Map<string, CountryGeometry>>(new Map());
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("balanced");
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [mapZoom, setMapZoom] = useState(spatialProgress.minZoom + 0.15);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>(() => defaultViewModeFromProgress(
    spatialProgress.knowledgeTier,
    spatialProgress.orbitUnlocked,
    spatialProgress.moonUnlocked
  ));
  const styleUrl = mapStyleUrl();

  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries]
  );
  const knownCountrySet = useMemo(() => new Set(spatialProgress.knownCountryIds), [spatialProgress.knownCountryIds]);
  const labelZoomBand = getZoomBandFromMapLibreZoom(mapZoom);
  const countryCollection = useMemo(
    () => makeCountryCollection(countries, countryGeometries, selectedCountryId, knownCountrySet, highlightedCountryIds, focusCountryIds, uiLocale),
    [countries, countryGeometries, focusCountryIds, highlightedCountryIds, knownCountrySet, selectedCountryId, uiLocale]
  );
  const labelCollection = useMemo(
    () => {
      if (!mapViewport) {
        return { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry, CountryFeatureProperties>;
      }

      return makeCountryLabelCollection(
        countries,
        countryGeometries,
        knownCountrySet,
        uiLocale,
        labelZoomBand,
        mapViewport,
        {
          selectedCountryId,
          highlightedCountryIds,
          focusCountryIds
        }
      );
    },
    [countries, countryGeometries, focusCountryIds, highlightedCountryIds, labelZoomBand, knownCountrySet, mapViewport, selectedCountryId, uiLocale]
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
  const activeCountry = selectedCountryId ? countriesById.get(selectedCountryId) ?? null : null;
  const countryCount = Math.max(1, countries.length);
  const worldStability = countries.length > 0
    ? Math.round(countries.reduce((sum, country) => sum + country.stability, 0) / countries.length)
    : 0;
  const worldTension = countries.length > 0
    ? Math.round(countries.reduce((sum, country) => sum + country.tension, 0) / countries.length)
    : 0;
  const briefingCountryId = playerCountryId || activeCountry?.id || null;
  const briefingCountryForRanks = briefingCountryId ? countriesById.get(briefingCountryId) ?? null : null;
  const economyRank = briefingCountryForRanks
    ? [...countries].sort((a, b) => b.wealth - a.wealth).findIndex((country) => country.id === briefingCountryForRanks.id) + 1
    : 0;
  const powerRank = briefingCountryForRanks
    ? [...countries].sort((a, b) => b.power - a.power).findIndex((country) => country.id === briefingCountryForRanks.id) + 1
    : 0;
  const stabilityRank = briefingCountryForRanks
    ? [...countries].sort((a, b) => b.stability - a.stability).findIndex((country) => country.id === briefingCountryForRanks.id) + 1
    : 0;
  const pressureRank = briefingCountryForRanks
    ? [...countries].sort((a, b) => b.tension - a.tension).findIndex((country) => country.id === briefingCountryForRanks.id) + 1
    : 0;
  const rankSpan = Math.max(1, countryCount - 1);
  const economyStrength = economyRank > 0 ? 1 - ((economyRank - 1) / rankSpan) : 0.45;
  const powerStrength = powerRank > 0 ? 1 - ((powerRank - 1) / rankSpan) : 0.45;
  const stabilityStrength = stabilityRank > 0 ? 1 - ((stabilityRank - 1) / rankSpan) : 0.45;
  const tensionStrength = pressureRank > 0 ? (pressureRank - 1) / rankSpan : 0.4;
  const playerCountry = briefingCountryForRanks ?? activeCountry ?? null;
  const briefingCountry = playerCountry ?? activeCountry;
  const worldBriefingTitle = briefingCountry ? translateCountryName(briefingCountry.name, uiLocale) : (playerCountryName ?? preset.title);
  const briefingDescriptor = translateCountryDescriptor(briefingCountry?.descriptor ?? "Lecture strategique", uiLocale);
  const briefingStageLabel = translateSpatialBriefingLabel(spatialProgress.knowledgeTier, uiLocale);
  const mapProjection = viewMode === "terre" ? "mercator" : "globe";
  const viewButtons: Array<{
    mode: MapViewMode;
    label: string;
    caption: string;
    locked?: boolean;
  }> = [
    { mode: "terre", label: "Terre", caption: "Planisphère" },
    { mode: "globe", label: "Globe", caption: "Lecture globale" },
    { mode: "orbite", label: "Orbite", caption: "Transition spatiale", locked: !spatialProgress.orbitUnlocked },
    { mode: "lune", label: "Lune", caption: "Théâtre lunaire", locked: !spatialProgress.moonUnlocked }
  ];

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

    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [15, 24],
      zoom: Math.max(1.3, spatialProgress.minZoom + 0.15),
      minZoom: spatialProgress.minZoom,
      maxZoom: 8.6,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      renderWorldCopies: false,
      attributionControl: false
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
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
    installMapLibreInspect(map);

    const syncViewport = (): void => {
      const next = readMapViewport(map);
      setMapZoom((current) => (Math.abs(current - next.zoom) < 0.01 ? current : next.zoom));
      setMapViewport((current) => (sameViewport(current, next) ? current : next));
    };

    const scheduleViewportSync = (): void => {
      if (viewportSyncFrameRef.current !== null) return;
      viewportSyncFrameRef.current = window.requestAnimationFrame(() => {
        viewportSyncFrameRef.current = null;
        syncViewport();
      });
    };

    const handleLoad = (): void => {
      setMapReady(true);
      syncViewport();
    };

    map.on("load", handleLoad);
    map.on("move", scheduleViewportSync);
    map.on("zoom", scheduleViewportSync);
    map.on("rotate", scheduleViewportSync);
    map.on("pitch", scheduleViewportSync);
    map.on("resize", syncViewport);
    map.on("moveend", syncViewport);
    syncViewport();

    return () => {
      map.off("load", handleLoad);
      map.off("move", scheduleViewportSync);
      map.off("zoom", scheduleViewportSync);
      map.off("rotate", scheduleViewportSync);
      map.off("pitch", scheduleViewportSync);
      map.off("resize", syncViewport);
      map.off("moveend", syncViewport);
      if (viewportSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportSyncFrameRef.current);
        viewportSyncFrameRef.current = null;
      }
      if (popupDelayRef.current !== null) {
        window.clearTimeout(popupDelayRef.current);
        popupDelayRef.current = null;
      }
      if (popupHideRef.current !== null) {
        window.clearTimeout(popupHideRef.current);
        popupHideRef.current = null;
      }
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
    if (!map || !mapReady) return;

    map.setMinZoom(spatialProgress.minZoom);
    map.setProjection({ type: mapProjection as "mercator" | "globe" });

    if (map.getZoom() < spatialProgress.minZoom) {
      map.easeTo({
        zoom: spatialProgress.minZoom,
        duration: 420
      });
    }
  }, [mapProjection, mapReady, spatialProgress.minZoom]);

  useEffect(() => {
    if (!mapReady) return;
    applyViewMode(viewMode);
  }, [mapReady, spatialProgress.minZoom, viewMode]);

  useEffect(() => {
    setViewMode((current) => {
      if (current === "lune" && !spatialProgress.moonUnlocked) {
        return defaultViewModeFromProgress(spatialProgress.knowledgeTier, spatialProgress.orbitUnlocked, spatialProgress.moonUnlocked);
      }

      if (current === "orbite" && !spatialProgress.orbitUnlocked) {
        return defaultViewModeFromProgress(spatialProgress.knowledgeTier, spatialProgress.orbitUnlocked, spatialProgress.moonUnlocked);
      }

      return current;
    });
  }, [spatialProgress.knowledgeTier, spatialProgress.moonUnlocked, spatialProgress.orbitUnlocked]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(LAYERS.countryFill)) return;

    const onMouseMove = (event: maplibregl.MapLayerMouseEvent): void => {
      map.getCanvas().style.cursor = "pointer";
      const properties = event.features?.[0]?.properties as Partial<CountryFeatureProperties> | undefined;
      if (!properties?.countryId) return;
      const country = countriesById.get(properties.countryId);
      if (!country) return;

      if (popupDelayRef.current !== null) {
        window.clearTimeout(popupDelayRef.current);
      }
      popupDelayRef.current = window.setTimeout(() => {
        popupDelayRef.current = null;
        const discovered = knownCountrySet.has(country.id);
        const popupTitle = discovered
          ? country.name
          : uiLocale === "fr"
            ? "Territoire partiellement cartographie"
            : "Partially mapped territory";
        const popupDetail = discovered
          ? translateCountryDescriptor(country.descriptor, uiLocale)
          : uiLocale === "fr"
            ? "Les donnees sont incompletes a cette echelle."
            : "The data is incomplete at this scale.";
        const popupHint = discovered
          ? uiLocale === "fr"
            ? `Puissance ${country.power} \u2022 Stabilite ${country.stability} \u2022 Tension ${country.tension}`
            : `Power ${country.power} \u2022 Stability ${country.stability} \u2022 Tension ${country.tension}`
          : uiLocale === "fr"
            ? "Cliquez pour approfondir la lecture."
            : "Click to zoom into the reading.";
        popupRef.current
          ?.setLngLat(event.lngLat)
          .setHTML(`
            <strong>${popupTitle}</strong>
            <span>${popupDetail}</span>
            <small>${popupHint}</small>
          `)
          .addTo(map);
        if (popupHideRef.current !== null) {
          window.clearTimeout(popupHideRef.current);
        }
        popupHideRef.current = window.setTimeout(() => {
          popupHideRef.current = null;
          popupRef.current?.remove();
        }, 2200);
      }, 220);
    };

    const onMouseLeave = (): void => {
      map.getCanvas().style.cursor = "";
      if (popupDelayRef.current !== null) {
        window.clearTimeout(popupDelayRef.current);
        popupDelayRef.current = null;
      }
      if (popupHideRef.current !== null) {
        window.clearTimeout(popupHideRef.current);
        popupHideRef.current = null;
      }
      popupRef.current?.remove();
    };

    const onClick = (event: maplibregl.MapLayerMouseEvent): void => {
      const properties = event.features?.[0]?.properties as Partial<CountryFeatureProperties> | undefined;
      if (properties?.countryId) onSelectCountry(properties.countryId);
    };

    const onContextMenu = (event: maplibregl.MapMouseEvent): void => {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
      const features = map.queryRenderedFeatures(event.point, { layers: [LAYERS.countryFill] });
      const properties = features[0]?.properties as Partial<CountryFeatureProperties> | undefined;
      const countryId = properties?.countryId ?? null;
      const countryName = properties?.name ?? null;
      const hasWaterFeature = !countryId && map.queryRenderedFeatures(event.point).some((feature) => {
        const layerId = feature.layer?.id?.toLowerCase() ?? "";
        const sourceLayer = (feature as { sourceLayer?: string }).sourceLayer?.toLowerCase() ?? "";
        const featureClass = typeof feature.properties?.class === "string" ? feature.properties.class.toLowerCase() : "";
        const featureType = typeof feature.properties?.type === "string" ? feature.properties.type.toLowerCase() : "";
        return (
          layerId.includes("water")
          || sourceLayer.includes("water")
          || featureClass.includes("water")
          || featureClass.includes("ocean")
          || featureType.includes("water")
          || featureType.includes("ocean")
        );
      });
      const isVoidSurface = !countryId && !hasWaterFeature && (viewMode === "terre" || viewMode === "globe");
      const surfaceKind = countryId
        ? "country"
        : viewMode === "lune"
          ? "lunar"
          : viewMode === "orbite"
            ? "orbital"
            : isVoidSurface
              ? "void"
              : "ocean";
      const surfaceLabel = countryId
        ? countryName ?? (uiLocale === "fr" ? "Zone terrestre" : "Land zone")
        : viewMode === "lune"
          ? uiLocale === "fr"
            ? "Surface lunaire"
            : "Lunar surface"
          : viewMode === "orbite"
            ? uiLocale === "fr"
              ? "Espace orbital"
              : "Orbital space"
            : isVoidSurface
              ? uiLocale === "fr"
                ? "Vide cartographique"
                : "Map void"
              : uiLocale === "fr"
                ? "Zone maritime"
                : "Maritime zone";
      onRequestContextMenu?.({
        countryId,
        countryName,
        surfaceKind,
        surfaceLabel,
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        viewMode,
        clientX: event.originalEvent.clientX,
        clientY: event.originalEvent.clientY
      });
    };

    map.on("mousemove", LAYERS.countryFill, onMouseMove);
    map.on("mouseleave", LAYERS.countryFill, onMouseLeave);
    map.on("click", LAYERS.countryFill, onClick);
    map.on("contextmenu", onContextMenu);

    return () => {
      map.off("mousemove", LAYERS.countryFill, onMouseMove);
      map.off("mouseleave", LAYERS.countryFill, onMouseLeave);
      map.off("click", LAYERS.countryFill, onClick);
      map.off("contextmenu", onContextMenu);
    };
  }, [activeCountry?.name, countriesById, knownCountrySet, mapReady, onRequestContextMenu, onSelectCountry, selectedCountryId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || focusCountryIds.length === 0) return;
    fitCountries(map, countryGeometries, focusCountryIds);
  }, [countryGeometries, focusCountryIds, focusToken, mapReady]);

  function applyViewMode(nextMode: MapViewMode): void {
    const map = mapRef.current;
    if (!map) return;

    setViewMode(nextMode);

    const pitch = nextMode === "terre" ? 0 : nextMode === "globe" ? 18 : nextMode === "orbite" ? 42 : 58;
    const zoom = nextMode === "terre"
      ? Math.max(1.2, spatialProgress.minZoom + 0.1)
      : nextMode === "globe"
        ? spatialProgress.minZoom + 0.2
        : nextMode === "orbite"
          ? spatialProgress.minZoom + 0.55
          : spatialProgress.minZoom + 0.82;

    map.setProjection({ type: nextMode === "terre" ? "mercator" : "globe" });
    map.easeTo({
      center: [15, 24],
      zoom,
      pitch,
      bearing: 0,
      duration: 680
    });
  }

  function recenterWorld(): void {
    const defaultMode = defaultViewModeFromProgress(spatialProgress.knowledgeTier, spatialProgress.orbitUnlocked, spatialProgress.moonUnlocked);
    applyViewMode(defaultMode);
  }

  return (
    <div className="world-map-shell maplibre-world-shell">
      <div className="world-map-tools maplibre-map-tools">
        <button type="button" className="map-tool-button map-world-button" onClick={recenterWorld}>
          Monde
        </button>
      </div>

      <div className="world-map-legend maplibre-map-legend">
        <div className="maplibre-brief">
          <div className="maplibre-brief-kicker">
            <button
              type="button"
              className="legend-item legend-mode maplibre-brief-mode"
              onClick={() => setBriefExpanded((current) => !current)}
              aria-expanded={briefExpanded}
            >
              {briefingStageLabel}
            </button>
          </div>
          {briefExpanded && (
            <>
              <div className="maplibre-brief-journal">
                <span className="maplibre-brief-eyebrow">{uiLocale === "fr" ? "Nation jouée" : "Played nation"}</span>
                <strong>{worldBriefingTitle}</strong>
                <span className="maplibre-brief-role">{briefingDescriptor}</span>
                <p>{briefingSummary}</p>
              </div>
              <div className="maplibre-brief-ledger">
                <article className="maplibre-brief-entry">
                  <span>{uiLocale === "fr" ? "Moment du tour" : "Turn moment"}</span>
                  <strong>{briefingMomentTitle}</strong>
                  <p>{briefingMomentText}</p>
                </article>
                <article className="maplibre-brief-entry is-target">
                  <span>{uiLocale === "fr" ? "Couverture cartographique" : "Map coverage"}</span>
                  <strong>{`${spatialProgress.discoveryPercent}%`}</strong>
                  <p>
                    {uiLocale === "fr"
                      ? `${spatialProgress.knownCountryIds.length} pays reveles. ${spatialProgress.orbitUnlocked ? "Orbite deverrouillee." : "Orbite verrouillee."} ${spatialProgress.moonUnlocked ? "Lune deverrouillee." : "Lune verrouillee."}`
                      : `${spatialProgress.knownCountryIds.length} countries revealed. ${spatialProgress.orbitUnlocked ? "Orbit unlocked." : "Orbit locked."} ${spatialProgress.moonUnlocked ? "Moon unlocked." : "Moon locked."}`}
                  </p>
                </article>
              </div>
              <div className="maplibre-brief-stats">
                <span
                  className="brief-stat is-economy"
                  style={{
                    background: `linear-gradient(180deg, rgba(111, 211, 128, ${0.12 + economyStrength * 0.14}), rgba(255, 255, 255, 0.03))`
                  }}
                >
                  <strong>{uiLocale === "fr" ? "Economie" : "Economy"}</strong>
                  <em>{`#${economyRank || "?"}/${countryCount}`}</em>
                  <i className="brief-meter" aria-hidden="true"><b style={{ width: `${Math.max(10, Math.round(economyStrength * 100))}%` }} /></i>
                </span>
                <span
                  className="brief-stat is-influence"
                  style={{
                    background: `linear-gradient(180deg, rgba(120, 157, 255, ${0.12 + powerStrength * 0.14}), rgba(255, 255, 255, 0.03))`
                  }}
                >
                  <strong>{uiLocale === "fr" ? "Influence" : "Influence"}</strong>
                  <em>{`#${powerRank || "?"}/${countryCount}`}</em>
                  <i className="brief-meter" aria-hidden="true"><b style={{ width: `${Math.max(10, Math.round(powerStrength * 100))}%` }} /></i>
                </span>
                <span
                  className="brief-stat is-stability"
                  style={{
                    background: `linear-gradient(180deg, rgba(105, 222, 198, ${0.11 + stabilityStrength * 0.13}), rgba(255, 255, 255, 0.03))`
                  }}
                >
                  <strong>{uiLocale === "fr" ? "Stabilite" : "Stability"}</strong>
                  <em>{`${worldStability} / rang #${stabilityRank || "?"}`}</em>
                  <i className="brief-meter" aria-hidden="true"><b style={{ width: `${Math.max(10, Math.round(stabilityStrength * 100))}%` }} /></i>
                </span>
                <span
                  className="brief-stat is-tension"
                  style={{
                    background: `linear-gradient(180deg, rgba(255, 164, 92, ${0.1 + tensionStrength * 0.14}), rgba(255, 255, 255, 0.03))`
                  }}
                >
                  <strong>{uiLocale === "fr" ? "Tension" : "Tension"}</strong>
                  <em>{`${worldTension} / rang #${pressureRank || "?"}`}</em>
                  <i className="brief-meter" aria-hidden="true"><b style={{ width: `${Math.max(10, Math.round(tensionStrength * 100))}%` }} /></i>
                </span>
              </div>
              <div className="maplibre-brief-track" aria-label="Progression spatiale">
                {viewButtons.map((button) => (
                  <button
                    key={button.mode}
                    type="button"
                    className={`track-node${viewMode === button.mode ? " is-active" : ""}${button.locked ? " is-locked" : ""}`}
                    onClick={() => {
                      if (!button.locked) applyViewMode(button.mode);
                    }}
                    disabled={Boolean(button.locked)}
                    aria-pressed={viewMode === button.mode}
                  >
                    <strong>{button.label}</strong>
                    <span>{button.caption}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
