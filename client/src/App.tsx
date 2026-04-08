import React, { useMemo, useState } from "react";
import type { WorldCell, World } from "@genesis/shared";
import { createWorld, tickWorld } from "./api";
import "./styles.css";

function getCellClass(cell: WorldCell): string {
  if (cell.tension > 65) return "cell danger";
  if (cell.stability < 35) return "cell warning";
  return "cell stable";
}

export default function App(): React.JSX.Element {
  const [world, setWorld] = useState<World | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
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
        <button onClick={handleCreate} disabled={loading}>Créer un monde</button>
        <button onClick={handleTick} disabled={loading || !world}>Avancer le temps</button>
      </div>

      {error && <p className="error">Erreur: {error}</p>}

      {world && (
        <section>
          <h2>Carte (grille simple)</h2>
          <p>Tick: {world.tick} | Taille: {world.width}x{world.height}</p>
          {selectedCell && (
            <p className="selected-info">
              Territoire sélectionné: ({selectedCell.x}, {selectedCell.y}) | Owner: {selectedCell.owner} | R
              {selectedCell.richness} | S{selectedCell.stability} | T{selectedCell.tension}
            </p>
          )}
          <div className="grid" style={gridStyle}>
            {world.cells.map((cell) => (
              <button
                key={cell.id}
                type="button"
                onClick={() => setSelectedCellId(cell.id)}
                className={`${getCellClass(cell)}${selectedCellId === cell.id ? " selected" : ""}`}
                aria-label={`Cell ${cell.x},${cell.y}`}
              >
                <span>{cell.owner.slice(0, 1).toUpperCase()}</span>
                <small>R{cell.richness}</small>
                <small>S{cell.stability}</small>
                <small>T{cell.tension}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Monde (JSON)</h2>
        <pre>{JSON.stringify(world, null, 2)}</pre>
      </section>
    </main>
  );
}
