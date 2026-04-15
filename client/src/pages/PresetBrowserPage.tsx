import React, { useState } from "react";
import type { GameSessionSummary, PresetBrowserPayload, PresetRail, PresetSummary } from "@genesis/shared";
import { useUiLocale } from "../i18n";

function TopPresetCard(props: {
  preset: PresetSummary;
  rank: number;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className="top-preset-card" onClick={props.onOpen}>
      <div className="top-preset-art" style={{ backgroundImage: `url(${props.preset.coverImage})` }} />
      <div className="top-preset-meta">
        <span className="top-preset-rank">{props.rank}</span>
        <div className="top-preset-copy">
          <strong>{props.preset.title}</strong>
          <span>{`${props.preset.stats.rounds} - ${props.preset.stats.games}`}</span>
        </div>
      </div>
    </button>
  );
}

function CompactPresetCard(props: {
  preset: PresetSummary;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className="compact-preset-card" onClick={props.onOpen}>
      <div className="compact-preset-art" style={{ backgroundImage: `url(${props.preset.coverImage})` }} />
      <div className="compact-preset-copy">
        <strong>{props.preset.title}</strong>
        <span>{props.preset.subtitle}</span>
      </div>
    </button>
  );
}

function DarkShelfCard(props: {
  preset: PresetSummary;
  rank: number;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className="dark-shelf-card" onClick={props.onOpen}>
      <div className="dark-shelf-art" style={{ backgroundImage: `url(${props.preset.coverImage})` }}>
        <span className={`dark-shelf-badge${props.preset.official ? "" : " is-community"}`}>
          {props.preset.official ? "Official" : "Community"}
        </span>
      </div>
      <div className="dark-shelf-meta">
        <span className="dark-shelf-rank">{props.rank}</span>
        <div className="dark-shelf-copy">
          <strong>{props.preset.title}</strong>
          <span>{props.preset.era}</span>
        </div>
      </div>
    </button>
  );
}

function MiniSessionCard(props: {
  game: GameSessionSummary;
}): React.JSX.Element {
  return (
    <article className="mini-session-card">
      <div className="mini-session-art" style={{ backgroundImage: `url(${props.game.coverImage})` }} />
      <div className="mini-session-copy">
        <strong>{props.game.presetTitle}</strong>
        <span>{props.game.playerCountryName}</span>
      </div>
    </article>
  );
}

function presetsForRail(browserData: PresetBrowserPayload, railId: string): PresetSummary[] {
  const rail = browserData.rails.find((entry) => entry.id === railId);
  if (!rail) return [];
  return rail.presetIds
    .map((presetId) => browserData.presets.find((preset) => preset.id === presetId) ?? null)
    .filter((preset): preset is PresetSummary => Boolean(preset));
}

function otherRails(browserData: PresetBrowserPayload, hiddenIds: string[]): Array<{ rail: PresetRail; presets: PresetSummary[] }> {
  return browserData.rails
    .filter((rail) => !hiddenIds.includes(rail.id))
    .map((rail) => ({
      rail,
      presets: rail.presetIds
        .map((presetId) => browserData.presets.find((preset) => preset.id === presetId) ?? null)
        .filter((preset): preset is PresetSummary => Boolean(preset))
    }))
    .filter((entry) => entry.presets.length > 0);
}

