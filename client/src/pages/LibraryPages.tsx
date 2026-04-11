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
          <span className="eyebrow">Sessions locales</span>
          <h1>Parties</h1>
          <p>Reprenez les simulations locales recentes de ce workspace.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="games-grid">
          {props.loading && <div className="empty-panel">Chargement des sessions recentes...</div>}
          {!props.loading && props.recentGames.length === 0 && (
            <div className="empty-panel">Aucune partie lancee. Ouvrez un preset pour creer votre premiere session.</div>
          )}
          {props.recentGames.map((game) => (
            <Link key={game.id} to={`/game/${game.id}`} className="game-card">
              <div className="game-card-art" style={{ backgroundImage: `url(${game.coverImage})`, borderColor: game.accent }} />
              <div className="game-card-copy">
                <strong>{game.presetTitle}</strong>
                <span>{game.playerCountryName}</span>
                <span>{`${game.displayDate} - Tick ${game.tick}`}</span>
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
          <span className="eyebrow">Surface reference</span>
          <h1>Drapeaux</h1>
          <p>Page read-only inspiree des surfaces annexes de Pax Historia.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="category-grid">
          {FLAG_LIBRARY.map((item) => (
            <article key={item.title} className="category-card" style={{ borderColor: item.accent }}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span>Collection prete a afficher</span>
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
          <span className="eyebrow">Surface communaute</span>
          <h1>Communaute</h1>
          <p>Zone read-only pour les createurs, playlists et mises en avant communautaires.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="community-grid">
          {COMMUNITY_TRACKS.map((track) => (
            <article key={track.title} className="community-card">
              <strong>{track.title}</strong>
              <p>{track.subtitle}</p>
              <span>Mise a jour hebdomadaire</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
