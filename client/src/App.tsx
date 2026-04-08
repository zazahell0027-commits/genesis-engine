import React, { useMemo, useState } from "react";
import type { WorldCell, World } from "@genesis/shared";
import { createWorld, tickWorld } from "./api";
import "./styles.css";

type WorldSummary = {
  avgRichness: number;
  avgStability: number;
  avgTension: number;
  highTensionCount: number;
  lowStabilityCount: number;
};

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

export default function App(): React.JSX.Element {
  const [world, setWorld] = useState<World | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreate(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const created = await createWorld({ name: "Genesis Demo", width: 10, height: 10, role: "hero" });
      setWorld(created);
      setSelectedCellId(created.cells[0]?.id ?? null);
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

  return (
    <main className="container">
      <h1>Genesis Engine - MVP</h1>
      <p>Socle minimal: create world + tick simulation.</p>

      <div className="actions">
        <button type="button" onClick={handleCreate} disabled={loading}>Créer un monde</button>
        <button type="button" onClick={handleTick} disabled={loading || !world}>Avancer le temps</button>
        {world && (
          <button type="button" onClick={() => setShowJson((prev) => !prev)}>
            {showJson ? "Masquer JSON" : "Afficher JSON"}
          </button>
        )}
      </div>

      {error && <p className="error">Erreur: {error}</p>}

      {world && (
        <section className="world-layout">
          <div>
            <h2>Carte (grille simple)</h2>
            <p>Tick: {world.tick} | Taille: {world.width}x{world.height}</p>
            <div className="legend">
              <span className="legend-item stable">Calme</span>
              <span className="legend-item warning">Fragile</span>
              <span className="legend-item danger">Conflit</span>
            </div>

            <div className="grid" style={gridStyle}>
              {world.cells.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => setSelectedCellId(cell.id)}
                  className={`${getCellClass(cell)}${selectedCellId === cell.id ? " selected" : ""}`}
                  aria-label={`Cell ${cell.x},${cell.y}`}
                  aria-pressed={selectedCellId === cell.id}
                >
                  <div className="cell-coords">({cell.x}, {cell.y})</div>
                  <small>R {cell.richness}</small>
                  <small>S {cell.stability}</small>
                  <small>T {cell.tension}</small>
                </button>
              ))}
            </div>
          </div>

          <aside className="details-panel">
            <h3>Territoire sélectionné</h3>
            {selectedCell ? (
              <div className="details-block">
                <p>Coordonnées: ({selectedCell.x}, {selectedCell.y})</p>
                <p>Owner: {selectedCell.owner}</p>
                <p>Risque: {getRiskLabel(selectedCell)}</p>
                <p>Richesse: {selectedCell.richness}</p>
                <p>Stabilité: {selectedCell.stability}</p>
                <p>Tensions: {selectedCell.tension}</p>
              </div>
            ) : (
              <p>Sélectionne une case de la grille.</p>
            )}

            {worldSummary && (
              <>
                <h3>Résumé monde</h3>
                <div className="details-block">
                  <p>Richesse moyenne: {worldSummary.avgRichness}</p>
                  <p>Stabilité moyenne: {worldSummary.avgStability}</p>
                  <p>Tensions moyennes: {worldSummary.avgTension}</p>
                  <p>Zones en conflit: {worldSummary.highTensionCount}</p>
                  <p>Zones fragiles: {worldSummary.lowStabilityCount}</p>
                </div>
              </>
            )}
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
