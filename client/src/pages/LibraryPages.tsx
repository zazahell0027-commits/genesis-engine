import React from "react";
import type { GameSessionSummary } from "@genesis/shared";
import { Link } from "react-router-dom";

const FLAG_LIBRARY = [
  { title: "Imperial Banner Pack", description: "Stylized state banners for historical and late-industrial presets.", accent: "#f59e0b" },
  { title: "Cold War Flags", description: "Bloc-first iconography and alternate emblems for ideological standoffs.", accent: "#6366f1" },
  { title: "Community Heraldry", description: "Player-made symbols for fractured maps and roleplay-heavy scenarios.", accent: "#ec4899" }
];

const COMMUNITY_TRACKS = [
  { title: "Weekly Alt-History Showcase", subtitle: "Fresh presets with strong event writing and map polish." },
  { title: "Best New Creators", subtitle: "Community authors with standout pacing, covers, and chronology hooks." },
  { title: "Longform Campaign Clubs", subtitle: "Groups focused on multiplayer-like single-player narratives." }
];

export function GamesPage(props: {
  recentGames: GameSessionSummary[];
  loading: boolean;
}): React.JSX.Element {
  return (
    <main className="route-page">
      <section className="page-hero compact">
        <div className="page-hero-copy">
          <span className="eyebrow">Local sessions</span>
          <h1>Games</h1>
          <p>Resume the last local simulations started in this workspace. Each card reflects the current in-memory world state.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="games-grid">
          {props.loading && <div className="empty-panel">Loading recent sessions...</div>}
          {!props.loading && props.recentGames.length === 0 && (
            <div className="empty-panel">No game has been started yet. Open a preset to create your first session.</div>
          )}
          {props.recentGames.map((game) => (
            <Link key={game.id} to={`/game/${game.id}`} className="game-card">
              <div className="game-card-art" style={{ backgroundImage: `url(${game.coverImage})`, borderColor: game.accent }} />
              <div className="game-card-copy">
                <strong>{game.presetTitle}</strong>
                <span>{game.playerCountryName}</span>
                <span>{game.displayDate} • Tick {game.tick}</span>
                <span>{game.lastUpdatedLabel}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export function FlagsPage(): React.JSX.Element {
  return (
    <main className="route-page">
      <section className="page-hero compact">
        <div className="page-hero-copy">
          <span className="eyebrow">Reference surface</span>
          <h1>Flags</h1>
          <p>This read-only page mirrors the kind of browseable ancillary surface Pax Historia exposes around presets and identity.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="category-grid">
          {FLAG_LIBRARY.map((item) => (
            <article key={item.title} className="category-card" style={{ borderColor: item.accent }}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span>Display-ready collection</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function CommunityPage(): React.JSX.Element {
  return (
    <main className="route-page">
      <section className="page-hero compact">
        <div className="page-hero-copy">
          <span className="eyebrow">Community surface</span>
          <h1>Community</h1>
          <p>A lightweight but credible read-only area for creators, playlists, and rotating community tracks.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="community-grid">
          {COMMUNITY_TRACKS.map((track) => (
            <article key={track.title} className="community-card">
              <strong>{track.title}</strong>
              <p>{track.subtitle}</p>
              <span>Updated weekly</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
