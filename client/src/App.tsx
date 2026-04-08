import React, { useEffect, useMemo, useState } from "react";
import type {
  CreateWorldInput,
  EventType,
  MapSize,
  PoliticalComplexity,
  RoleType,
  World,
  WorldCell
} from "@genesis/shared";
import {
  applyPlayerAction,
  createDemoWorld,
  createWorld,
  getWorldBriefing,
  tickWorld,
  triggerWorldEvent,
  type WorldBriefing
} from "./api";
import "./styles.css";

type ViewMode = "landing" | "world";
type MapMode = "grid" | "globe";

type WorldSummary = {
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  highTensionCount: number;
  lowStabilityCount: number;
};

type CreateFormState = {
  name: string;
  kind: "historical" | "fictional";
  complexity: PoliticalComplexity;
  role: RoleType;
  mapSize: MapSize;
};

type ProjectedPoint = {
  cell: WorldCell;
  x: number;
  y: number;
  z: number;
  radius: number;
  ownerColor: string;
};

type ContinentOverview = {
  name: string;
  cells: number;
  avgTension: number;
};

type TerritorySnapshot = {
  cellId: string;
  richness: number;
  stability: number;
  tension: number;
  owner: string;
  tick: number;
};

type TerritoryImpact = {
  source: "tick" | "action";
  actionLabel: string;
  before: TerritorySnapshot;
  after: TerritorySnapshot;
};

const ownerPalette = ["#1D4ED8", "#BE123C", "#047857", "#7C3AED", "#C2410C", "#0F766E"];

const GLOBE_SIZE = 560;
const GLOBE_RADIUS = 230;
const GLOBE_CENTER = GLOBE_SIZE / 2;

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function getCellClass(cell: WorldCell): string {
  if (cell.tension > 65) return "cell danger";
  if (cell.stability < 35) return "cell warning";
  return "cell stable";
}

function getRiskLabel(cell: WorldCell): string {
  if (cell.tension > 65) return "Conflit";
  if (cell.stability < 35) return "Fragile";
  return "Calme";
}

function summarizeWorld(world: World): WorldSummary {
  const count = Math.max(1, world.cells.length);
  const richness = world.cells.reduce((sum, cell) => sum + cell.richness, 0);
  const stability = world.cells.reduce((sum, cell) => sum + cell.stability, 0);
  const tension = world.cells.reduce((sum, cell) => sum + cell.tension, 0);
  const highTensionCount = world.cells.filter((cell) => cell.tension > 65).length;
  const lowStabilityCount = world.cells.filter((cell) => cell.stability < 35).length;

  return {
    avgRichness: Math.round(richness / count),
    avgStability: Math.round(stability / count),
    avgTension: Math.round(tension / count),
    highTensionCount,
    lowStabilityCount
  };
}

function conflictLabel(summary: WorldSummary): string {
  if (summary.avgTension > 62 || summary.highTensionCount > 16) return "Élevé";
  if (summary.avgTension > 48 || summary.highTensionCount > 8) return "Moyen";
  return "Faible";
}

function factionName(world: World | null, ownerId: string): string {
  if (!world) return ownerId;
  return world.factions.find((faction) => faction.id === ownerId)?.name ?? ownerId;
}

function eventTypeLabel(type: EventType): string {
  if (type === "troubles") return "Troubles";
  if (type === "alliance") return "Alliance";
  if (type === "expansion") return "Expansion";
  if (type === "crisis_local") return "Crise";
  return "Découverte";
}

function getOwnerColor(world: World, ownerId: string): string {
  const ownerIndex = world.factions.findIndex((faction) => faction.id === ownerId);
  return ownerPalette[(ownerIndex + ownerPalette.length) % ownerPalette.length] ?? "#334155";
}

function buildLatPath(latDeg: number): string {
  const lat = degToRad(latDeg);
  const points: string[] = [];

  for (let lon = -90; lon <= 90; lon += 6) {
    const lambda = degToRad(lon);
    const x = Math.cos(lat) * Math.sin(lambda);
    const y = Math.sin(lat);
    const sx = GLOBE_CENTER + GLOBE_RADIUS * x;
    const sy = GLOBE_CENTER - GLOBE_RADIUS * y;
    points.push(`${sx.toFixed(2)},${sy.toFixed(2)}`);
  }

  return points.join(" ");
}

