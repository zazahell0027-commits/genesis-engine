import React, { useEffect, useState } from "react";
import type { AdvisorResponse, AdvisorSuggestion, GameEvent, GameState, JumpStep, QuickActionKind, TimelineEntry } from "@genesis/shared";
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
import { OverlayHeading } from "../features/game/ui/OverlayHeading";

type OverlayPanel = "events" | "actions" | "chats" | "search" | "menu" | "none";
type RightPanel = "advisor" | "timeline" | "none";
type BusyAction = "order" | "quick-action" | "jump" | "major-event" | "diplomacy" | "advisor" | null;

type MapFocus = {
  countryIds: string[];
  provinceIds: string[];
  token: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueIds(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}

function extractEventFocus(event: GameEvent | null): { countryIds: string[]; provinceIds: string[] } {
  if (!event) return { countryIds: [], provinceIds: [] };
  const inferredCountryIds = event.mapEffects
    ? event.mapEffects.flatMap((effect) => [effect.countryId, effect.sourceCountryId])
    : [];
  return {
    countryIds: uniqueIds([
      event.countryId,
      ...(event.mapFocusCountryIds ?? []),
      ...inferredCountryIds
    ]),
    provinceIds: uniqueIds(event.mapFocusProvinceIds ?? [])
  };
}

function getBusyCopy(action: BusyAction, targetCountryName?: string): { title: string; detail: string } | null {
  if (action === "order") {
    return {
      title: "Interpretation de l'ordre",
      detail: "Le modele local transforme votre texte en action strategique."
    };
  }

  if (action === "quick-action") {
    return {
      title: "Preparation de l'action rapide",
      detail: targetCountryName
        ? `Mise en file d'une action ciblee sur ${targetCountryName}.`
        : "Mise en file d'une action pour le prochain round."
    };
  }

  if (action === "jump") {
    return {
      title: "Simulation du round",
      detail: "Ordres, pression mondiale et evenements sont en cours de resolution."
    };
  }

  if (action === "major-event") {
    return {
      title: "Recherche d'un evenement majeur",
      detail: "La simulation avance jusqu'a trouver un point diplomatique ou militaire fort."
    };
  }

  if (action === "diplomacy") {
    return {
      title: "Reponse diplomatique en attente",
      detail: targetCountryName
        ? `${targetCountryName} genere une reponse via le modele local.`
        : "Le ministere des affaires etrangeres prepare une reponse."
    };
  }

  if (action === "advisor") {
    return {
      title: "Analyse du conseiller",
      detail: "Le conseiller local synthetise les tensions du round."
    };
  }

  return null;
}

function isQuickActionKind(value: string): value is QuickActionKind {
  return value === "attack" || value === "defend" || value === "stabilize" || value === "invest";
}

function isTextInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
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
  const [panel, setPanel] = useState<OverlayPanel>("actions");
  const [rightPanel, setRightPanel] = useState<RightPanel>("advisor");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [viewedSnapshotId, setViewedSnapshotId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [jumpStep, setJumpStep] = useState<JumpStep>("month");
  const [orderText, setOrderText] = useState("");
  const [diplomacyText, setDiplomacyText] = useState("");
  const [diplomacyTargetId, setDiplomacyTargetId] = useState("");
  const [advisorResponse, setAdvisorResponse] = useState<AdvisorResponse | null>(null);
  const [advisorHistory, setAdvisorHistory] = useState<AdvisorResponse[]>([]);
  const [advisorPrompt, setAdvisorPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapFocus, setMapFocus] = useState<MapFocus>({ countryIds: [], provinceIds: [], token: 0 });
  const compactHudQuery = "(max-width: 1500px), (max-height: 820px)";
  const [isCompactHud, setIsCompactHud] = useState<boolean>(() => (
    typeof window !== "undefined" ? window.matchMedia(compactHudQuery).matches : false
  ));
  const busy = busyAction !== null;

  function toggleLeftPanel(next: Exclude<OverlayPanel, "none">): void {
    setPanel((current) => {
      const resolved = current === next ? "none" : next;
      if (resolved !== "none" && isCompactHud) {
        setRightPanel("none");
      }
      return resolved;
    });
  }

  function toggleRightPanel(next: Exclude<RightPanel, "none">): void {
    setRightPanel((current) => {
      const resolved = current === next ? "none" : next;
      if (resolved !== "none" && isCompactHud) {
        setPanel("none");
      }
      return resolved;
    });
  }

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
        setSelectedProvinceId(loaded.selectedProvinceId ?? null);
        setActiveEventId(loaded.eventWindow.activeEventId);
        setJumpStep(loaded.availableJumpOptions[1]?.step ?? loaded.availableJumpOptions[0]?.step ?? "month");
        setViewedSnapshotId(null);
        setDiplomacyTargetId(loaded.countries.find((country) => country.id !== loaded.playerCountryId)?.id ?? loaded.playerCountryId);
        setAdvisorPrompt("");
        setPanel("actions");
        setRightPanel(isCompactHud ? "none" : "advisor");
        onTokenBalanceChange(loaded.tokenBalance);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Impossible de charger la partie");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadGameState();
    return () => {
      cancelled = true;
    };
  }, [gameId, isCompactHud, onError, onTokenBalanceChange]);

  useEffect(() => () => onTokenBalanceChange(null), [onTokenBalanceChange]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(compactHudQuery);
    function syncLayout(): void {
      setIsCompactHud(mediaQuery.matches);
    }

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => {
      mediaQuery.removeEventListener("change", syncLayout);
    };
  }, [compactHudQuery]);

  useEffect(() => {
    if (!isCompactHud) return;
    if (panel !== "none" && rightPanel !== "none") {
      setRightPanel("none");
    }
  }, [isCompactHud, panel, rightPanel]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setPanel("none");
        setRightPanel("none");
        return;
      }

      if (isTextInputElement(event.target)) return;

      if (event.key === "1") {
        setPanel((current) => current === "chats" ? "none" : "chats");
        if (isCompactHud) setRightPanel("none");
      } else if (event.key === "2") {
        setPanel((current) => current === "actions" ? "none" : "actions");
        if (isCompactHud) setRightPanel("none");
      } else if (event.key === "3") {
        setPanel((current) => current === "search" ? "none" : "search");
        if (isCompactHud) setRightPanel("none");
      } else if (event.key.toLowerCase() === "a") {
        setRightPanel((current) => current === "advisor" ? "none" : "advisor");
        if (isCompactHud) setPanel("none");
      } else if (event.key.toLowerCase() === "t") {
        setRightPanel((current) => current === "timeline" ? "none" : "timeline");
        if (isCompactHud) setPanel("none");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCompactHud]);

  async function applyGameUpdate(updated: GameState, nextPanel?: OverlayPanel): Promise<void> {
    setGame(updated);
    setSelectedCountryId((current) => (
      current && updated.countries.some((country) => country.id === current) ? current : updated.selectedCountryId
    ));
    setSelectedProvinceId((current) => current ?? updated.selectedProvinceId ?? null);
    setActiveEventId(updated.eventWindow.activeEventId);
    setViewedSnapshotId((current) => (nextPanel === "events" ? updated.snapshots[updated.snapshots.length - 1]?.id ?? null : current));
    if (nextPanel) setPanel(nextPanel);
    onTokenBalanceChange(updated.tokenBalance);
    await onRefreshGames();
  }

  if (loading || !game) {
    return (
      <main className="game-route">
        <div className="game-loading">Chargement de l'etat du monde...</div>
      </main>
    );
  }

  const snapshot = viewedSnapshotId ? game.snapshots.find((entry) => entry.id === viewedSnapshotId) ?? null : null;
  const activeCountries = snapshot?.countries ?? game.countries;
  const activeMapArtifacts = snapshot?.mapArtifacts ?? game.mapArtifacts;
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
  const highlightedCountryIds = uniqueIds([
    ...mapEffects.flatMap((effect) => [effect.countryId, effect.sourceCountryId]),
    ...(activeEvent?.mapFocusCountryIds ?? [])
  ]);
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
  const mapFocusCountryIds = mapFocus.countryIds;
  const mapFocusProvinceIds = mapFocus.provinceIds;
  const mapFocusToken = mapFocus.token;
  const advisorActionSuggestions = (advisorResponse?.suggestions ?? [])
    .filter((suggestion) => suggestion.kind !== "diplomacy")
    .slice(0, 3);
  const advisorDiplomacySuggestions = (advisorResponse?.suggestions ?? [])
    .filter((suggestion) => suggestion.kind === "diplomacy" && suggestion.targetCountryId)
    .slice(0, 3);
  const gameStageClassName = `game-stage${panel !== "none" ? " has-left-panel" : ""}${rightPanel !== "none" ? " has-right-panel" : ""}${isCompactHud ? " is-compact-hud" : ""}`;

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
      onError(error instanceof Error ? error.message : "Impossible d'ajouter l'ordre");
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
      onError(error instanceof Error ? error.message : "Impossible de lancer l'action rapide");
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
      onError(error instanceof Error ? error.message : "Impossible de retirer l'ordre");
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
      setRightPanel(isCompactHud ? "none" : "advisor");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible d'avancer dans le temps");
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
      setRightPanel(isCompactHud ? "none" : "timeline");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible d'atteindre un evenement majeur");
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
      onError(error instanceof Error ? error.message : "Impossible d'envoyer le message diplomatique");
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
      const response = await getAdvisor(currentGame.id, {
        snapshotId: viewedSnapshotId ?? undefined,
        prompt: advisorPrompt.trim() || undefined
      });
      const updated = await getGame(currentGame.id);
      setAdvisorResponse(response);
      setAdvisorHistory((current) => [
        response,
        ...current.filter((entry) => `${entry.tick}:${entry.snapshotId ?? "live"}` !== `${response.tick}:${response.snapshotId ?? "live"}`)
      ].slice(0, 8));
      await applyGameUpdate(updated);
      if (isCompactHud) setPanel("none");
      setRightPanel("advisor");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible de charger le conseiller");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAdvisorSuggestion(suggestion: AdvisorSuggestion): Promise<void> {
    const currentGame = game;
    if (!currentGame) return;

    if (suggestion.kind === "diplomacy" && suggestion.targetCountryId) {
      setDiplomacyTargetId(suggestion.targetCountryId);
      setDiplomacyText(suggestion.orderText);
      setPanel("chats");
      if (isCompactHud) setRightPanel("none");
      return;
    }

    setBusyAction("order");
    onError(null);
    try {
      const updated = suggestion.targetCountryId && isQuickActionKind(suggestion.kind)
        ? await queueQuickAction(currentGame.id, suggestion.targetCountryId, suggestion.kind)
        : await queueOrder(currentGame.id, suggestion.orderText);
      await applyGameUpdate(updated, "actions");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Impossible d'appliquer la suggestion");
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
    const focus = extractEventFocus(activeEvent);
    setMapFocus((current) => ({
      countryIds: focus.countryIds,
      provinceIds: focus.provinceIds,
      token: current.token + 1
    }));
  }

  function handleTimelineSelect(entry: TimelineEntry): void {
    const currentGame = game;
    if (!currentGame) return;
    setViewedSnapshotId(entry.snapshotId);
    const matchingSnapshot = currentGame.snapshots.find((snapshotItem) => snapshotItem.id === entry.snapshotId);
    const matchingEventId = matchingSnapshot?.eventIds[0] ?? null;
    if (matchingEventId) setActiveEventId(matchingEventId);
    const matchingEvent = matchingEventId
      ? currentGame.events.find((event) => event.id === matchingEventId) ?? null
      : null;
    const focus = extractEventFocus(matchingEvent);
    setMapFocus((current) => ({
      countryIds: focus.countryIds,
      provinceIds: focus.provinceIds,
      token: current.token + 1
    }));
    setPanel("events");
    if (isCompactHud) {
      setRightPanel("none");
    }
  }

  function applySnapshotFocus(snapshotId: string | null): void {
    const currentGame = game;
    if (!currentGame) return;

    if (!snapshotId) {
      setMapFocus((current) => ({
        countryIds: [],
        provinceIds: [],
        token: current.token + 1
      }));
      return;
    }

    const matchingSnapshot = currentGame.snapshots.find((snapshotItem) => snapshotItem.id === snapshotId);
    const primaryEventId = matchingSnapshot?.eventIds[0] ?? null;
    const primaryEvent = primaryEventId
      ? currentGame.events.find((event) => event.id === primaryEventId) ?? null
      : null;
    const focus = extractEventFocus(primaryEvent);
    setMapFocus((current) => ({
      countryIds: focus.countryIds,
      provinceIds: focus.provinceIds,
      token: current.token + 1
    }));
  }

  function handleOlderSnapshot(): void {
    if (!olderSnapshot) return;
    setViewedSnapshotId(olderSnapshot.id);
    applySnapshotFocus(olderSnapshot.id);
  }

  function handleNewerSnapshot(): void {
    if (viewedSnapshotId && newerSnapshot) {
      setViewedSnapshotId(newerSnapshot.id);
      applySnapshotFocus(newerSnapshot.id);
      return;
    }

    setViewedSnapshotId(null);
    applySnapshotFocus(null);
  }

  return (
    <main className="game-route">
      <div className={gameStageClassName}>
        {(panel !== "none" || rightPanel !== "none") && (
          <button
            type="button"
            className="panel-dismiss-hitbox"
            aria-label="Fermer les panneaux"
            onClick={() => {
              setPanel("none");
              setRightPanel("none");
            }}
          />
        )}
        <button type="button" className="floating-corner-button" onClick={() => toggleLeftPanel("menu")}>
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
            <span>{snapshot ? `Lecture - Tick ${snapshot.tick}` : `En direct - Tick ${game.tick}`}</span>
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
          aria-label="Chronologie"
          onClick={() => toggleRightPanel("timeline")}
        >
          <CalendarIcon />
        </button>

        <WorldGeoMap
          countries={activeCountries}
          preset={game.preset}
          selectedCountryId={selectedCountry?.id ?? null}
          selectedProvinceId={selectedProvinceId}
          mapEffects={mapEffects}
          mapArtifacts={activeMapArtifacts}
          highlightedCountryIds={highlightedCountryIds}
          focusCountryIds={mapFocusCountryIds}
          focusProvinceIds={mapFocusProvinceIds}
          focusToken={mapFocusToken}
          onSelectCountry={(countryId) => {
            setSelectedCountryId(countryId);
            setSelectedProvinceId(null);
            setSearchQuery("");
            if (countryId !== game.playerCountryId) {
              setDiplomacyTargetId(countryId);
            }
          }}
          onSelectProvince={(provinceId, countryId) => {
            setSelectedProvinceId(provinceId);
            setSelectedCountryId(countryId);
            setSearchQuery("");
            if (countryId !== game.playerCountryId) {
              setDiplomacyTargetId(countryId);
            }
          }}
        />

        <div className="floating-dock">
          <button type="button" className={`dock-button${panel === "chats" ? " is-active" : ""}`} onClick={() => toggleLeftPanel("chats")}>
            <ChatIcon />
          </button>
          <button type="button" className={`dock-button${panel === "actions" ? " is-active" : ""}`} onClick={() => toggleLeftPanel("actions")}>
            <SparkIcon />
          </button>
          <button type="button" className={`dock-button${panel === "search" ? " is-active" : ""}`} onClick={() => toggleLeftPanel("search")}>
            <SearchIcon />
          </button>
        </div>

        <button type="button" className="floating-profile-button" onClick={() => toggleRightPanel("advisor")}>
          <AvatarIcon />
        </button>

        <div className="game-status-pill">
          <span>{selectedCountry?.name ?? game.playerCountryName}</span>
          <strong>{viewedSnapshotId ? "Snapshot historique" : game.preset.title}</strong>
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
          <section className="overlay-panel events-panel left-column-panel">
            <OverlayHeading
              title={game.eventWindow.title}
              subtitle={game.eventWindow.rangeLabel}
              onClose={() => setPanel("none")}
            />

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
                  <div className="event-impact-empty">Aucun impact cartographique direct n'est enregistre pour cet evenement.</div>
                )}
                <button type="button" className="secondary-button map-change-button" onClick={handleMapChangeView}>
                  <MapIcon />
                  <span>Voir les changements de carte</span>
                </button>
                <div className="event-footer">
                  <span><CalendarIcon /> {activeEvent.dateLabel}</span>
                  <span>{activeEvent.mapChangeSummary ?? "Aucun resume cartographique n'est disponible."}</span>
                </div>
              </>
            ) : (
              <div className="empty-panel">Aucune fenetre d'evenements pour le moment. Avancez dans le temps pour produire une mise a jour du monde.</div>
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

        {rightPanel === "timeline" && (
          <aside className="timeline-panel right-column-panel">
            <OverlayHeading
              title="Chronologie"
              subtitle={snapshot ? "Lecture d'un snapshot historique" : "Rounds les plus recents"}
              onClose={() => setRightPanel("none")}
            />
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
                Retour au live
              </button>
              <button type="button" className="primary-button" onClick={handleMajorEvent} disabled={busy}>
                {busyAction === "major-event" ? "Recherche..." : "Evenement majeur"}
              </button>
            </div>
          </aside>
        )}

        {panel === "actions" && (
          <section className="overlay-panel side-panel left-column-panel">
            <OverlayHeading
              title="Actions"
              subtitle={`${game.actionPoints}/${game.maxActionPoints} points d'action disponibles`}
              onClose={() => setPanel("none")}
            />

            {selectedCountry && (
              <div className="selected-country-card">
                <strong>{selectedCountry.name}</strong>
                <span>{selectedCountry.descriptor}</span>
                <span>{`Puissance ${selectedCountry.power} | Stabilite ${selectedCountry.stability} | Tension ${selectedCountry.tension}`}</span>
                <span>{`Armee ${selectedCountry.army} | Industrie ${selectedCountry.industry} | Fortification ${selectedCountry.fortification} | Unrest ${selectedCountry.unrest}`}</span>
              </div>
            )}

            <label className="field-block">
              <span>Pays actif</span>
              <select
                value={selectedCountryId ?? ""}
                onChange={(event) => {
                  const nextCountryId = event.target.value || null;
                  setSelectedCountryId(nextCountryId);
                  setSelectedProvinceId(null);
                  if (nextCountryId && nextCountryId !== game.playerCountryId) {
                    setDiplomacyTargetId(nextCountryId);
                  }
                }}
              >
                {activeCountries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
            </label>

            {advisorActionSuggestions.length > 0 && (
              <div className="advisor-shortcut-row">
                {advisorActionSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="advisor-shortcut-chip"
                    onClick={() => {
                      setOrderText(suggestion.orderText);
                      if (suggestion.targetCountryId) setSelectedCountryId(suggestion.targetCountryId);
                    }}
                  >
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.impact}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={orderText}
              onChange={(event) => setOrderText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleQueueOrder();
                }
              }}
              rows={5}
              className="large-textarea"
              placeholder="Decrivez une action concrete: offensive, reforme interne, pacte diplomatique, pression economique..."
            />
            <p className="input-hint">Ctrl+Enter pour ajouter rapidement l'ordre a la file.</p>

            <button
              type="button"
              className="secondary-button advisor-help-button"
              onClick={handleAdvisor}
              disabled={busy}
            >
              {busyAction === "advisor" ? "Preparation du brief..." : "Aider a trouver des idees d'actions"}
            </button>

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

            <div className="panel-actions panel-command-bar">
              <button type="button" className="primary-button" onClick={handleQueueOrder} disabled={busy || !orderText.trim()}>
                {busyAction === "order" ? "Interpretation..." : "Ajouter a la file"}
              </button>
              <button type="button" className="secondary-button" onClick={handleJump} disabled={busy}>
                {busyAction === "jump" ? "Simulation..." : "Saut temporel"}
              </button>
            </div>

            <div className="queued-orders">
              {game.queuedOrders.length === 0 && <div className="empty-panel">Aucun ordre en file pour le prochain round.</div>}
              {game.queuedOrders.map((order) => (
                <article key={order.id} className="order-card">
                  <div>
                    <strong>{order.kind.toUpperCase()}</strong>
                    <span>{order.text}</span>
                  </div>
                  <button type="button" className="text-button" onClick={() => handleRemoveOrder(order.id)} disabled={busy}>
                    Retirer
                  </button>
                </article>
              ))}
            </div>

            {game.lastRoundSummary && (
              <div className="round-summary-card">
                <strong>Dernier round</strong>
                <span>{game.lastRoundSummary.displayDate}</span>
                {game.lastRoundSummary.highlights.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {panel === "chats" && (
          <section className="overlay-panel side-panel left-column-panel">
            <OverlayHeading
              title="Chats diplomatiques"
              subtitle="La diplomatie textuelle influe directement sur les rounds et les evenements."
              onClose={() => setPanel("none")}
            />

            <label className="field-block">
              <span>Pays cible</span>
              <select value={diplomacyTargetId} onChange={(event) => setDiplomacyTargetId(event.target.value)}>
                {game.countries
                  .filter((country) => country.id !== game.playerCountryId)
                  .map((country) => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
              </select>
            </label>

            {advisorDiplomacySuggestions.length > 0 && (
              <div className="advisor-shortcut-row diplomacy">
                {advisorDiplomacySuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="advisor-shortcut-chip"
                    onClick={() => {
                      if (suggestion.targetCountryId) setDiplomacyTargetId(suggestion.targetCountryId);
                      setDiplomacyText(suggestion.orderText);
                    }}
                  >
                    <strong>{suggestion.targetCountryName ?? suggestion.label}</strong>
                    <span>{suggestion.rationale}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="chat-thread">
              {busyAction === "diplomacy" && diplomacyText.trim() && diplomacyTarget && (
                <article className="chat-card stance-neutral is-pending">
                  <strong>Reponse en attente</strong>
                  <p>{`Vous: ${diplomacyText.trim()}`}</p>
                  <p>{`${diplomacyTarget.name}: Generation de la reponse...`}</p>
                </article>
              )}
              {activeConversation.length === 0 && (
                <div className="empty-panel">Aucun echange avec ce pays pour l'instant. Lancez une demande, une offre ou un avertissement.</div>
              )}
              {activeConversation.map((entry) => (
                <article key={entry.id} className={`chat-card stance-${entry.stance}`}>
                  <strong>{entry.dateLabel}</strong>
                  <p>{`Vous: ${entry.message}`}</p>
                  <p>{`${entry.targetCountryName}: ${entry.reply}`}</p>
                </article>
              ))}
            </div>

            <textarea
              value={diplomacyText}
              onChange={(event) => setDiplomacyText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleSendDiplomacy();
                }
              }}
              rows={4}
              className="large-textarea"
              placeholder="Proposez un pacte, posez des conditions, menacez ou ouvrez une voie de negociation."
            />
            <p className="input-hint">Ctrl+Enter pour envoyer le message diplomatique.</p>

            <div className="panel-actions panel-command-bar">
              <button type="button" className="primary-button" onClick={handleSendDiplomacy} disabled={busy || !diplomacyText.trim()}>
                {busyAction === "diplomacy" ? "Negociation..." : "Envoyer"}
              </button>
            </div>
          </section>
        )}

        {rightPanel === "advisor" && (
          <section className="overlay-panel side-panel advisor-panel right-column-panel">
            <OverlayHeading
              title="Conseiller"
              subtitle={
                viewedSnapshotId
                  ? "Mode historique: analyse basee sur le snapshot selectionne."
                  : "Analyse contextuelle du round courant et des pressions mondiales."
              }
              onClose={() => setRightPanel("none")}
            />

            <div className="advisor-summary">
              <strong>{snapshot?.displayDate ?? game.displayDate}</strong>
              <span>{`${game.preset.title} | ${game.playerCountryName}${viewedSnapshotId ? " | Historique" : ""}`}</span>
            </div>

            <label className="field-block">
              <span>Question au conseiller (optionnel)</span>
              <textarea
                value={advisorPrompt}
                onChange={(event) => setAdvisorPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleAdvisor();
                  }
                }}
                rows={3}
                className="large-textarea advisor-question-textarea"
                placeholder={viewedSnapshotId
                  ? "Ex: Quelle action aurait ete optimale au round suivant ?"
                  : "Ex: Priorite defense, economie ou diplomatie pour les 2 prochains rounds ?"}
              />
            </label>
            <p className="input-hint">Ctrl+Enter pour lancer l'analyse du conseiller.</p>

            {advisorResponse ? (
              <article className="advisor-card">
                <strong>{advisorResponse.dateLabel}</strong>
                <p>{advisorResponse.question ? `Question: ${advisorResponse.question} ` : ""}{advisorResponse.narrative}</p>
              </article>
            ) : (
              <div className="empty-panel">Aucun brief en cache. Generez une premiere analyse.</div>
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
                      {suggestion.kind === "diplomacy" ? "Ouvrir dans Chats" : "Ajouter cette action"}
                    </button>
                  </article>
                ))}
              </div>
            )}

            {busyAction === "advisor" && (
              <article className="advisor-card is-pending">
                <strong>{game.displayDate}</strong>
                <p>Generation d'un nouveau brief en cours...</p>
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

            <div className="panel-actions panel-command-bar">
              <button type="button" className="primary-button" onClick={handleAdvisor} disabled={busy}>
                {busyAction === "advisor"
                  ? "Analyse..."
                  : viewedSnapshotId
                    ? "Analyser le snapshot"
                    : "Analyser le round"}
              </button>
            </div>
          </section>
        )}

        {panel === "search" && (
          <section className="overlay-panel search-panel left-column-panel">
            <OverlayHeading
              title="Recherche de pays"
              subtitle="Selectionnez rapidement un pays pour recentrer vos decisions."
              onClose={() => setPanel("none")}
            />

            <label className="field-block">
              <span>Recherche</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="France, Russie, Bresil..."
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
                    setSelectedProvinceId(null);
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
          <section className="overlay-panel menu-panel left-column-panel">
            <OverlayHeading
              title="Menu avance"
              subtitle="Contexte de session, rythme temporel et navigation rapide."
              onClose={() => setPanel("none")}
            />

            <div className="menu-grid">
              <article className="menu-card">
                <strong>{game.preset.title}</strong>
                <span>{`${game.difficulty} | IA ${game.aiQuality}`}</span>
              </article>
              <article className="menu-card">
                <strong>{formatMoney(game.tokenBalance)}</strong>
                <span>Solde de tokens</span>
              </article>
            </div>

            <label className="field-block">
              <span>Rythme du saut</span>
              <select value={jumpStep} onChange={(event) => setJumpStep(event.target.value as JumpStep)}>
                {game.availableJumpOptions.map((option) => (
                  <option key={option.step} value={option.step}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={handleJump} disabled={busy}>
                {busyAction === "jump" ? "Simulation..." : "Saut temporel"}
              </button>
              <button type="button" className="secondary-button" onClick={handleMajorEvent} disabled={busy}>
                {busyAction === "major-event" ? "Recherche..." : "Vers evenement majeur"}
              </button>
            </div>

            <button type="button" className="text-button" onClick={() => navigate("/presets")}>
              Retour aux presets
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