export function PresetBrowserPage(props: {
  title: string;
  eyebrow: string;
  description: string;
  browserData: PresetBrowserPayload | null;
  loading: boolean;
  recentGames: GameSessionSummary[];
  onLaunchPreset: (presetId: string) => void;
}): React.JSX.Element {
  const { locale } = useUiLocale();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const copy = locale === "fr"
    ? {
      all: "Tout",
      playable: "presets jouables",
      localGames: "parties locales",
      launchNow: "Jouer maintenant",
      preview: "Apercu",
      roundsLabel: "parties",
      turnsLabel: "tours",
      copiesLabel: "copies",
      recentUpdates: "Mises a jour recentes",
      recentUpdatesSub: "Derniers ajustements de presets et mondes communautaires actifs.",
      categoriesTitle: "Categories de presets",
      categoriesSub: "Parcourez les familles historiques et communautaires dans un format proche du live.",
      communityPopular: "Presets communaute populaires",
      communityPopularSub: "Des mondes plus chaotiques, ideaux pour des chronologies inattendues.",
      localRecent: "Parties locales recentes",
      localRecentSub: "Reprenez les dernieres sessions creees sur ce workspace.",
      noSessions: "Aucune session pour l'instant.",
      official: "Preset officiel",
      community: "Preset communaute",
      about: "A propos de ce scenario"
    }
    : {
      all: "All",
      playable: "playable presets",
      localGames: "local games",
      launchNow: "Play now",
      preview: "Preview",
      roundsLabel: "games",
      turnsLabel: "rounds",
      copiesLabel: "copies",
      recentUpdates: "Recently updated",
      recentUpdatesSub: "Latest tuning passes for official and community worlds.",
      categoriesTitle: "Preset categories",
      categoriesSub: "Browse historical and community families in a live-like layout.",
      communityPopular: "Popular community presets",
      communityPopularSub: "More chaotic worlds built for unstable timelines.",
      localRecent: "Recent local sessions",
      localRecentSub: "Resume the latest sessions created in this workspace.",
      noSessions: "No local sessions yet.",
      official: "Official preset",
      community: "Community preset",
      about: "About this scenario"
    };

  if (props.loading || !props.browserData) {
    return (
      <main className="preset-browser-page">
        <section className="preset-browser-loading" />
      </main>
    );
  }

  const allCategories = [{ id: "all", title: copy.all }, ...props.browserData.categories.map((category) => ({
    id: category.id,
    title: category.title
  }))];

  const visiblePresetIds = activeCategoryId === "all"
    ? null
    : new Set(props.browserData.presets.filter((preset) => preset.category === activeCategoryId).map((preset) => preset.id));

  const filterPresets = (items: PresetSummary[]): PresetSummary[] => (
    visiblePresetIds ? items.filter((preset) => visiblePresetIds.has(preset.id)) : items
  );

  const topPresets = filterPresets(presetsForRail(props.browserData, "most-played")).slice(0, 4);
  const updatedPresets = filterPresets(presetsForRail(props.browserData, "recently-updated")).slice(0, 4);
  const communityPresets = filterPresets(presetsForRail(props.browserData, "popular-community")).slice(0, 5);
  const darkShelfPresets = filterPresets(props.browserData.presets).slice(0, 5);
  const trailingRails = otherRails(props.browserData, ["most-played", "recently-updated", "popular-community"]);
  const activePreset = props.browserData.presets.find((preset) => preset.id === activePresetId)
    ?? topPresets[0]
    ?? props.browserData.presets[0]
    ?? null;

  return (
    <main className="preset-browser-page">
      {activePreset && (
        <section
          className="scenario-hero"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(5, 8, 18, 0.2), rgba(3, 6, 14, 0.85)), url(${activePreset.bannerImage ?? activePreset.coverImage})` }}
        >
          <div className="scenario-hero-copy">
            <span className="scenario-hero-kicker">{activePreset.official ? copy.official : copy.community}</span>
            <h1>{activePreset.title}</h1>
            <p>{activePreset.subtitle}</p>
            <div className="scenario-hero-metrics">
              <span>{`${activePreset.stats.rounds} ${copy.roundsLabel}`}</span>
              <span>{`${activePreset.stats.games} ${copy.turnsLabel}`}</span>
              <span>{`${activePreset.stats.players ?? "N/A"} ${copy.copiesLabel}`}</span>
              <span>{activePreset.creator}</span>
            </div>
            <button type="button" className="scenario-hero-cta" onClick={() => props.onLaunchPreset(activePreset.id)}>
              {copy.launchNow}
            </button>
          </div>
          <div className="scenario-hero-about">
            <h2>{copy.about}</h2>
            <div className="scenario-about-chips">
              <span>{activePreset.startDate.label}</span>
              <span>{activePreset.era}</span>
              <span>{activePreset.category}</span>
            </div>
            <p>{activePreset.description}</p>
          </div>
        </section>
      )}

      <section className="preset-browser-top">
        <div className="preset-browser-toolbar">
          <div className="preset-browser-copy">
            <span className="preset-browser-kicker">{props.eyebrow}</span>
            <div className="preset-browser-stats">
              <span className="browser-summary-pill">{`${props.browserData.presets.filter((preset) => preset.playable).length} ${copy.playable}`}</span>
              <span className="browser-summary-pill">{`${props.recentGames.length} ${copy.localGames}`}</span>
            </div>
          </div>
          <div className="preset-browser-filters">
            {allCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`browser-filter-chip${activeCategoryId === category.id ? " is-active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.title}
              </button>
            ))}
          </div>
        </div>

        <div className="top-preset-grid">
          {topPresets.map((preset, index) => (
            <div key={preset.id} className={`top-preset-wrapper${activePreset?.id === preset.id ? " is-active" : ""}`}>
              <TopPresetCard preset={preset} rank={index + 1} onOpen={() => props.onLaunchPreset(preset.id)} />
              <button type="button" className="top-preset-preview" onClick={() => setActivePresetId(preset.id)}>
                {copy.preview}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="preset-browser-section">
        <div className="browser-section-heading">
          <h2>{copy.recentUpdates}</h2>
          <span>{copy.recentUpdatesSub}</span>
        </div>
        <div className="compact-preset-grid">
          {updatedPresets.map((preset) => (
            <CompactPresetCard key={preset.id} preset={preset} onOpen={() => props.onLaunchPreset(preset.id)} />
          ))}
        </div>
      </section>

      <section className="preset-browser-section dark-categories-section">
        <div className="browser-section-heading on-dark">
          <div>
            <h2>{copy.categoriesTitle}</h2>
            <span>{copy.categoriesSub}</span>
          </div>
          <div className="dark-category-tabs">
            {allCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`dark-category-chip${activeCategoryId === category.id ? " is-active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.title}
              </button>
            ))}
          </div>
        </div>

        <div className="dark-shelf-grid">
          {darkShelfPresets.map((preset, index) => (
            <DarkShelfCard key={preset.id} preset={preset} rank={index + 1} onOpen={() => props.onLaunchPreset(preset.id)} />
          ))}
        </div>
      </section>

      <section className="preset-browser-section split-browser-section">
        <div className="split-browser-column">
          <div className="browser-section-heading">
            <h2>{copy.communityPopular}</h2>
            <span>{copy.communityPopularSub}</span>
          </div>
          <div className="compact-preset-grid is-tall">
            {communityPresets.map((preset) => (
              <CompactPresetCard key={preset.id} preset={preset} onOpen={() => props.onLaunchPreset(preset.id)} />
            ))}
          </div>
        </div>

        <div className="split-browser-column compact-sidebar">
          <div className="browser-section-heading">
            <h2>{copy.localRecent}</h2>
            <span>{copy.localRecentSub}</span>
          </div>
          <div className="mini-session-list">
            {props.recentGames.length === 0 && <div className="browser-empty">{copy.noSessions}</div>}
            {props.recentGames.slice(0, 4).map((game) => (
              <MiniSessionCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      </section>

      {trailingRails.map((entry) => {
        const presets = filterPresets(entry.presets);
        if (presets.length === 0) return null;

        return (
          <section key={entry.rail.id} className="preset-browser-section">
            <div className="browser-section-heading">
              <h2>{entry.rail.title}</h2>
              <span>{entry.rail.subtitle}</span>
            </div>
            <div className="compact-preset-grid">
              {presets.map((preset) => (
                <CompactPresetCard key={preset.id} preset={preset} onOpen={() => props.onLaunchPreset(preset.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
