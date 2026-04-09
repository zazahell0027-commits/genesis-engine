import React, { useEffect, useMemo, useState } from "react";
import type { CountryDescriptor, GameEvent, GameState, JumpStep, ScenarioDescriptor } from "@genesis/shared";
import {
  getAdvisor,
  getCountries,
  getGame,
  getScenarios,
  jumpForward,
  jumpToMajorEvent,
  queueOrder,
  removeOrder,
  sendDiplomacy,
  startGame
} from "./api";
import { WorldGeoMap } from "./components/WorldGeoMap";
import "./styles.css";

type ViewMode = "setup" | "game";
type MapLens = "bloc" | "tension" | "stability";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function eventBadge(type: GameEvent["type"]): string {
  if (type.startsWith("major_")) return "major";
  if (type === "diplomacy") return "diplomacy";
  if (type === "order") return "order";
  return "system";
}

function eventLabel(type: GameEvent["type"]): string {
  if (type === "major_diplomacy") return "Major Diplomacy";
  if (type === "major_crisis") return "Major Crisis";
  if (type === "major_conflict") return "Major Conflict";
  if (type === "major_growth") return "Major Growth";
  if (type === "diplomacy") return "Diplomacy";
  if (type === "order") return "Order";
  return "System";
}

const jumpSteps: Array<{ value: JumpStep; label: string }> = [
  { value: "week", label: "1 week" },
  { value: "month", label: "1 month" },
  { value: "quarter", label: "1 quarter" },
  { value: "year", label: "1 year" }
];

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const [scenarios, setScenarios] = useState<ScenarioDescriptor[]>([]);
  const [countries, setCountries] = useState<CountryDescriptor[]>([]);
  const [scenarioId, setScenarioId] = useState("earth-2010");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryId, setCountryId] = useState("france");
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [mapLens, setMapLens] = useState<MapLens>("bloc");
  const [jumpStep, setJumpStep] = useState<JumpStep>("month");
  const [orderText, setOrderText] = useState("");
  const [diplomacyTargetId, setDiplomacyTargetId] = useState("");
  const [diplomacyText, setDiplomacyText] = useState("");
  const [advisorText, setAdvisorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const loadedScenarios = await getScenarios();
        setScenarios(loadedScenarios);
        const activeScenarioId = loadedScenarios[0]?.id ?? "earth-2010";
        setScenarioId(activeScenarioId);
        const loadedCountries = await getCountries(activeScenarioId);
        setCountries(loadedCountries);
        setCountryId(loadedCountries[0]?.id ?? "france");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load setup data");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    async function refreshCountries(): Promise<void> {
      if (!scenarioId) return;
      try {
        const loadedCountries = await getCountries(scenarioId);
        setCountries(loadedCountries);
        if (!loadedCountries.some((country) => country.id === countryId)) {
          setCountryId(loadedCountries[0]?.id ?? "france");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load countries");
      }
    }

    void refreshCountries();
  }, [scenarioId]);

  useEffect(() => {
    if (!game) return;

    if (!selectedCountryId || !game.countries.some((country) => country.id === selectedCountryId)) {
      setSelectedCountryId(game.playerCountryId);
    }

    if (!diplomacyTargetId || !game.countries.some((country) => country.id === diplomacyTargetId)) {
      const fallback = game.countries.find((country) => country.id !== game.playerCountryId)?.id ?? game.playerCountryId;
      setDiplomacyTargetId(fallback);
    }
  }, [game, diplomacyTargetId, selectedCountryId]);

  const filteredCountries = useMemo(() => {
    const query = normalize(countrySearch);
    if (!query) return countries;
    return countries.filter((country) => normalize(country.name).includes(query));
  }, [countries, countrySearch]);

  const selectedCountry = useMemo(() => {
    if (!game || !selectedCountryId) return null;
    return game.countries.find((country) => country.id === selectedCountryId) ?? null;
  }, [game, selectedCountryId]);

  async function handleStartGame(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const created = await startGame(scenarioId as "earth-2010", countryId);
      setGame(created);
      setSelectedCountryId(created.playerCountryId);
      setViewMode("game");
      setAdvisorText("");
      setOrderText("");
      setDiplomacyText("");
      const fallback = created.countries.find((country) => country.id !== created.playerCountryId)?.id ?? created.playerCountryId;
      setDiplomacyTargetId(fallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start game");
    } finally {
      setLoading(false);
    }
  }

  async function refreshGame(gameId: string): Promise<void> {
    const updated = await getGame(gameId);
    setGame(updated);
  }

  async function handleQueueOrder(): Promise<void> {
    if (!game) return;
    const text = orderText.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await queueOrder(game.id, text);
      setGame(updated);
      setOrderText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue order");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveOrder(orderId: string): Promise<void> {
    if (!game) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await removeOrder(game.id, orderId);
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove order");
    } finally {
      setLoading(false);
    }
  }

  async function handleJumpForward(): Promise<void> {
    if (!game) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await jumpForward(game.id, jumpStep);
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to jump forward");
    } finally {
      setLoading(false);
    }
  }

  async function handleMajorEventJump(): Promise<void> {
    if (!game) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await jumpToMajorEvent(game.id);
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to jump to major event");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendDiplomacy(): Promise<void> {
    if (!game) return;
    const message = diplomacyText.trim();
    if (!message || !diplomacyTargetId) return;

    setLoading(true);
    setError(null);
    try {
      await sendDiplomacy(game.id, diplomacyTargetId, message);
      await refreshGame(game.id);
      setDiplomacyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send diplomacy message");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvisor(): Promise<void> {
    if (!game) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getAdvisor(game.id);
      setAdvisorText(response.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to get advisor output");
    } finally {
      setLoading(false);
    }
  }

  if (viewMode === "setup") {
    return (
      <main className="container">
        <section className="hero">
          <h1>Genesis Engine</h1>
          <p>Fresh rebuild: scenario to country to text orders to jump to consequences.</p>
          {error && <p className="error">Error: {error}</p>}

          <form className="setup-form" onSubmit={handleStartGame}>
            <label>
              Scenario
              <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search country
              <input
                type="search"
                placeholder="France, Luxembourg, Liechtenstein..."
                value={countrySearch}
                onChange={(event) => setCountrySearch(event.target.value)}
              />
            </label>

            <label className="country-picker">
              Play as ({filteredCountries.length} countries)
              <select size={12} value={countryId} onChange={(event) => setCountryId(event.target.value)}>
                {filteredCountries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name} ({country.continent})
                  </option>
                ))}
              </select>
            </label>

            <div className="actions">
              <button type="submit" disabled={loading || !countryId}>Start game</button>
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
          <h1>{game?.scenarioName}</h1>
          <p>
            Date: {game?.month}/{game?.year} | Tick {game?.tick} | Player: {game?.playerCountryName}
          </p>
        </div>
        <div className="actions">
          <label className="jump-control">
            Jump
            <select value={jumpStep} onChange={(event) => setJumpStep(event.target.value as JumpStep)}>
              {jumpSteps.map((step) => (
                <option key={step.value} value={step.value}>{step.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleJumpForward} disabled={loading}>Jump Forward</button>
          <button type="button" onClick={handleMajorEventJump} disabled={loading}>Next Major Event</button>
          <button type="button" onClick={handleAdvisor} disabled={loading}>Advisor</button>
          <button type="button" onClick={() => setViewMode("setup")}>Back</button>
        </div>
      </header>

      {error && <p className="error">Error: {error}</p>}

      {game && (
        <section className="metrics-grid">
          <article>
            <h3>Stability</h3>
            <p>{game.indicators.avgStability}</p>
          </article>
          <article>
            <h3>Wealth</h3>
            <p>{game.indicators.avgWealth}</p>
          </article>
          <article>
            <h3>Tension</h3>
            <p>{game.indicators.avgTension}</p>
          </article>
          <article>
            <h3>Conflict</h3>
            <p>{game.indicators.conflictLevel}</p>
          </article>
          <article>
            <h3>Action points</h3>
            <p>{game.actionPoints}/{game.maxActionPoints}</p>
          </article>
        </section>
      )}

      {game && (
        <section className="world-layout">
          <section className="map-section">
            <h2>Strategic World Map</h2>
            <p className="map-subtitle">Text orders are the primary control. The map is your situational reading surface.</p>
            <div className="lens-controls">
              <button type="button" className={mapLens === "bloc" ? "active" : ""} onClick={() => setMapLens("bloc")}>Bloc view</button>
              <button type="button" className={mapLens === "tension" ? "active" : ""} onClick={() => setMapLens("tension")}>Tension view</button>
              <button type="button" className={mapLens === "stability" ? "active" : ""} onClick={() => setMapLens("stability")}>Stability view</button>
            </div>
            <WorldGeoMap
              game={game}
              lens={mapLens}
              selectedCountryId={selectedCountryId}
              onSelectCountry={setSelectedCountryId}
            />
          </section>

          <aside className="details-panel">
            <h3>Selected country</h3>
            {selectedCountry ? (
              <div className="details-block">
                <p><strong>{selectedCountry.name}</strong></p>
                <p>Continent: {selectedCountry.continent}</p>
                <p>Bloc: {selectedCountry.bloc}</p>
                <p>Wealth: {selectedCountry.wealth}</p>
                <p>Stability: {selectedCountry.stability}</p>
                <p>Tension: {selectedCountry.tension}</p>
                <p>Relation to player: {selectedCountry.relationToPlayer}</p>
              </div>
            ) : (
              <p>Select a country on the map.</p>
            )}

            <h3>Text orders</h3>
            <div className="details-block command-panel">
              <p className="help-text">Write a concrete order. Example: "Invest in Poland and secure infrastructure".</p>
              <textarea
                value={orderText}
                onChange={(event) => setOrderText(event.target.value)}
                rows={3}
                placeholder="Type your strategic order..."
                disabled={loading}
              />
              <div className="actions command-actions">
                <button type="button" onClick={handleQueueOrder} disabled={loading || orderText.trim().length === 0}>Queue order</button>
                <button type="button" onClick={() => setOrderText("Stabilize internal security and reduce unrest in border regions")}>Quick fill</button>
              </div>
              {game.queuedOrders.length > 0 ? (
                <div className="list-stack">
                  {game.queuedOrders.map((order) => (
                    <article key={order.id} className="row-item">
                      <p><strong>{order.kind.toUpperCase()}</strong> {"->"} {order.targetCountryId}</p>
                      <p>{order.text}</p>
                      <button type="button" onClick={() => handleRemoveOrder(order.id)} disabled={loading}>Remove</button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="help-text">No order queued for this round.</p>
              )}
            </div>

            <h3>Diplomacy</h3>
            <div className="details-block command-panel">
              <label>
                Target country
                <select value={diplomacyTargetId} onChange={(event) => setDiplomacyTargetId(event.target.value)}>
                  {game.countries
                    .filter((country) => country.id !== game.playerCountryId)
                    .map((country) => (
                      <option key={country.id} value={country.id}>{country.name}</option>
                    ))}
                </select>
              </label>
              <textarea
                value={diplomacyText}
                onChange={(event) => setDiplomacyText(event.target.value)}
                rows={3}
                placeholder="Send a diplomatic message..."
                disabled={loading}
              />
              <div className="actions command-actions">
                <button type="button" onClick={handleSendDiplomacy} disabled={loading || diplomacyText.trim().length === 0}>Send diplomacy</button>
              </div>
              {game.diplomacyLog.length > 0 && (
                <div className="list-stack">
                  {game.diplomacyLog.slice(0, 4).map((entry) => (
                    <article key={entry.id} className="row-item">
                      <p><strong>{entry.targetCountryName}</strong> | {entry.stance}</p>
                      <p>You: {entry.message}</p>
                      <p>Reply: {entry.reply}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <h3>Last round</h3>
            <div className="details-block">
              {game.lastRoundSummary ? (
                <>
                  <p>Tick {game.lastRoundSummary.tick} | {game.lastRoundSummary.month}/{game.lastRoundSummary.year}</p>
                  <p>Applied orders: {game.lastRoundSummary.appliedOrders}</p>
                  {game.lastRoundSummary.highlights.map((line, index) => (
                    <p key={`${game.lastRoundSummary?.tick ?? 0}-${index}`}>{line}</p>
                  ))}
                </>
              ) : (
                <p>No round resolved yet.</p>
              )}
            </div>

            <h3>Recent events</h3>
            <div className="event-feed">
              {game.events.slice(0, 10).map((event) => (
                <article key={event.id} className={`event-item ${eventBadge(event.type)}`}>
                  <strong>{eventLabel(event.type)} | {event.month}/{event.year}</strong>
                  <p>{event.title}</p>
                  <small>{event.description}</small>
                </article>
              ))}
            </div>

            <h3>Advisor</h3>
            <div className="details-block">
              {advisorText ? <p>{advisorText}</p> : <p>Ask advisor for a strategic briefing.</p>}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
