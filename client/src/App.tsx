import React, { useEffect, useState } from "react";
import type { GameSessionSummary, PresetBrowserPayload } from "@genesis/shared";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getPresetBrowser, getPresetCategories, listGames } from "./api";
import { ChromeHeader } from "./components/ChromeHeader";
import { formatMoney } from "./components/Icons";
import { LaunchPresetModal } from "./components/LaunchPresetModal";
import { GameRoutePage } from "./pages/GameRoutePage";
import { CommunityPage, FlagsPage, GamesPage } from "./pages/LibraryPages";
import { PresetBrowserPage } from "./pages/PresetBrowserPage";

export default function App(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [browserData, setBrowserData] = useState<PresetBrowserPayload | null>(null);
  const [recentGames, setRecentGames] = useState<GameSessionSummary[]>([]);
  const [loadingChrome, setLoadingChrome] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchPresetId, setLaunchPresetId] = useState<string | null>(null);
  const [tokenBalanceOverride, setTokenBalanceOverride] = useState<number | null>(null);

  async function refreshGames(): Promise<void> {
    try {
      const items = await listGames();
      setRecentGames(items);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de rafraichir les parties locales");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadChromeData(): Promise<void> {
      setLoadingChrome(true);
      setError(null);
      try {
        const [presetPayload, games, categories] = await Promise.all([
          getPresetBrowser(),
          listGames(),
          getPresetCategories()
        ]);

        if (cancelled) return;
        setBrowserData({ ...presetPayload, categories: categories.length > 0 ? categories : presetPayload.categories });
        setRecentGames(games);
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Impossible de charger l'interface");
      } finally {
        if (!cancelled) setLoadingChrome(false);
      }
    }

    void loadChromeData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith("/game/")) {
      setTokenBalanceOverride(null);
    }
  }, [location.pathname]);

  const activePreset = browserData?.presets.find((preset) => preset.id === launchPresetId) ?? null;
  const tokenLabel = tokenBalanceOverride !== null
    ? formatMoney(tokenBalanceOverride)
    : browserData?.navBadges.find((badge) => badge.id === "tokens")?.value ?? "$1.974";

  return (
    <div className={`app-shell${location.pathname.startsWith("/game/") ? " is-game-route" : ""}`}>
      <ChromeHeader tokenLabel={tokenLabel} isGameRoute={location.pathname.startsWith("/game/")} />
      {error && <div className="global-error-banner">{error}</div>}

      <Routes>
        <Route
          path="/"
          element={(
            <PresetBrowserPage
              title="Alternate history presets"
              eyebrow="Selection phare"
              description="Parcourez les mondes officiels et communautaires puis lancez une partie plein ecran style Pax."
              browserData={browserData}
              loading={loadingChrome}
              recentGames={recentGames}
              onLaunchPreset={setLaunchPresetId}
            />
          )}
        />
        <Route
          path="/presets"
          element={(
            <PresetBrowserPage
              title="Presets"
              eyebrow="Navigateur de contenu"
              description="Navigateur a rails, categories et fiches de lancement rapides."
              browserData={browserData}
              loading={loadingChrome}
              recentGames={recentGames}
              onLaunchPreset={setLaunchPresetId}
            />
          )}
        />
        <Route path="/games" element={<GamesPage recentGames={recentGames} loading={loadingChrome} />} />
        <Route path="/flags" element={<FlagsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route
          path="/game/:gameId"
          element={<GameRoutePage onError={setError} onTokenBalanceChange={setTokenBalanceOverride} onRefreshGames={refreshGames} />}
        />
      </Routes>

      <LaunchPresetModal
        preset={activePreset}
        open={Boolean(activePreset)}
        onClose={() => setLaunchPresetId(null)}
        onError={setError}
        onStarted={(game) => {
          setLaunchPresetId(null);
          setRecentGames((current) => {
            const next = current.filter((entry) => entry.id !== game.id);
            return [
              {
                id: game.id,
                presetId: game.presetId,
                presetTitle: game.preset.title,
                coverImage: game.preset.coverImage,
                playerCountryName: game.playerCountryName,
                displayDate: game.displayDate,
                tick: game.tick,
                lastUpdatedLabel: "Updated moments ago",
                accent: game.preset.accent
              },
              ...next
            ].slice(0, 12);
          });
          navigate(`/game/${game.id}`);
        }}
      />
    </div>
  );
}
