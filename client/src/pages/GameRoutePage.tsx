import React, { useEffect, useState } from "react";
import type { AdvisorResponse, AdvisorSuggestion, GameState, JumpStep, QuickActionKind, TimelineEntry } from "@genesis/shared";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAdvisor,
  getGame,
  jumpForward,
  jumpToMajorEvent,
  queueOrder,
  queueQuickAction,
  removeOrder,
  sendDiplomacy
} from "../api";
import { WorldGeoMap } from "../components/WorldGeoMap";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AvatarIcon,
  CalendarIcon,
  ChatIcon,
  MapIcon,
  MenuIcon,
  SearchIcon,
  SparkIcon,
  formatMoney
} from "../components/Icons";

type OverlayPanel = "events" | "timeline" | "actions" | "chats" | "advisor" | "search" | "menu";
type BusyAction = "order" | "quick-action" | "jump" | "major-event" | "diplomacy" | "advisor" | null;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getBusyCopy(action: BusyAction, targetCountryName?: string): { title: string; detail: string } | null {
  if (action === "order") {
    return {
      title: "Interpreting your order",
      detail: "The local model is turning your text into a concrete strategic action."
    };
  }

  if (action === "quick-action") {
    return {
      title: "Preparing the action",
      detail: targetCountryName
        ? `Queueing a focused move around ${targetCountryName}.`
        : "Queueing a focused move for the next round."
    };
  }

  if (action === "jump") {
    return {
      title: "Simulating the next round",
      detail: "Orders, world pressure, and event text are being resolved together."
    };
  }

  if (action === "major-event") {
    return {
      title: "Searching for the next major event",
      detail: "The simulation is advancing until it hits a major diplomatic or military beat."
    };
  }

  if (action === "diplomacy") {
    return {
      title: "Waiting for a diplomatic reply",
      detail: targetCountryName
        ? `${targetCountryName} is generating a response with the local model.`
        : "The foreign office is preparing an answer."
    };
  }

  if (action === "advisor") {
    return {
      title: "Generating an advisor briefing",
      detail: "The local model is summarizing the current pressure of the world."
    };
  }

  return null;
}

function isQuickActionKind(value: string): value is QuickActionKind {
  return value === "attack" || value === "defend" || value === "stabilize" || value === "invest";
}

