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
import { createDemoWorld, createWorld, tickWorld, triggerWorldEvent } from "./api";
import "./styles.css";

type ViewMode = "landing" | "world";

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

const ownerPalette = ["#1D4ED8", "#BE123C", "#047857", "#7C3AED", "#C2410C", "#0F766E"];

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

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [world, setWorld] = useState<World | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFormState>({
    name: "Genesis Demo",
    kind: "fictional",
    complexity: "medium",
    role: "hero",
    mapSize: "medium"
  });

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

  async function hydrateWorld(created: World): Promise<void> {
    setWorld(created);
    setSelectedCellId(created.cells[0]?.id ?? null);
    setViewMode("world");
    setShowJson(false);
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
      const updated = await tickWorld(world.id);
      setWorld(updated);
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
            <h2>Carte 2D (territoires)</h2>
            <div className="legend">
              <span className="legend-item stable">Calme</span>
              <span className="legend-item warning">Fragile</span>
              <span className="legend-item danger">Conflit</span>
            </div>

            <div className="grid" style={gridStyle}>
              {world.cells.map((cell) => {
                const ownerIndex = world.factions.findIndex((faction) => faction.id === cell.owner);
                const ownerColor = ownerPalette[(ownerIndex + ownerPalette.length) % ownerPalette.length] ?? "#334155";

                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => setSelectedCellId(cell.id)}
                    className={`${getCellClass(cell)}${selectedCellId === cell.id ? " selected" : ""}`}
                    aria-label={`Cell ${cell.x},${cell.y}`}
                    aria-pressed={selectedCellId === cell.id}
                    style={{ "--owner-color": ownerColor } as React.CSSProperties}
                  >
                    <div className="cell-owner-dot" />
                    <div className="cell-coords">({cell.x}, {cell.y})</div>
                    <small>R {cell.richness}</small>
                    <small>S {cell.stability}</small>
                    <small>T {cell.tension}</small>
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
                <p>Faction: {factionName(world, selectedCell.owner)}</p>
                <p>Risque: {getRiskLabel(selectedCell)}</p>
                <p>Richesse: {selectedCell.richness}</p>
                <p>Stabilité: {selectedCell.stability}</p>
                <p>Tensions: {selectedCell.tension}</p>
              </div>
            ) : (
              <p>Sélectionne une case de la grille.</p>
            )}

            <h3>Factions</h3>
            <div className="details-block">
              {world.factions.map((faction) => (
                <p key={faction.id}>
                  {faction.name} | P{faction.power} | R{faction.resources}
                </p>
              ))}
            </div>

            <h3>Événements récents</h3>
            <div className="event-feed">
              {world.events.slice(0, 8).map((evt) => (
                <article key={evt.id} className="event-item">
                  <strong>{eventTypeLabel(evt.type)} - tick {evt.tick}</strong>
                  <p>{evt.title}</p>
                  <small>{evt.description}</small>
                </article>
              ))}
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
