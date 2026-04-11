import React, { useState } from "react";
import type { GameSessionSummary, PresetBrowserPayload, PresetRail, PresetSummary } from "@genesis/shared";

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
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

  if (props.loading || !props.browserData) {
    return (
      <main className="preset-browser-page">
        <section className="preset-browser-loading" />
      </main>
    );
  }

  const allCategories = [{ id: "all", title: "All" }, ...props.browserData.categories.map((category) => ({
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

  return (
    <main className="preset-browser-page">
      <section className="preset-browser-top">
        <div className="preset-browser-toolbar">
          <div className="preset-browser-copy">
            <span className="preset-browser-kicker">{props.eyebrow}</span>
            <div className="preset-browser-stats">
              <span className="browser-summary-pill">{`${props.browserData.presets.filter((preset) => preset.playable).length} playable presets`}</span>
              <span className="browser-summary-pill">{`${props.recentGames.length} local games`}</span>
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
            <TopPresetCard key={preset.id} preset={preset} rank={index + 1} onOpen={() => props.onLaunchPreset(preset.id)} />
          ))}
        </div>
      </section>

      <section className="preset-browser-section">
        <div className="browser-section-heading">
          <h2>Mises a jour recentes</h2>
          <span>Derniers ajustements de presets et mondes communautaires actifs.</span>
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
            <h2>Categories de presets</h2>
            <span>Parcourez les familles historiques et communautaires dans un format proche du live.</span>
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
            <h2>Presets communaute populaires</h2>
            <span>Des mondes plus chaotiques, ideaux pour des chronologies inattendues.</span>
          </div>
          <div className="compact-preset-grid is-tall">
            {communityPresets.map((preset) => (
              <CompactPresetCard key={preset.id} preset={preset} onOpen={() => props.onLaunchPreset(preset.id)} />
            ))}
          </div>
        </div>

        <div className="split-browser-column compact-sidebar">
          <div className="browser-section-heading">
            <h2>Parties locales recentes</h2>
            <span>Reprenez les dernieres sessions creees sur ce workspace.</span>
          </div>
          <div className="mini-session-list">
            {props.recentGames.length === 0 && <div className="browser-empty">Aucune session pour l'instant.</div>}
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
