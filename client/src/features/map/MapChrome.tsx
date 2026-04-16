import React from "react";

export type OverlayMode = "balanced" | "tension" | "army" | "fortification" | "industry";

export type MapSettingsState = {
  showOwnerColors: boolean;
  showCountryLabels: boolean;
  showInvisible: boolean;
  showMapElements: boolean;
  showRegionMarkers: boolean;
  showRegionLabels: boolean;
  zoomSensitivity: number;
  borderScale: number;
  markerScaleRelative: number;
  markerScaleAbsolute: number;
  invertScroll: boolean;
  disableMomentum: boolean;
  disableEventAnimations: boolean;
  disableCameraMoves: boolean;
  globeMode: boolean;
};

type MapChromeProps = {
  overlayMode: OverlayMode;
  onOverlayModeChange: (mode: OverlayMode) => void;
  onRecenter: () => void;
  onFocusEurope: () => void;
  onFocusSelected: () => void;
  onToggleGlobeMode: () => void;
  canFocusSelected: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  showProvinceLayer: boolean;
  mapSettings: MapSettingsState;
  setMapSettings: React.Dispatch<React.SetStateAction<MapSettingsState>>;
};

function settingToggle(
  checked: boolean,
  onToggle: () => void,
  label: string
): React.JSX.Element {
  return (
    <button type="button" className={`map-setting-toggle${checked ? " is-on" : ""}`} onClick={onToggle}>
      <span className="switch-track"><span className="switch-thumb" /></span>
      <span>{label}</span>
    </button>
  );
}

function overlayModeLabel(mode: OverlayMode): string {
  if (mode === "balanced") return "Lecture globale";
  if (mode === "tension") return "Tensions";
  if (mode === "army") return "Forces";
  if (mode === "fortification") return "Fortifications";
  return "Economie";
}

export function MapChrome(props: MapChromeProps): React.JSX.Element {
  const {
    overlayMode,
    onOverlayModeChange,
    onRecenter,
    onFocusEurope,
    onFocusSelected,
    onToggleGlobeMode,
    canFocusSelected,
    showSettings,
    onToggleSettings,
    onCloseSettings,
    showProvinceLayer,
    mapSettings,
    setMapSettings
  } = props;

  return (
    <>
      <div className="world-map-tools">
        <div className="map-tool-group">
          <span className="map-tool-group-label">Couches</span>
          <div className="map-mode-row">
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "balanced" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "balanced"}
            onClick={() => onOverlayModeChange("balanced")}
          >
            Vue globale
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "tension" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "tension"}
            onClick={() => onOverlayModeChange("tension")}
          >
            Crises
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "army" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "army"}
            onClick={() => onOverlayModeChange("army")}
          >
            Forces
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "fortification" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "fortification"}
            onClick={() => onOverlayModeChange("fortification")}
          >
            Positions
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "industry" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "industry"}
            onClick={() => onOverlayModeChange("industry")}
          >
            Ressources
          </button>
          </div>
        </div>
        <div className="map-tool-group">
          <span className="map-tool-group-label">Vue</span>
          <div className="map-tool-row">
            <button type="button" className="map-tool-button" onClick={onRecenter}>Monde</button>
            <button type="button" className="map-tool-button" onClick={onFocusEurope}>Europe</button>
            <button type="button" className="map-tool-button" onClick={onFocusSelected} disabled={!canFocusSelected}>Selection</button>
            <button
              type="button"
              className={`map-tool-button${mapSettings.globeMode ? " is-active" : ""}`}
              onClick={onToggleGlobeMode}
            >
              Globe
            </button>
            <button
              type="button"
              className={`map-tool-button${showSettings ? " is-active" : ""}`}
              onClick={onToggleSettings}
            >
              Filtres
            </button>
          </div>
        </div>
      </div>

      <div className="world-map-legend">
        <span className="legend-item legend-mode">{overlayModeLabel(overlayMode)}</span>
        <span className="legend-item"><i className="legend-dot kind-army" /> Forces</span>
        <span className="legend-item"><i className="legend-dot kind-fortification" /> Forts</span>
        <span className="legend-item"><i className="legend-dot kind-industry" /> Economie</span>
        <span className="legend-item"><i className="legend-dot kind-crisis" /> Crise</span>
        {showProvinceLayer && <span className="legend-item"><i className="legend-dot kind-province" /> Regions</span>}
      </div>

      {showSettings && (
        <section className="map-settings-panel">
          <header>
            <strong>Filtres de lecture</strong>
            <button type="button" className="close-button" onClick={onCloseSettings}>&times;</button>
          </header>
          <p>Gardez seulement les couches utiles pour lire la carte sans surcharge.</p>

          <div className="map-settings-group">
            {settingToggle(mapSettings.showOwnerColors, () => setMapSettings((current) => ({ ...current, showOwnerColors: !current.showOwnerColors })), "Couleurs par proprietaire")}
            {settingToggle(mapSettings.showCountryLabels, () => setMapSettings((current) => ({ ...current, showCountryLabels: !current.showCountryLabels })), "Noms des pays")}
            {settingToggle(mapSettings.showInvisible, () => setMapSettings((current) => ({ ...current, showInvisible: !current.showInvisible })), "Couches cachees")}
            {settingToggle(mapSettings.showMapElements, () => setMapSettings((current) => ({ ...current, showMapElements: !current.showMapElements })), "Elements tactiques")}
            {settingToggle(mapSettings.showRegionMarkers, () => setMapSettings((current) => ({ ...current, showRegionMarkers: !current.showRegionMarkers })), "Marqueurs regionaux")}
            {settingToggle(mapSettings.showRegionLabels, () => setMapSettings((current) => ({ ...current, showRegionLabels: !current.showRegionLabels })), "Noms regionaux")}
          </div>

          <div className="map-settings-group sliders">
            <label>
              <span>Sensibilite du zoom</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={mapSettings.zoomSensitivity}
                onChange={(event) => setMapSettings((current) => ({ ...current, zoomSensitivity: Number.parseFloat(event.target.value) }))}
              />
            </label>
            <label>
              <span>Taille des bordures</span>
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.05"
                value={mapSettings.borderScale}
                onChange={(event) => setMapSettings((current) => ({ ...current, borderScale: Number.parseFloat(event.target.value) }))}
              />
            </label>
            <label>
              <span>Taille des elements (relative)</span>
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.05"
                value={mapSettings.markerScaleRelative}
                onChange={(event) => setMapSettings((current) => ({ ...current, markerScaleRelative: Number.parseFloat(event.target.value) }))}
              />
            </label>
            <label>
              <span>Taille des elements (absolue)</span>
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.05"
                value={mapSettings.markerScaleAbsolute}
                onChange={(event) => setMapSettings((current) => ({ ...current, markerScaleAbsolute: Number.parseFloat(event.target.value) }))}
              />
            </label>
          </div>

          <div className="map-settings-group">
            {settingToggle(mapSettings.invertScroll, () => setMapSettings((current) => ({ ...current, invertScroll: !current.invertScroll })), "Inverser le zoom")}
            {settingToggle(mapSettings.disableMomentum, () => setMapSettings((current) => ({ ...current, disableMomentum: !current.disableMomentum })), "Sans inertie")}
            {settingToggle(mapSettings.disableEventAnimations, () => setMapSettings((current) => ({ ...current, disableEventAnimations: !current.disableEventAnimations })), "Animations d'evenements")}
            {settingToggle(mapSettings.disableCameraMoves, () => setMapSettings((current) => ({ ...current, disableCameraMoves: !current.disableCameraMoves })), "Camera fixe")}
          </div>
        </section>
      )}
    </>
  );
}
