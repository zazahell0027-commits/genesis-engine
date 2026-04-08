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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gridStyle = useMemo(() => {
    if (!world) return undefined;
    return { gridTemplateColumns: `repeat(${world.width}, minmax(0, 1fr))` };
  }, [world]);

  async function handleCreate(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const created = await createWorld({ name: "Genesis Demo", width: 10, height: 10, role: "hero" });
      setWorld(created);
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
          <div className="grid" style={gridStyle}>
            {world.cells.map((cell) => (
              <div key={cell.id} className={getCellClass(cell)}>
                <span>{cell.owner.slice(0, 1).toUpperCase()}</span>
                <small>R{cell.richness}</small>
                <small>S{cell.stability}</small>
                <small>T{cell.tension}</small>
              </div>
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