function buildLonPath(lonDeg: number, rotationDeg: number): string {
  const points: string[] = [];

  for (let lat = -90; lat <= 90; lat += 5) {
    const phi = degToRad(lat);
    const lambda = degToRad(lonDeg - rotationDeg);

    const x = Math.cos(phi) * Math.sin(lambda);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lambda);

    if (z <= 0) continue;

    const sx = GLOBE_CENTER + GLOBE_RADIUS * x;
    const sy = GLOBE_CENTER - GLOBE_RADIUS * y;
    points.push(`${sx.toFixed(2)},${sy.toFixed(2)}`);
  }

  return points.join(" ");
}

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [mapMode, setMapMode] = useState<MapMode>("grid");
  const [world, setWorld] = useState<World | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [briefing, setBriefing] = useState<WorldBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImpact, setLastImpact] = useState<TerritoryImpact | null>(null);
  const [globeRotation, setGlobeRotation] = useState(28);
  const [globeAutoRotate, setGlobeAutoRotate] = useState(true);
  const [form, setForm] = useState<CreateFormState>({
    name: "Genesis Demo",
    kind: "fictional",
    complexity: "medium",
    role: "hero",
    mapSize: "medium"
  });

  useEffect(() => {
    if (!world || mapMode !== "globe" || !globeAutoRotate) return;

    const timer = window.setInterval(() => {
      setGlobeRotation((prev) => (prev + 0.6) % 360);
    }, 85);

    return () => window.clearInterval(timer);
  }, [globeAutoRotate, mapMode, world]);

  const gridStyle = useMemo(() => {
    if (!world) return undefined;
    return { gridTemplateColumns: `repeat(${world.width}, minmax(0, 1fr))` };
  }, [world]);

  const selectedCell = useMemo(() => {
    if (!world || !selectedCellId) return null;
    return world.cells.find((cell) => cell.id === selectedCellId) ?? null;
  }, [selectedCellId, world]);

  const worldSummary = useMemo(() => {
    if (!world) return null;
    return summarizeWorld(world);
  }, [world]);

  const continentOverview = useMemo(() => {
    if (!world) return [] as ContinentOverview[];

    const map = new Map<string, WorldCell[]>();
    for (const cell of world.cells) {
      const list = map.get(cell.continent) ?? [];
      list.push(cell);
      map.set(cell.continent, list);
    }

    return [...map.entries()]
      .map(([name, cells]) => ({
        name,
        cells: cells.length,
        avgTension: Math.round(cells.reduce((sum, cell) => sum + cell.tension, 0) / cells.length)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [world]);

  const localEvents = useMemo(() => {
    if (!world || !selectedCell) return [];

    return world.events
      .filter((event) => event.targetCellId === selectedCell.id || event.factionId === selectedCell.owner)
      .slice(0, 5);
  }, [selectedCell, world]);

  const globePoints = useMemo(() => {
    if (!world) return [] as ProjectedPoint[];

    const points: ProjectedPoint[] = [];

    for (const cell of world.cells) {
      const lon = world.width <= 1 ? 0 : (cell.x / (world.width - 1)) * 360 - 180;
      const lat = world.height <= 1 ? 0 : 90 - (cell.y / (world.height - 1)) * 180;

      const lambda = degToRad(lon - globeRotation);
      const phi = degToRad(lat);

      const x = Math.cos(phi) * Math.sin(lambda);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.cos(lambda);

      if (z <= 0) continue;

      points.push({
        cell,
        x: GLOBE_CENTER + GLOBE_RADIUS * x,
        y: GLOBE_CENTER - GLOBE_RADIUS * y,
        z,
        radius: 2.6 + cell.richness / 42,
        ownerColor: getOwnerColor(world, cell.owner)
      });
    }

    return points.sort((a, b) => a.z - b.z);
  }, [globeRotation, world]);

  const isSelectedBehindGlobe = useMemo(() => {
    if (!world || !selectedCell) return false;

    const lon = world.width <= 1 ? 0 : (selectedCell.x / (world.width - 1)) * 360 - 180;
    const lat = world.height <= 1 ? 0 : 90 - (selectedCell.y / (world.height - 1)) * 180;

    const lambda = degToRad(lon - globeRotation);
    const phi = degToRad(lat);
    const z = Math.cos(phi) * Math.cos(lambda);

    return z <= 0;
  }, [globeRotation, selectedCell, world]);

  function snapshotCell(currentWorld: World, cellId: string): TerritorySnapshot | null {
    const cell = currentWorld.cells.find((item) => item.id === cellId);
    if (!cell) return null;

    return {
      cellId: cell.id,
      richness: cell.richness,
      stability: cell.stability,
      tension: cell.tension,
      owner: cell.owner,
      tick: currentWorld.tick
    };
  }

  async function refreshBriefing(worldId: string): Promise<void> {
    setBriefingLoading(true);
    try {
      const result = await getWorldBriefing(worldId);
      setBriefing(result);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }

  async function hydrateWorld(created: World): Promise<void> {
    setWorld(created);
    setSelectedCellId(created.cells[0]?.id ?? null);
    setViewMode("world");
    setMapMode("grid");
    setShowJson(false);
    await refreshBriefing(created.id);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const input: CreateWorldInput = {
        name: form.name,
        kind: form.kind,
        complexity: form.complexity,
        role: form.role,
        mapSize: form.mapSize
      };
      const created = await createWorld(input);
      await hydrateWorld(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadDemo(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const created = await createDemoWorld();
      await hydrateWorld(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleTick(): Promise<void> {
    if (!world) return;

    setLoading(true);
    setError(null);
    try {
      const beforeImpact = selectedCellId ? snapshotCell(world, selectedCellId) : null;
      const updated = await tickWorld(world.id);
      setWorld(updated);
      setBriefing((prev) => (prev ? { ...prev, tick: updated.tick } : null));
      if (beforeImpact) {
        const afterImpact = snapshotCell(updated, beforeImpact.cellId);
        if (afterImpact) {
          setLastImpact({
            source: "tick",
            actionLabel: "Tick",
            before: beforeImpact,
            after: afterImpact
          });
        }
      }
      if (selectedCellId && !updated.cells.some((cell) => cell.id === selectedCellId)) {
        setSelectedCellId(updated.cells[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerEvent(): Promise<void> {
    if (!world) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await triggerWorldEvent(world.id);
      setWorld(updated);
      await refreshBriefing(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayerAction(action: "stabilize" | "invest" | "influence" | "disrupt"): Promise<void> {
    if (!world || !selectedCell) return;

    setLoading(true);
    setError(null);
    try {
      const beforeImpact = snapshotCell(world, selectedCell.id);
      const updated = await applyPlayerAction(world.id, selectedCell.id, action);
      setWorld(updated);
      if (beforeImpact) {
        const afterImpact = snapshotCell(updated, beforeImpact.cellId);
        if (afterImpact) {
          const label = action === "stabilize"
            ? "Stabiliser"
            : action === "invest"
              ? "Investir"
              : action === "influence"
                ? "Influencer"
                : "Perturber";

          setLastImpact({
            source: "action",
            actionLabel: label,
            before: beforeImpact,
            after: afterImpact
          });
        }
      }
      await refreshBriefing(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (viewMode === "landing") {
    return (
      <main className="container">
        <section className="hero">
          <h1>Genesis Engine</h1>
          <p>
            Moteur de simulation sandbox: mondes vivants, factions dynamiques et événements émergents.
          </p>
          {error && <p className="error">Erreur: {error}</p>}

          <form className="world-form" onSubmit={handleCreate}>
            <label>
              Nom du monde
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>

            <label>
              Type de monde
              <select
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as CreateFormState["kind"] }))}
              >
                <option value="historical">Historique</option>
                <option value="fictional">Fictif</option>
              </select>
            </label>

            <label>
              Complexité politique
              <select
                value={form.complexity}
                onChange={(event) => setForm((prev) => ({ ...prev, complexity: event.target.value as PoliticalComplexity }))}
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
              </select>
            </label>

            <label>
              Rôle de départ
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as RoleType }))}
              >
                <option value="hero">Héros</option>
                <option value="faction">Faction</option>
                <option value="nation">Nation</option>
                <option value="gm">MJ</option>
              </select>
            </label>

            <label>
              Taille de la carte
              <select
                value={form.mapSize}
                onChange={(event) => setForm((prev) => ({ ...prev, mapSize: event.target.value as MapSize }))}
              >
                <option value="small">Petite</option>
                <option value="medium">Moyenne</option>
                <option value="large">Grande</option>
              </select>
            </label>

            <div className="actions">
              <button type="submit" disabled={loading}>Créer un monde</button>
              <button type="button" onClick={handleLoadDemo} disabled={loading}>Charger une démo</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="world-header">
        <div>
          <h1>{world?.name}</h1>
          <p>
            Tick {world?.tick} | {world?.kind === "historical" ? "Historique" : "Fictif"} | rôle {world?.role}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={handleTick} disabled={loading || !world}>Avancer le temps</button>
          <button type="button" onClick={handleTriggerEvent} disabled={loading || !world}>Déclencher un événement</button>
          <button
            type="button"
            onClick={() => world && refreshBriefing(world.id)}
            disabled={!world || loading || briefingLoading}
          >
            {briefingLoading ? "Narration..." : "Narration IA locale"}
          </button>
          <button type="button" onClick={() => setShowJson((prev) => !prev)} disabled={!world}>
            {showJson ? "Masquer JSON" : "Afficher JSON"}
          </button>
          <button type="button" onClick={() => setViewMode("landing")}>Retour accueil</button>
        </div>
      </header>

      {error && <p className="error">Erreur: {error}</p>}

      {world && worldSummary && (
        <section className="metrics-grid">
          <article>
            <h3>Stabilité globale</h3>
            <p>{worldSummary.avgStability}</p>
          </article>
          <article>
            <h3>Richesse moyenne</h3>
            <p>{worldSummary.avgRichness}</p>
          </article>
          <article>
            <h3>Niveau de conflit</h3>
            <p>{conflictLabel(worldSummary)}</p>
          </article>
          <article>
            <h3>Factions</h3>
            <p>{world.factions.length}</p>
          </article>
        </section>
      )}

      {world && (
        <section className="world-layout">
          <div>
            <div className="map-header-row">
              <h2>Carte des territoires</h2>
              <div className="actions map-mode-actions">
                <button type="button" className={mapMode === "grid" ? "active" : ""} onClick={() => setMapMode("grid")}>Grille</button>
                <button type="button" className={mapMode === "globe" ? "active" : ""} onClick={() => setMapMode("globe")}>Globe</button>
              </div>
            </div>

            <div className="legend">
              <span className="legend-item stable">Calme</span>
              <span className="legend-item warning">Fragile</span>
              <span className="legend-item danger">Conflit</span>
            </div>

            {mapMode === "grid" ? (
              <div className="grid" style={gridStyle}>
                {world.cells.map((cell) => {
                  const ownerColor = getOwnerColor(world, cell.owner);

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={() => setSelectedCellId(cell.id)}
                      className={`${getCellClass(cell)}${selectedCellId === cell.id ? " selected" : ""}`}
                      aria-label={`Cell ${cell.x},${cell.y}`}
                      aria-pressed={selectedCellId === cell.id}
                      style={{ "--owner-color": ownerColor } as React.CSSProperties}
                      title={`${cell.continent} | R${cell.richness} S${cell.stability} T${cell.tension}`}
                    >
                      <div className="cell-owner-dot" />
                      <div className="cell-coords">({cell.x}, {cell.y})</div>
                      <small className="cell-continent">{cell.continent}</small>
                      <small>R {cell.richness}</small>
                      <small>S {cell.stability}</small>
                      <small>T {cell.tension}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="globe-panel">
                <div className="globe-controls">
                  <label>
                    Rotation
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={globeRotation}
                      onChange={(event) => {
                        setGlobeAutoRotate(false);
                        setGlobeRotation(Number(event.target.value));
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => setGlobeAutoRotate((prev) => !prev)}>
                    {globeAutoRotate ? "Pause rotation" : "Auto-rotation"}
                  </button>
                </div>

                <svg viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`} className="globe-svg" role="img" aria-label="Globe des territoires">
                  <defs>
                    <radialGradient id="globeFill" cx="35%" cy="32%" r="70%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                      <stop offset="38%" stopColor="#d9f0ff" stopOpacity="0.78" />
                      <stop offset="78%" stopColor="#8cbad8" stopOpacity="0.86" />
                      <stop offset="100%" stopColor="#4e6b8c" stopOpacity="0.92" />
                    </radialGradient>
                  </defs>

                  <circle cx={GLOBE_CENTER} cy={GLOBE_CENTER} r={GLOBE_RADIUS} fill="url(#globeFill)" className="globe-sphere" />

                  {[-60, -30, 0, 30, 60].map((lat) => (
                    <polyline
                      key={`lat-${lat}`}
                      points={buildLatPath(lat)}
                      fill="none"
                      className="globe-graticule"
                    />
                  ))}

                  {[-120, -60, 0, 60, 120].map((lon) => {
                    const points = buildLonPath(lon, globeRotation);
                    if (!points) return null;

                    return (
                      <polyline
                        key={`lon-${lon}`}
                        points={points}
                        fill="none"
                        className="globe-graticule"
                      />
                    );
                  })}

                  <circle cx={GLOBE_CENTER} cy={GLOBE_CENTER} r={GLOBE_RADIUS} className="globe-rim" fill="none" />

                  {globePoints.map((point) => (
                    <circle
                      key={point.cell.id}
                      cx={point.x}
                      cy={point.y}
                      r={selectedCellId === point.cell.id ? point.radius + 2 : point.radius}
                      fill={point.ownerColor}
                      className={selectedCellId === point.cell.id ? "globe-cell selected" : "globe-cell"}
                      onClick={() => setSelectedCellId(point.cell.id)}
                    />
                  ))}
                </svg>

                {selectedCell && isSelectedBehindGlobe && (
                  <p className="globe-hint">Le territoire sélectionné est sur la face cachée du globe.</p>
                )}
              </div>
            )}
          </div>

          <aside className="details-panel">
            <h3>Territoire sélectionné</h3>
            {selectedCell ? (
              <div className="details-block">
                <p>Coordonnées: ({selectedCell.x}, {selectedCell.y})</p>
                <p>Continent: {selectedCell.continent}</p>
                <p>Faction: {factionName(world, selectedCell.owner)}</p>
                <p>Risque: {getRiskLabel(selectedCell)}</p>
                <p>Richesse: {selectedCell.richness}</p>
                <p>Stabilité: {selectedCell.stability}</p>
                <p>Tensions: {selectedCell.tension}</p>
                <div className="actions territory-actions">
                  <button type="button" onClick={() => handlePlayerAction("stabilize")} disabled={loading}>Stabiliser</button>
                  <button type="button" onClick={() => handlePlayerAction("invest")} disabled={loading}>Investir</button>
                  <button type="button" onClick={() => handlePlayerAction("influence")} disabled={loading}>Influencer</button>
                  <button type="button" onClick={() => handlePlayerAction("disrupt")} disabled={loading}>Perturber</button>
                </div>
              </div>
            ) : (
              <p>Sélectionne une zone de la carte.</p>
            )}

            {selectedCell && lastImpact && lastImpact.after.cellId === selectedCell.id && (
              <div className="details-block impact-block">
                <p><strong>Impact récent: {lastImpact.actionLabel}</strong></p>
                <p className={lastImpact.after.richness - lastImpact.before.richness >= 0 ? "delta up" : "delta down"}>
                  Richesse: {lastImpact.before.richness} {"->"} {lastImpact.after.richness}
                </p>
                <p className={lastImpact.after.stability - lastImpact.before.stability >= 0 ? "delta up" : "delta down"}>
                  Stabilité: {lastImpact.before.stability} {"->"} {lastImpact.after.stability}
                </p>
                <p className={lastImpact.after.tension - lastImpact.before.tension <= 0 ? "delta up" : "delta down"}>
                  Tensions: {lastImpact.before.tension} {"->"} {lastImpact.after.tension}
                </p>
                {lastImpact.before.owner !== lastImpact.after.owner && (
                  <p className="delta down">
                    Contrôle: {factionName(world, lastImpact.before.owner)} {"->"} {factionName(world, lastImpact.after.owner)}
                  </p>
                )}
              </div>
            )}

            <h3>Continents</h3>
            <div className="details-block continent-list">
              {continentOverview.map((continent) => (
                <p key={continent.name}>
                  {continent.name} | {continent.cells} cases | tension moy. {continent.avgTension}
                </p>
              ))}
            </div>

            <h3>Événements locaux</h3>
            <div className="event-feed">
              {localEvents.length > 0 ? (
                localEvents.map((evt) => (
                  <article key={evt.id} className="event-item local-event">
                    <strong>{eventTypeLabel(evt.type)} - tick {evt.tick}</strong>
                    <p>{evt.title}</p>
                    <small>{evt.description}</small>
                  </article>
                ))
              ) : (
                <p className="event-empty">Aucun événement local pour ce territoire.</p>
              )}
            </div>

            <h3>Factions</h3>
            <div className="details-block">
              {world.factions.map((faction) => (
                <p key={faction.id}>
                  {faction.name} | P{faction.power} | R{faction.resources}
                </p>
              ))}
            </div>

            <h3>Événements globaux récents</h3>
            <div className="event-feed">
              {world.events.slice(0, 8).map((evt) => (
                <article key={evt.id} className="event-item">
                  <strong>{eventTypeLabel(evt.type)} - tick {evt.tick}</strong>
                  <p>{evt.title}</p>
                  <small>{evt.description}</small>
                </article>
              ))}
            </div>

            <h3>Briefing IA</h3>
            <div className="details-block">
              {briefing ? (
                <>
                  <p>Provider: {briefing.provider}</p>
                  <p>{briefing.narrative}</p>
                </>
              ) : (
                <p>Génère une narration locale depuis le backend.</p>
              )}
            </div>
          </aside>
        </section>
      )}

      {showJson && (
        <section>
          <h2>Monde (JSON)</h2>
          <pre>{JSON.stringify(world, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