export function GameRoutePage(props: {
  onError: (message: string | null) => void;
  onTokenBalanceChange: (value: number | null) => void;
  onRefreshGames: () => Promise<void>;
}): React.JSX.Element {
  const { onError, onRefreshGames, onTokenBalanceChange } = props;
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [panel, setPanel] = useState<OverlayPanel>("events");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [viewedSnapshotId, setViewedSnapshotId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [jumpStep, setJumpStep] = useState<JumpStep>("month");
  const [orderText, setOrderText] = useState("");
  const [diplomacyText, setDiplomacyText] = useState("");
  const [diplomacyTargetId, setDiplomacyTargetId] = useState("");
  const [advisorResponse, setAdvisorResponse] = useState<AdvisorResponse | null>(null);
  const [advisorHistory, setAdvisorHistory] = useState<AdvisorResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const busy = busyAction !== null;

  useEffect(() => {
    const safeGameId = gameId as string | undefined;
    if (!safeGameId) return;
    const currentGameId = safeGameId;

    let cancelled = false;
    async function loadGameState(): Promise<void> {
      setLoading(true);
      setAdvisorResponse(null);
      setAdvisorHistory([]);
      onError(null);
      try {
        const loaded = await getGame(currentGameId);
        if (cancelled) return;
        setGame(loaded);
        setSelectedCountryId((current) => (
          current && loaded.countries.some((country) => country.id === current) ? current : loaded.selectedCountryId
        ));
        setActiveEventId(loaded.eventWindow.activeEventId);
        setJumpStep(loaded.availableJumpOptions[1]?.step ?? loaded.availableJumpOptions[0]?.step ?? "month");
        setViewedSnapshotId(null);
        setDiplomacyTargetId(loaded.countries.find((country) => country.id !== loaded.playerCountryId)?.id ?? loaded.playerCountryId);
        onTokenBalanceChange(loaded.tokenBalance);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Unable to load game");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGameState();
    return () => {
      cancelled = true;
    };
  }, [gameId, onError, onTokenBalanceChange]);

  useEffect(() => () => onTokenBalanceChange(null), [onTokenBalanceChange]);

  async function applyGameUpdate(updated: GameState, nextPanel?: OverlayPanel): Promise<void> {
    setGame(updated);
    setSelectedCountryId((current) => (
      current && updated.countries.some((country) => country.id === current) ? current : updated.selectedCountryId
    ));
    setActiveEventId(updated.eventWindow.activeEventId);
    setViewedSnapshotId((current) => (nextPanel === "events" ? updated.snapshots[updated.snapshots.length - 1]?.id ?? null : current));
    if (nextPanel) setPanel(nextPanel);
    onTokenBalanceChange(updated.tokenBalance);
    await onRefreshGames();
  }

  if (loading || !game) {
    return (
      <main className="game-route">
        <div className="game-loading">Loading world state...</div>
      </main>
    );
  }

  const snapshot = viewedSnapshotId ? game.snapshots.find((entry) => entry.id === viewedSnapshotId) ?? null : null;
  const activeCountries = snapshot?.countries ?? game.countries;
  const selectedCountry = activeCountries.find((country) => country.id === selectedCountryId)
    ?? activeCountries.find((country) => country.id === game.playerCountryId)
    ?? activeCountries[0];
  const windowEvents = game.eventWindow.eventIds
    .map((eventId) => game.events.find((event) => event.id === eventId) ?? null)
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const activeEvent = windowEvents.find((event) => event.id === activeEventId) ?? windowEvents[0] ?? null;
  const snapshotEvents = snapshot
    ? snapshot.eventIds
      .map((eventId) => game.events.find((event) => event.id === eventId) ?? null)
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
    : [];
  const mapContextEvents = snapshot
    ? snapshotEvents
    : windowEvents.length > 0
      ? windowEvents
      : activeEvent
        ? [activeEvent]
        : [];
  const activeEventEffects = activeEvent?.mapEffects ?? [];
  const mapEffects = mapContextEvents.flatMap((event) => event.mapEffects ?? []);
  const highlightedCountryIds = [...new Set(
    mapEffects.flatMap((effect) => [effect.countryId, effect.sourceCountryId]).filter((id): id is string => Boolean(id))
  )];
  const activeConversation = game.diplomacyLog.filter((entry) => entry.targetCountryId === diplomacyTargetId);
  const diplomacyTarget = game.countries.find((country) => country.id === diplomacyTargetId) ?? null;
  const searchMatches = activeCountries.filter((country) => normalize(country.name).includes(normalize(searchQuery))).slice(0, 14);
  const contextQuickActions = selectedCountry && selectedCountry.id !== game.playerCountryId
    ? game.quickActions.filter((action) => action.kind === "attack" || action.kind === "defend")
    : [];
  const visibleQuickActions = selectedCountry?.id === game.playerCountryId
    ? game.quickActions.filter((action) => action.kind === "invest" || action.kind === "stabilize")
    : game.quickActions.filter((action) => action.kind === "attack" || action.kind === "defend");
  const snapshotIndex = viewedSnapshotId ? game.snapshots.findIndex((entry) => entry.id === viewedSnapshotId) : -1;
  const olderSnapshot = snapshotIndex >= 0 ? game.snapshots[snapshotIndex - 1] ?? null : game.snapshots[game.snapshots.length - 1] ?? null;
  const newerSnapshot = snapshotIndex > 0 ? game.snapshots[snapshotIndex + 1] ?? null : null;
  const busyCopy = getBusyCopy(busyAction, diplomacyTarget?.name ?? selectedCountry?.name);

  async function handleQueueOrder(): Promise<void> {
    if (!orderText.trim()) return;
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("order");
    onError(null);
    try {
      const updated = await queueOrder(currentGame.id, orderText.trim());
      setOrderText("");
      await applyGameUpdate(updated, "actions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to queue order");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuickAction(kind: QuickActionKind): Promise<void> {
    if (!selectedCountry) return;
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("quick-action");
    onError(null);
    try {
      const updated = await queueQuickAction(currentGame.id, selectedCountry.id, kind);
      await applyGameUpdate(updated, "actions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to queue quick action");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemoveOrder(orderId: string): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("quick-action");
    onError(null);
    try {
      const updated = await removeOrder(currentGame.id, orderId);
      await applyGameUpdate(updated, "actions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to remove order");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleJump(): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("jump");
    onError(null);
    try {
      const updated = await jumpForward(currentGame.id, jumpStep);
      await applyGameUpdate(updated, "events");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to jump forward");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMajorEvent(): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("major-event");
    onError(null);
    try {
      const updated = await jumpToMajorEvent(currentGame.id);
      await applyGameUpdate(updated, "events");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to jump to major event");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendDiplomacy(): Promise<void> {
    if (!diplomacyText.trim() || !diplomacyTargetId) return;
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("diplomacy");
    onError(null);
    try {
      await sendDiplomacy(currentGame.id, diplomacyTargetId, diplomacyText.trim());
      const updated = await getGame(currentGame.id);
      setDiplomacyText("");
      await applyGameUpdate(updated, "chats");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to send diplomacy");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAdvisor(): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("advisor");
    onError(null);
    try {
      const response = await getAdvisor(currentGame.id);
      const updated = await getGame(currentGame.id);
      setAdvisorResponse(response);
      setAdvisorHistory((current) => [response, ...current.filter((entry) => entry.tick !== response.tick)].slice(0, 8));
      await applyGameUpdate(updated, "advisor");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to load advisor");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAdvisorSuggestion(suggestion: AdvisorSuggestion): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;
    setBusyAction("order");
    onError(null);
    try {
      const updated = suggestion.targetCountryId && isQuickActionKind(suggestion.kind)
        ? await queueQuickAction(currentGame.id, suggestion.targetCountryId, suggestion.kind)
        : await queueOrder(currentGame.id, suggestion.orderText);
      await applyGameUpdate(updated, "actions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to apply advisor action");
    } finally {
      setBusyAction(null);
    }
  }

  function handleMapChangeView(): void {
    if (!activeEvent) return;
    const currentGame = game;
    if (!currentGame) return;
    const matchingSnapshot = [...currentGame.snapshots].reverse().find((entry) => entry.tick === activeEvent.tick);
    setViewedSnapshotId(matchingSnapshot?.id ?? null);
  }

  function handleTimelineSelect(entry: TimelineEntry): void {
    const currentGame = game;
    if (!currentGame) return;
    setViewedSnapshotId(entry.snapshotId);
    const matchingSnapshot = currentGame.snapshots.find((snapshotItem) => snapshotItem.id === entry.snapshotId);
    const matchingEventId = matchingSnapshot?.eventIds[0] ?? null;
    if (matchingEventId) setActiveEventId(matchingEventId);
  }

  function handleOlderSnapshot(): void {
    if (!olderSnapshot) return;
    setViewedSnapshotId(olderSnapshot.id);
  }

  function handleNewerSnapshot(): void {
    if (viewedSnapshotId && newerSnapshot) {
      setViewedSnapshotId(newerSnapshot.id);
      return;
    }

    setViewedSnapshotId(null);
  }

  return (
    <main className="game-route">
      <div className="game-stage">
        <button type="button" className="floating-corner-button" onClick={() => setPanel(panel === "menu" ? "events" : "menu")}>
          <MenuIcon />
        </button>

        <div className="jump-capsule">
          <button
            type="button"
            className="capsule-arrow"
            onClick={viewedSnapshotId ? handleOlderSnapshot : () => setPanel("events")}
            disabled={viewedSnapshotId ? !olderSnapshot : false}
          >
            <ArrowLeftIcon />
          </button>
          <div className="jump-capsule-copy">
            <strong>{snapshot?.displayDate ?? game.displayDate}</strong>
            <span>{snapshot ? `Viewing tick ${snapshot.tick}` : `Live - Tick ${game.tick}`}</span>
          </div>
          <button
            type="button"
            className="capsule-arrow"
            onClick={viewedSnapshotId ? handleNewerSnapshot : handleJump}
            disabled={busy}
          >
            <ArrowRightIcon />
          </button>
        </div>

        <button
          type="button"
          className="timeline-toggle-button"
          aria-label="Chronology"
          onClick={() => setPanel(panel === "timeline" ? "events" : "timeline")}
        >
          <CalendarIcon />
        </button>

        <WorldGeoMap
          countries={activeCountries}
          preset={game.preset}
          selectedCountryId={selectedCountry?.id ?? null}
          mapEffects={mapEffects}
          highlightedCountryIds={highlightedCountryIds}
          onSelectCountry={(countryId) => {
            setSelectedCountryId(countryId);
            setSearchQuery("");
            if (countryId !== game.playerCountryId) {
              setDiplomacyTargetId(countryId);
            }
          }}
        />

        <div className="floating-dock">
          <button type="button" className={`dock-button${panel === "chats" ? " is-active" : ""}`} onClick={() => setPanel("chats")}>
            <ChatIcon />
          </button>
          <button type="button" className={`dock-button${panel === "actions" ? " is-active" : ""}`} onClick={() => setPanel("actions")}>
            <SparkIcon />
          </button>
          <button type="button" className={`dock-button${panel === "search" ? " is-active" : ""}`} onClick={() => setPanel("search")}>
            <SearchIcon />
          </button>
        </div>

        <button type="button" className="floating-profile-button" onClick={() => setPanel("advisor")}>
          <AvatarIcon />
        </button>

        <div className="game-status-pill">
          <span>{selectedCountry?.name ?? game.playerCountryName}</span>
          <strong>{viewedSnapshotId ? "Historical snapshot" : game.preset.title}</strong>
        </div>

        {busyCopy && (
          <div className="game-busy-banner" role="status" aria-live="polite">
            <span className="game-busy-dot" aria-hidden="true" />
            <div>
              <strong>{busyCopy.title}</strong>
              <span>{busyCopy.detail}</span>
            </div>
          </div>
        )}

        {selectedCountry && contextQuickActions.length > 0 && (
          <div className="context-quick-strip">
            {contextQuickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`context-quick-button kind-${action.kind}`}
                onClick={() => handleQuickAction(action.kind)}
                disabled={busy}
              >
                <strong>{action.label}</strong>
                <span>{selectedCountry.name}</span>
              </button>
            ))}
          </div>
        )}

        {panel === "events" && (
          <section className="overlay-panel events-panel">
            <div className="overlay-heading">
              <div>
                <h2>{game.eventWindow.title}</h2>
                <p>{game.eventWindow.rangeLabel}</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("actions")}>x</button>
            </div>

            {activeEvent ? (
              <>
                <div className="event-badges">
                  {activeEvent.locationLabel && <span>{activeEvent.locationLabel}</span>}
                  {activeEvent.factionLabel && <span>{activeEvent.factionLabel}</span>}
                </div>
                <h3>{activeEvent.title}</h3>
                <p className="event-description">{activeEvent.description}</p>
                {activeEventEffects.length > 0 ? (
                  <div className="event-impact-list">
                    {activeEventEffects.slice(0, 8).map((effect) => (
                      <article key={effect.id} className={`event-impact-chip kind-${effect.kind}`}>
                        <strong>{effect.kind.toUpperCase()}</strong>
                        <span>{effect.label}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="event-impact-empty">No direct visual map impact is recorded for this event.</div>
                )}
                <button type="button" className="secondary-button map-change-button" onClick={handleMapChangeView}>
                  <MapIcon />
                  <span>View Map Changes</span>
                </button>
                <div className="event-footer">
                  <span><CalendarIcon /> {activeEvent.dateLabel}</span>
                  <span>{activeEvent.mapChangeSummary ?? "No map summary recorded."}</span>
                </div>
              </>
            ) : (
              <div className="empty-panel">No event window is available yet. Jump forward to generate a world update.</div>
            )}

            {windowEvents.length > 0 && (
              <div className="event-list">
                {windowEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`event-card${activeEventId === event.id ? " is-active" : ""}`}
                    onClick={() => setActiveEventId(event.id)}
                  >
                    <strong>{event.dateLabel}</strong>
                    <span>{event.title}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {panel === "timeline" && (
          <aside className="timeline-panel">
            <div className="overlay-heading">
              <div>
                <h2>Chronology</h2>
                <p>{snapshot ? "Viewing historical snapshot" : "Latest resolved rounds"}</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>
            <div className="timeline-list">
              {game.timeline.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`timeline-card tone-${entry.tone}${viewedSnapshotId === entry.snapshotId ? " is-active" : ""}`}
                  onClick={() => handleTimelineSelect(entry)}
                >
                  <span>{entry.displayDate}</span>
                  <strong>{entry.title}</strong>
                  <p>{entry.subtitle}</p>
                </button>
              ))}
            </div>
            <div className="timeline-actions">
              <button type="button" className="secondary-button" onClick={() => setViewedSnapshotId(null)}>
                Return to Live Map
              </button>
              <button type="button" className="primary-button" onClick={handleMajorEvent} disabled={busy}>
                {busyAction === "major-event" ? "Searching..." : "To Next Major Event"}
              </button>
            </div>
          </aside>
        )}

        {panel === "actions" && (
          <section className="overlay-panel side-panel">
            <div className="overlay-heading">
              <div>
                <h2>Actions</h2>
                <p>{`${game.actionPoints}/${game.maxActionPoints} action points available`}</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>

            {selectedCountry && (
              <div className="selected-country-card">
                <strong>{selectedCountry.name}</strong>
                <span>{selectedCountry.descriptor}</span>
                <span>{`Power ${selectedCountry.power} | Stability ${selectedCountry.stability} | Tension ${selectedCountry.tension}`}</span>
                <span>{`Army ${selectedCountry.army} | Industry ${selectedCountry.industry} | Fortification ${selectedCountry.fortification} | Unrest ${selectedCountry.unrest}`}</span>
              </div>
            )}

            <textarea
              value={orderText}
              onChange={(event) => setOrderText(event.target.value)}
              rows={5}
              className="large-textarea"
              placeholder="Write a concrete action: military plan, domestic reform, alliance offer, or economic push."
            />

            <div className="quick-action-row">
              {visibleQuickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action-card"
                  onClick={() => handleQuickAction(action.kind)}
                  disabled={busy}
                >
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </button>
              ))}
            </div>

            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={handleQueueOrder} disabled={busy || !orderText.trim()}>
                {busyAction === "order" ? "Interpreting..." : "Queue Order"}
              </button>
              <button type="button" className="secondary-button" onClick={handleJump} disabled={busy}>
                {busyAction === "jump" ? "Simulating..." : "Jump Forward"}
              </button>
            </div>

            <div className="queued-orders">
              {game.queuedOrders.length === 0 && <div className="empty-panel">No orders queued for the next round.</div>}
              {game.queuedOrders.map((order) => (
                <article key={order.id} className="order-card">
                  <div>
                    <strong>{order.kind.toUpperCase()}</strong>
                    <span>{order.text}</span>
                  </div>
                  <button type="button" className="text-button" onClick={() => handleRemoveOrder(order.id)} disabled={busy}>
                    Remove
                  </button>
                </article>
              ))}
            </div>

            {game.lastRoundSummary && (
              <div className="round-summary-card">
                <strong>Last round</strong>
                <span>{game.lastRoundSummary.displayDate}</span>
                {game.lastRoundSummary.highlights.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {panel === "chats" && (
          <section className="overlay-panel side-panel">
            <div className="overlay-heading">
              <div>
                <h2>Chats</h2>
                <p>Text diplomacy remains one of the strongest levers in the simulation.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>

            <label className="field-block">
              <span>Target nation</span>
              <select value={diplomacyTargetId} onChange={(event) => setDiplomacyTargetId(event.target.value)}>
                {game.countries
                  .filter((country) => country.id !== game.playerCountryId)
                  .map((country) => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
              </select>
            </label>

            <div className="chat-thread">
              {busyAction === "diplomacy" && diplomacyText.trim() && diplomacyTarget && (
                <article className="chat-card stance-neutral is-pending">
                  <strong>Awaiting reply</strong>
                  <p>{`You: ${diplomacyText.trim()}`}</p>
                  <p>{`${diplomacyTarget.name}: Generating a response...`}</p>
                </article>
              )}
              {activeConversation.length === 0 && (
                <div className="empty-panel">No exchanges yet with this country. Open with a concrete demand, offer, or warning.</div>
              )}
              {activeConversation.map((entry) => (
                <article key={entry.id} className={`chat-card stance-${entry.stance}`}>
                  <strong>{entry.dateLabel}</strong>
                  <p>{`You: ${entry.message}`}</p>
                  <p>{`${entry.targetCountryName}: ${entry.reply}`}</p>
                </article>
              ))}
            </div>

            <textarea
              value={diplomacyText}
              onChange={(event) => setDiplomacyText(event.target.value)}
              rows={4}
              className="large-textarea"
              placeholder="Offer terms, threaten consequences, ask for recognition, or propose a pact."
            />

            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={handleSendDiplomacy} disabled={busy || !diplomacyText.trim()}>
                {busyAction === "diplomacy" ? "Negotiating..." : "Send Message"}
              </button>
            </div>
          </section>
        )}

        {panel === "advisor" && (
          <section className="overlay-panel side-panel advisor-panel">
            <div className="overlay-heading">
              <div>
                <h2>Advisor</h2>
                <p>Contextual guidance for the current round and world pressure.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>

            <div className="advisor-summary">
              <strong>{game.displayDate}</strong>
              <span>{`${game.preset.title} | ${game.playerCountryName}`}</span>
            </div>

            {advisorResponse ? (
              <article className="advisor-card">
                <strong>{advisorResponse.dateLabel}</strong>
                <p>{advisorResponse.narrative}</p>
              </article>
            ) : (
              <div className="empty-panel">No advisor briefing cached yet. Generate one for the current world state.</div>
            )}

            {advisorResponse && advisorResponse.insights.length > 0 && (
              <div className="advisor-insights">
                {advisorResponse.insights.map((insight) => (
                  <p key={insight} className="advisor-insight-line">{insight}</p>
                ))}
              </div>
            )}

            {advisorResponse && advisorResponse.suggestions.length > 0 && (
              <div className="advisor-suggestion-list">
                {advisorResponse.suggestions.map((suggestion) => (
                  <article key={suggestion.id} className={`advisor-suggestion-card urgency-${suggestion.urgency}`}>
                    <div className="advisor-suggestion-header">
                      <strong>{suggestion.label}</strong>
                      <span>{suggestion.urgency.toUpperCase()}</span>
                    </div>
                    <p>{suggestion.rationale}</p>
                    <p>{suggestion.impact}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        void handleAdvisorSuggestion(suggestion);
                      }}
                      disabled={busy}
                    >
                      Queue this action
                    </button>
                  </article>
                ))}
              </div>
            )}

            {busyAction === "advisor" && (
              <article className="advisor-card is-pending">
                <strong>{game.displayDate}</strong>
                <p>Generating a new briefing from the current world pressure...</p>
              </article>
            )}

            {advisorHistory.length > 1 && (
              <div className="advisor-history-list">
                {advisorHistory.slice(1, 4).map((entry) => (
                  <article key={`${entry.tick}-${entry.dateLabel}`} className="advisor-history-card">
                    <strong>{entry.dateLabel}</strong>
                    <p>{entry.narrative}</p>
                  </article>
                ))}
              </div>
            )}

            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={handleAdvisor} disabled={busy}>
                {busyAction === "advisor" ? "Thinking..." : "Generate Briefing"}
              </button>
            </div>
          </section>
        )}

        {panel === "search" && (
          <section className="overlay-panel search-panel">
            <div className="overlay-heading">
              <div>
                <h2>Search Countries</h2>
                <p>Jump directly to a nation and make it the current focus.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>

            <label className="field-block">
              <span>Search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="France, Russia, Brazil..."
              />
            </label>

            <div className="country-list compact">
              {searchMatches.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  className={`country-row${selectedCountry?.id === country.id ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedCountryId(country.id);
                    if (country.id !== game.playerCountryId) {
                      setDiplomacyTargetId(country.id);
                    }
                    setPanel("actions");
                  }}
                >
                  <strong>{country.name}</strong>
                  <span>{country.descriptor}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {panel === "menu" && (
          <section className="overlay-panel menu-panel">
            <div className="overlay-heading">
              <div>
                <h2>Advanced Menu</h2>
                <p>Session context, jump controls, and quick navigation.</p>
              </div>
              <button type="button" className="close-button" onClick={() => setPanel("events")}>x</button>
            </div>

            <div className="menu-grid">
              <article className="menu-card">
                <strong>{game.preset.title}</strong>
                <span>{`${game.difficulty} difficulty | ${game.aiQuality} A.I.`}</span>
              </article>
              <article className="menu-card">
                <strong>{formatMoney(game.tokenBalance)}</strong>
                <span>Remaining token balance</span>
              </article>
            </div>

            <label className="field-block">
              <span>Jump pace</span>
              <select value={jumpStep} onChange={(event) => setJumpStep(event.target.value as JumpStep)}>
                {game.availableJumpOptions.map((option) => (
                  <option key={option.step} value={option.step}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={handleJump} disabled={busy}>
                {busyAction === "jump" ? "Simulating..." : "Jump Forward"}
              </button>
              <button type="button" className="secondary-button" onClick={handleMajorEvent} disabled={busy}>
                {busyAction === "major-event" ? "Searching..." : "To Next Major Event"}
              </button>
            </div>

            <button type="button" className="text-button" onClick={() => navigate("/presets")}>
              Return to Presets
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
