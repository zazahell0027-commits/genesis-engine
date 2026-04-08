import React, { useMemo, useState } from "react";
import {
  HISTORICAL_START_COUNTRIES,
  type CreateWorldInput,
  type EventType,
  type HistoricalStartCountry,
  type MapSize,
  type PoliticalComplexity,
  type RoleType,
  type World,
  type WorldCell
} from "@genesis/shared";
import {
  createDemoWorld,
  createWorld,
  getWorldBriefing,
  queuePlayerAction as queuePlayerActionRequest,
  removeQueuedPlayerAction as removeQueuedPlayerActionRequest,
  removeTurnCommand as removeTurnCommandRequest,
  resolveWorldTurn,
  submitTurnCommand as submitTurnCommandRequest,
  triggerWorldEvent,
  type WorldBriefing
} from "./api";
import { WorldGeoMap } from "./components/WorldGeoMap";
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
  startCountry: HistoricalStartCountry;
};

type ContinentOverview = {
  name: string;
  cells: number;
  avgTension: number;
};

type MapLens = "control" | "tension" | "stability";

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
  if (summary.avgTension > 62 || summary.highTensionCount > 16) return "Eleve";
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
  return "Decouverte";
}

function playerActionLabel(action: "stabilize" | "invest" | "influence" | "disrupt" | "incite"): string {
  if (action === "stabilize") return "Stabiliser";
  if (action === "invest") return "Investir";
  if (action === "influence") return "Influencer";
  if (action === "incite") return "Perturber";
  return "Perturber";
}

function getOwnerColor(world: World, ownerId: string): string {
  const ownerIndex = world.factions.findIndex((faction) => faction.id === ownerId);
  return ownerPalette[(ownerIndex + ownerPalette.length) % ownerPalette.length] ?? "#334155";
}

