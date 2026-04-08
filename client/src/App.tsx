import React, { useMemo, useState } from "react";
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

type WorldSummary = {
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  highTensionCount: number;
};

type CreateFormState = {
  name: string;
  kind: "historical" | "fictional";
  complexity: PoliticalComplexity;
  role: RoleType;
  mapSize: MapSize;
};

type ContinentOverview = {
  name: string;
  cells: number;
  avgTension: number;
};

type MapLens = "control" | "tension" | "stability";

type ProjectedTerritory = {
  cell: WorldCell;
  continent: string;
  left: number;
  top: number;
};

type ContinentCloud = {
  continent: string;
  left: number;
  top: number;
  width: number;
  height: number;
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
const historicalContinentOrder = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania"
];

function ownerTint(ownerColor: string): string {
  return `${ownerColor}26`;
}

function getCellClass(cell: WorldCell): string {
  if (cell.tension > 65) return "danger";
  if (cell.stability < 40) return "warning";
  return "stable";
}

function getRiskLabel(cell: WorldCell): string {
  if (cell.tension > 65) return "Conflit";
  if (cell.stability < 40) return "Fragile";
  return "Calme";
}

function summarizeWorld(world: World): WorldSummary {
  const count = Math.max(1, world.cells.length);
  const richness = world.cells.reduce((sum, cell) => sum + cell.richness, 0);
  const stability = world.cells.reduce((sum, cell) => sum + cell.stability, 0);
  const tension = world.cells.reduce((sum, cell) => sum + cell.tension, 0);
  const highTensionCount = world.cells.filter((cell) => cell.tension > 65).length;

  return {
    avgRichness: Math.round(richness / count),
    avgStability: Math.round(stability / count),
    avgTension: Math.round(tension / count),
    highTensionCount
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

function factionShortName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 3)
    .join("");
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

function countryCode(country: string): string {
  const parts = country.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function yearAtEvent(world: World, eventTick: number): number {
  return world.year - (world.tick - eventTick);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function seededNoise(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100003;
  }
  return (hash % 1000) / 1000;
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapValueColor(value: number, low: string, high: string): string {
  const t = clampPercent(value, 0, 100) / 100;

  const parse = (color: string): [number, number, number] => {
    const normalized = color.replace("#", "");
    const valueInt = Number.parseInt(normalized, 16);
    return [(valueInt >> 16) & 255, (valueInt >> 8) & 255, valueInt & 255];
  };

  const [r1, g1, b1] = parse(low);
  const [r2, g2, b2] = parse(high);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function territoryFillColor(world: World, cell: WorldCell, lens: MapLens): string {
  if (lens === "control") {
    return ownerTint(getOwnerColor(world, cell.owner));
  }
  if (lens === "tension") {
    return mapValueColor(cell.tension, "#c7f9d2", "#c4162a");
  }
  return mapValueColor(cell.stability, "#c4162a", "#1f9d55");
}

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [world, setWorld] = useState<World | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [briefing, setBriefing] = useState<WorldBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImpact, setLastImpact] = useState<TerritoryImpact | null>(null);
  const [mapLens, setMapLens] = useState<MapLens>("control");
  const [form, setForm] = useState<CreateFormState>({
    name: "Genesis Demo",
    kind: "historical",
    complexity: "medium",
    role: "nation",
    mapSize: "medium"
  });

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
        avgTension: average(cells.map((cell) => cell.tension))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [world]);

  const worldMapData = useMemo(() => {
    if (!world) {
      return {
        territories: [] as ProjectedTerritory[],
        labels: [] as Array<{ continent: string; x: number; y: number }>,
        clouds: [] as ContinentCloud[]
      };
    }

    const projected: ProjectedTerritory[] = world.cells.map((cell) => {
      const lon = world.width <= 1 ? 0 : (cell.x / (world.width - 1)) * 360 - 180;
      const lat = world.height <= 1 ? 0 : 90 - (cell.y / (world.height - 1)) * 180;
      const jitterX = (seededNoise(`${cell.id}:jx`) - 0.5) * 2.2;
      const jitterY = (seededNoise(`${cell.id}:jy`) - 0.5) * 2.1;

      return {
        cell,
        continent: cell.continent,
        left: clampPercent(((lon + 180) / 360) * 100 + jitterX, 1.2, 97.5),
        top: clampPercent(((90 - lat) / 180) * 100 + jitterY, 4, 94.5)
      };
    });

    const groups = new Map<string, ProjectedTerritory[]>();
    projected.forEach((item) => {
      const bucket = groups.get(item.continent) ?? [];
      bucket.push(item);
      groups.set(item.continent, bucket);
    });

    const orderedNames = world.kind === "historical"
      ? historicalContinentOrder.filter((name) => groups.has(name))
      : [];
    const remaining = [...groups.keys()].filter((name) => !orderedNames.includes(name)).sort((a, b) => a.localeCompare(b));
    const finalOrder = [...orderedNames, ...remaining];

    const labels: Array<{ continent: string; x: number; y: number }> = [];
    const clouds: ContinentCloud[] = [];

    finalOrder.forEach((continent) => {
      const list = groups.get(continent) ?? [];
      if (list.length === 0) return;

      const xs = list.map((item) => item.left);
      const ys = list.map((item) => item.top);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      labels.push({
        continent,
        x: (minX + maxX) / 2,
        y: Math.max(5, minY - 5)
      });

      clouds.push({
        continent,
        left: clampPercent(minX - 3, 0, 100),
        top: clampPercent(minY - 2.5, 0, 100),
        width: clampPercent(maxX - minX + 6, 8, 40),
        height: clampPercent(maxY - minY + 5.5, 6, 26)
      });
    });

    return { territories: projected, labels, clouds };
  }, [world]);

  const localEvents = useMemo(() => {
    if (!world || !selectedCell) return [];

    return world.events
      .filter((event) => event.targetCellId === selectedCell.id || event.factionId === selectedCell.owner)
      .slice(0, 5);
  }, [selectedCell, world]);

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
            Année {world?.year} | Tick {world?.tick} | {world?.kind === "historical" ? "Historique" : "Fictif"} | rôle {world?.role} | scénario {world?.scenarioId}
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

      {world && (
        <p className="action-points">
          Points d'action: {world.actionPoints}/{world.maxActionPoints} (1 action territoire = 1 point, +1 par tick)
        </p>
      )}

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
          <article>
            <h3>Points d'action</h3>
            <p>{world.actionPoints}/{world.maxActionPoints}</p>
          </article>
        </section>
      )}

      {world && (
        <section className="world-layout">
          <div className="map-section">
            <h2>Carte Stratégique 2D</h2>
            <p className="map-subtitle">
              Théâtre mondial simplifié: couleur = contrôle, contour = niveau de tension/stabilité. Clique un territoire pour agir.
            </p>
            <div className="lens-controls">
              <button
                type="button"
                className={mapLens === "control" ? "active" : ""}
                onClick={() => setMapLens("control")}
              >
                Vue contrôle
              </button>
              <button
                type="button"
                className={mapLens === "tension" ? "active" : ""}
                onClick={() => setMapLens("tension")}
              >
                Vue tensions
              </button>
              <button
                type="button"
                className={mapLens === "stability" ? "active" : ""}
                onClick={() => setMapLens("stability")}
              >
                Vue stabilité
              </button>
            </div>

            <div className="legend">
              <span className="legend-item stable">Calme</span>
              <span className="legend-item warning">Fragile</span>
              <span className="legend-item danger">Conflit</span>
            </div>

            <div className="theater-map">
              <div className="theater-ocean-layer" />
              <div className="theater-graticule" />

              {worldMapData.clouds.map((cloud) => (
                <div
                  key={cloud.continent}
                  className="continent-cloud"
                  style={{
                    left: `${cloud.left}%`,
                    top: `${cloud.top}%`,
                    width: `${cloud.width}%`,
                    height: `${cloud.height}%`
                  }}
                />
              ))}

              {worldMapData.labels.map((label) => (
                <div
                  key={label.continent}
                  className="continent-label"
                  style={{ left: `${label.x}%`, top: `${label.y}%` }}
                >
                  {label.continent}
                </div>
              ))}

              {worldMapData.territories.map((territory) => {
                const { cell } = territory;
                const ownerColor = getOwnerColor(world, cell.owner);
                const ownerLabel = factionShortName(factionName(world, cell.owner));
                const statusClass = getCellClass(cell);

                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => setSelectedCellId(cell.id)}
                    className={`territory-node ${statusClass}${selectedCellId === cell.id ? " selected" : ""}`}
                    aria-label={`${cell.country} ${cell.x},${cell.y}`}
                    aria-pressed={selectedCellId === cell.id}
                    style={{
                      left: `${territory.left}%`,
                      top: `${territory.top}%`,
                      "--owner-color": ownerColor,
                      "--owner-tint": territoryFillColor(world, cell, mapLens),
                      "--shape-a": `${20 + Math.round(seededNoise(`${cell.id}:a`) * 22)}%`,
                      "--shape-b": `${72 + Math.round(seededNoise(`${cell.id}:b`) * 20)}%`,
                      "--shape-c": `${14 + Math.round(seededNoise(`${cell.id}:c`) * 20)}%`,
                      "--shape-d": `${78 + Math.round(seededNoise(`${cell.id}:d`) * 17)}%`
                    } as React.CSSProperties}
                    title={`${cell.country} | ${territory.continent} | ${factionName(world, cell.owner)} | R${cell.richness} S${cell.stability} T${cell.tension}`}
                  >
                    <span className="node-code">{countryCode(cell.country)}</span>
                    <span className="node-owner">{ownerLabel}</span>
                    <span className="node-metrics">S{cell.stability} T{cell.tension}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="details-panel">
            <h3>Territoire sélectionné</h3>
            {selectedCell ? (
              <div className="details-block">
                <p>Coordonnées: ({selectedCell.x}, {selectedCell.y})</p>
                <p>Pays: {selectedCell.country}</p>
                <p>Continent: {selectedCell.continent}</p>
                <p>Faction: {factionName(world, selectedCell.owner)}</p>
                <p>Risque: {getRiskLabel(selectedCell)}</p>
                <p>Richesse: {selectedCell.richness}</p>
                <p>Stabilité: {selectedCell.stability}</p>
                <p>Tensions: {selectedCell.tension}</p>
                <div className="actions territory-actions">
                  <button type="button" onClick={() => handlePlayerAction("stabilize")} disabled={loading || world.actionPoints <= 0}>Stabiliser</button>
                  <button type="button" onClick={() => handlePlayerAction("invest")} disabled={loading || world.actionPoints <= 0}>Investir</button>
                  <button type="button" onClick={() => handlePlayerAction("influence")} disabled={loading || world.actionPoints <= 0}>Influencer</button>
                  <button type="button" onClick={() => handlePlayerAction("disrupt")} disabled={loading || world.actionPoints <= 0}>Perturber</button>
                </div>
                {world.actionPoints <= 0 && <p className="action-warning">Plus de points d'action. Lance un tick.</p>}
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
                  {continent.name} | {continent.cells} territoires | tension moy. {continent.avgTension}
                </p>
              ))}
            </div>

            <h3>Événements locaux</h3>
            <div className="event-feed">
              {localEvents.length > 0 ? (
                localEvents.map((evt) => (
                  <article key={evt.id} className="event-item local-event">
                    <strong>{eventTypeLabel(evt.type)} - année {yearAtEvent(world, evt.tick)} (tick {evt.tick})</strong>
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
                  <strong>{eventTypeLabel(evt.type)} - année {yearAtEvent(world, evt.tick)} (tick {evt.tick})</strong>
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
