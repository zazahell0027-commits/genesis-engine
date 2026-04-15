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
  if (mode === "balanced") return "equilibre";
  if (mode === "tension") return "crises";
  if (mode === "army") return "troupes";
  if (mode === "fortification") return "forts";
  return "industrie";
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
        <div className="map-mode-row">
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "balanced" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "balanced"}
            onClick={() => onOverlayModeChange("balanced")}
          >
            Equilibre
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
            Troupes
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "fortification" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "fortification"}
            onClick={() => onOverlayModeChange("fortification")}
          >
            Forts
          </button>
          <button
            type="button"
            className={`map-tool-button mode-button${overlayMode === "industry" ? " is-active" : ""}`}
            aria-pressed={overlayMode === "industry"}
            onClick={() => onOverlayModeChange("industry")}
          >
            Industrie
          </button>
        </div>
        <div className="map-tool-row">
          <button type="button" className="map-tool-button" onClick={onRecenter}>Monde</button>
          <button type="button" className="map-tool-button" onClick={onFocusEurope}>Europe</button>
          <button type="button" className="map-tool-button" onClick={onFocusSelected} disabled={!canFocusSelected}>Focus</button>
          <button
            type="button"
            className={`map-tool-button${mapSettings.globeMode ? " is-active" : ""}`}
            onClick={onToggleGlobeMode}
          >
            Globe 3D
          </button>
          <button
            type="button"
            className={`map-tool-button${showSettings ? " is-active" : ""}`}
            onClick={onToggleSettings}
          >
            Options
          </button>
        </div>
      </div>

      <div className="world-map-legend">
        <span className="legend-item legend-mode">{`Mode: ${overlayModeLabel(overlayMode)}`}</span>
        <span className="legend-item"><i className="legend-dot kind-army" /> Troupes</span>
        <span className="legend-item"><i className="legend-dot kind-fortification" /> Forts</span>
        <span className="legend-item"><i className="legend-dot kind-industry" /> Industrie</span>
        <span className="legend-item"><i className="legend-dot kind-crisis" /> Crise</span>
        {showProvinceLayer && <span className="legend-item"><i className="legend-dot kind-province" /> Regions</span>}
      </div>

      {showSettings && (
        <section className="map-settings-panel">
          <header>
            <strong>Options d'affichage</strong>
            <button type="button" className="close-button" onClick={onCloseSettings}>&times;</button>
          </header>
          <p>Basculez les couches visuelles, les etiquettes, les marqueurs et la camera.</p>

          <div className="map-settings-group">
            {settingToggle(mapSettings.showOwnerColors, () => setMapSettings((current) => ({ ...current, showOwnerColors: !current.showOwnerColors })), "Voir par proprietaire")}
            {settingToggle(mapSettings.showCountryLabels, () => setMapSettings((current) => ({ ...current, showCountryLabels: !current.showCountryLabels })), "Afficher les etiquettes des pays")}
            {settingToggle(mapSettings.showInvisible, () => setMapSettings((current) => ({ ...current, showInvisible: !current.showInvisible })), "Afficher les invisibles")}
            {settingToggle(mapSettings.showMapElements, () => setMapSettings((current) => ({ ...current, showMapElements: !current.showMapElements })), "Afficher les elements de carte")}
            {settingToggle(mapSettings.showRegionMarkers, () => setMapSettings((current) => ({ ...current, showRegionMarkers: !current.showRegionMarkers })), "Afficher les marqueurs de region")}
            {settingToggle(mapSettings.showRegionLabels, () => setMapSettings((current) => ({ ...current, showRegionLabels: !current.showRegionLabels })), "Afficher les etiquettes de region")}
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
            {settingToggle(mapSettings.invertScroll, () => setMapSettings((current) => ({ ...current, invertScroll: !current.invertScroll })), "Inverser la direction du zoom")}
            {settingToggle(mapSettings.disableMomentum, () => setMapSettings((current) => ({ ...current, disableMomentum: !current.disableMomentum })), "Desactiver l'inertie du deplacement")}
            {settingToggle(mapSettings.disableEventAnimations, () => setMapSettings((current) => ({ ...current, disableEventAnimations: !current.disableEventAnimations })), "Desactiver les animations d'evenements")}
            {settingToggle(mapSettings.disableCameraMoves, () => setMapSettings((current) => ({ ...current, disableCameraMoves: !current.disableCameraMoves })), "Desactiver les mouvements de camera")}
          </div>
        </section>
      )}
    </>
  );
}