function yearAtEvent(world: World, eventTick: number): number {
  return world.year - (world.tick - eventTick);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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
  const [commandText, setCommandText] = useState("");
  const [form, setForm] = useState<CreateFormState>({
    name: "Genesis Earth 2010",
    kind: "historical",
    complexity: "medium",
    role: "nation",
    mapSize: "medium",
    startCountry: "France"
  });

  const selectedCell = useMemo(() => {
    if (!world || !selectedCellId) return null;
    return world.cells.find((cell) => cell.id === selectedCellId) ?? null;
  }, [selectedCellId, world]);

  const canActOnSelectedTerritory = useMemo(() => {
    if (!world || !selectedCell) return false;
    if (!world.countryLocked || world.role !== "nation" || !world.playerFactionId) return true;
    return selectedCell.owner === world.playerFactionId;
  }, [selectedCell, world]);

  const canQueueMoreActions = useMemo(() => {
    if (!world) return false;
    return world.queuedActions.length < world.maxActionPoints && world.actionPoints > 0;
  }, [world]);

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
    setSelectedCellId(created.startCellId ?? created.cells[0]?.id ?? null);
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
        mapSize: form.mapSize,
        startCountry: form.kind === "historical" ? form.startCountry : undefined
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

  async function handleResolveTurn(): Promise<void> {
    if (!world) return;

    setLoading(true);
    setError(null);
    try {
      const beforeImpact = selectedCellId ? snapshotCell(world, selectedCellId) : null;
      const updated = await resolveWorldTurn(world.id);
      setWorld(updated);
      setBriefing((prev) => (prev ? { ...prev, tick: updated.tick } : null));
      await refreshBriefing(updated.id);
      if (beforeImpact) {
        const afterImpact = snapshotCell(updated, beforeImpact.cellId);
        if (afterImpact) {
          setLastImpact({
            source: "tick",
            actionLabel: "Tour resolu",
            before: beforeImpact,
            after: afterImpact
          });
        }
      }
      if (selectedCellId && !updated.cells.some((cell) => cell.id === selectedCellId)) {
        setSelectedCellId(updated.startCellId ?? updated.cells[0]?.id ?? null);
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

  async function handleQueueAction(action: "stabilize" | "invest" | "influence" | "disrupt"): Promise<void> {
    if (!world || !selectedCell) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await queuePlayerActionRequest(world.id, selectedCell.id, action);
      setWorld(updated);
      setLastImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveQueuedAction(queuedActionId: string): Promise<void> {
    if (!world) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await removeQueuedPlayerActionRequest(world.id, queuedActionId);
      setWorld(updated);
      setLastImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitCommand(): Promise<void> {
    if (!world) return;
    const text = commandText.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await submitTurnCommandRequest(world.id, text);
      setWorld(updated);
      setCommandText("");
      setLastImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveCommand(commandId: string): Promise<void> {
    if (!world) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await removeTurnCommandRequest(world.id, commandId);
      setWorld(updated);
      setLastImpact(null);
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
            Moteur de simulation sandbox: mondes vivants, factions dynamiques et evenements emergents.
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

            {form.kind === "historical" && (
              <label>
                Pays de depart
                <select
                  value={form.startCountry}
                  onChange={(event) => setForm((prev) => ({ ...prev, startCountry: event.target.value as HistoricalStartCountry }))}
                >
                  {HISTORICAL_START_COUNTRIES.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Complexite politique
              <select
                value={form.complexity}
                onChange={(event) => setForm((prev) => ({ ...prev, complexity: event.target.value as PoliticalComplexity }))}
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Eleve</option>
              </select>
            </label>

            <label>
              Role de depart
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as RoleType }))}
              >
                <option value="hero">Hero</option>
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
              <button type="submit" disabled={loading}>Creer un monde</button>
              <button type="button" onClick={handleLoadDemo} disabled={loading}>Charger une demo</button>
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
            Annee {world?.year} | Tick {world?.tick} | {world?.kind === "historical" ? "Historique" : "Fictif"} | role {world?.role} | scenario {world?.scenarioId}
          </p>
          {world?.playerCountry && (
            <p className="player-country-line">
              Pays joue: <strong>{world.playerCountry}</strong>
              {world.playerFactionId ? ` | Bloc: ${factionName(world, world.playerFactionId)}` : ""}
              {world.countryLocked ? " | verrouille pour cette partie" : ""}
            </p>
          )}
        </div>
        <div className="actions">
          <button type="button" onClick={handleResolveTurn} disabled={loading || !world}>Resoudre le tour</button>
          <button type="button" onClick={handleTriggerEvent} disabled={loading || !world}>Declencher un evenement</button>
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
          Ordres restants: {world.actionPoints}/{world.maxActionPoints} (maximum 3 ordres par tour en mode nation)
        </p>
      )}

      {error && <p className="error">Erreur: {error}</p>}

      {world && worldSummary && (
        <section className="metrics-grid">
          <article>
            <h3>Stabilite globale</h3>
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
            <h3>Ordres restants</h3>
            <p>{world.actionPoints}/{world.maxActionPoints}</p>
          </article>
        </section>
      )}

      {world && (
        <section className="world-layout">
          <div className="map-section">
            <h2>Carte Strategique 2D</h2>
            <p className="map-subtitle">
              Projection mondiale pays-reels: couleur = controle/tension/stabilite selon la vue active. Clique un pays pour agir.
            </p>
            <div className="lens-controls">
              <button
                type="button"
                className={mapLens === "control" ? "active" : ""}
                onClick={() => setMapLens("control")}
              >
                Vue controle
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
                Vue stabilite
              </button>
            </div>

            <div className="legend">
              <span className="legend-item stable">Calme</span>
              <span className="legend-item warning">Fragile</span>
              <span className="legend-item danger">Conflit</span>
            </div>

            <WorldGeoMap
              world={world}
              mapLens={mapLens}
              selectedCellId={selectedCellId}
              onSelectCell={setSelectedCellId}
              getOwnerColor={(ownerId) => getOwnerColor(world, ownerId)}
            />
          </div>

          <aside className="details-panel">
            <h3>Commandes nationales</h3>
            <div className="details-block command-panel">
              <p className="command-helper">
                Ecris une decision politique (ex: "Investir en France", "Stabiliser les zones tendues", "Influencer le voisinage").
              </p>
              <textarea
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
                placeholder="Soumettre une action strategique pour ce tour..."
                rows={3}
                disabled={loading || !world || !canQueueMoreActions}
              />
              <div className="actions command-actions">
                <button
                  type="button"
                  onClick={handleSubmitCommand}
                  disabled={loading || !world || !canQueueMoreActions || commandText.trim().length === 0}
                >
                  Soumettre commande
                </button>
                <button
                  type="button"
                  onClick={() => setCommandText("Stabiliser les zones les plus tendues")}
                  disabled={loading || !canQueueMoreActions}
                >
                  Suggestion rapide
                </button>
              </div>
              {world.submittedCommands.length > 0 && (
                <div className="command-list">
                  {world.submittedCommands.slice(-5).reverse().map((command) => (
                    <div key={command.id} className="command-row">
                      <div>
                        <p><strong>{command.text}</strong></p>
                        <p className="command-meta">{command.rationale}</p>
                        <p className={`command-status status-${command.status}`}>Statut: {command.status}</p>
                      </div>
                      {command.status === "queued" && (
                        <button type="button" onClick={() => handleRemoveCommand(command.id)} disabled={loading}>
                          Retirer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h3>Territoire selectionne</h3>
            {selectedCell ? (
              <div className="details-block">
                <p>Coordonnees: ({selectedCell.x}, {selectedCell.y})</p>
                <p>Pays: {selectedCell.country}</p>
                <p>Continent: {selectedCell.continent}</p>
                <p>Faction: {factionName(world, selectedCell.owner)}</p>
                <p>Risque: {getRiskLabel(selectedCell)}</p>
                <p>Richesse: {selectedCell.richness}</p>
                <p>Stabilite: {selectedCell.stability}</p>
                <p>Tensions: {selectedCell.tension}</p>
                <div className="actions territory-actions">
                  <button
                    type="button"
                    onClick={() => handleQueueAction("stabilize")}
                    disabled={loading || !canQueueMoreActions || !canActOnSelectedTerritory}
                  >
                    Stabiliser
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueAction("invest")}
                    disabled={loading || !canQueueMoreActions || !canActOnSelectedTerritory}
                  >
                    Investir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueAction("influence")}
                    disabled={loading || !canQueueMoreActions || !canActOnSelectedTerritory}
                  >
                    Influencer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueAction("disrupt")}
                    disabled={loading || !canQueueMoreActions || !canActOnSelectedTerritory}
                  >
                    Perturber
                  </button>
                </div>
                {!canActOnSelectedTerritory && world.countryLocked && world.playerCountry && (
                  <p className="action-warning">
                    Action bloquee: ce territoire n'est pas controle par {world.playerCountry}.
                  </p>
                )}
                {!canQueueMoreActions && (
                  <p className="action-warning">
                    File d'ordres pleine. Resous le tour pour appliquer les actions.
                  </p>
                )}
              </div>
            ) : (
              <p>Selectionne une zone de la carte.</p>
            )}

            {selectedCell && lastImpact && lastImpact.after.cellId === selectedCell.id && (
              <div className="details-block impact-block">
                <p><strong>Impact recent: {lastImpact.actionLabel}</strong></p>
                <p className={lastImpact.after.richness - lastImpact.before.richness >= 0 ? "delta up" : "delta down"}>
                  Richesse: {lastImpact.before.richness} {"->"} {lastImpact.after.richness}
                </p>
                <p className={lastImpact.after.stability - lastImpact.before.stability >= 0 ? "delta up" : "delta down"}>
                  Stabilite: {lastImpact.before.stability} {"->"} {lastImpact.after.stability}
                </p>
                <p className={lastImpact.after.tension - lastImpact.before.tension <= 0 ? "delta up" : "delta down"}>
                  Tensions: {lastImpact.before.tension} {"->"} {lastImpact.after.tension}
                </p>
                {lastImpact.before.owner !== lastImpact.after.owner && (
                  <p className="delta down">
                    Controle: {factionName(world, lastImpact.before.owner)} {"->"} {factionName(world, lastImpact.after.owner)}
                  </p>
                )}
              </div>
            )}

            <h3>Ordres du tour</h3>
            <div className="details-block queue-block">
              {world.queuedActions.length === 0 ? (
                <p>Aucun ordre soumis pour ce tour.</p>
              ) : (
                world.queuedActions.map((queued) => {
                  const target = world.cells.find((cell) => cell.id === queued.cellId);
                  return (
                    <div key={queued.id} className="queued-row">
                      <p>
                        {playerActionLabel(queued.action)} {"->"}{" "}
                        {target ? `${target.country} (${target.x}, ${target.y})` : queued.cellId}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveQueuedAction(queued.id)}
                        disabled={loading}
                      >
                        Retirer
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <h3>Rapport du dernier tour</h3>
            <div className="details-block report-block">
              {world.lastResolutionReport ? (
                <>
                  <p>
                    Tick {world.lastResolutionReport.tick} | Annee {world.lastResolutionReport.year} | Ordres executes: {world.lastResolutionReport.executedCount}
                  </p>
                  {world.lastResolutionReport.highlights.map((line, index) => (
                    <p key={`${world.lastResolutionReport?.tick ?? 0}-${index}`}>{line}</p>
                  ))}
                </>
              ) : (
                <p>Aucun tour resolu pour le moment.</p>
              )}
            </div>

            <h3>Continents</h3>
            <div className="details-block continent-list">
              {continentOverview.map((continent) => (
                <p key={continent.name}>
                  {continent.name} | {continent.cells} territoires | tension moy. {continent.avgTension}
                </p>
              ))}
            </div>

            <h3>Evenements locaux</h3>
            <div className="event-feed">
              {localEvents.length > 0 ? (
                localEvents.map((evt) => (
                  <article key={evt.id} className="event-item local-event">
                    <strong>{eventTypeLabel(evt.type)} - annee {yearAtEvent(world, evt.tick)} (tick {evt.tick})</strong>
                    <p>{evt.title}</p>
                    <small>{evt.description}</small>
                  </article>
                ))
              ) : (
                <p className="event-empty">Aucun evenement local pour ce territoire.</p>
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

            <h3>Evenements globaux recents</h3>
            <div className="event-feed">
              {world.events.slice(0, 8).map((evt) => (
                <article key={evt.id} className="event-item">
                  <strong>{eventTypeLabel(evt.type)} - annee {yearAtEvent(world, evt.tick)} (tick {evt.tick})</strong>
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
                <p>Genere une narration locale depuis le backend.</p>
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
