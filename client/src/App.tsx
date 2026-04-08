import React, { useState } from "react";
import type { World } from "@genesis/shared";
import { createWorld, tickWorld } from "./api";
import "./styles.css";

export default function App(): React.JSX.Element {
  const [world, setWorld] = useState<World | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <section>
        <h2>Monde (JSON)</h2>
        <pre>{JSON.stringify(world, null, 2)}</pre>
      </section>
    </main>
  );
}
