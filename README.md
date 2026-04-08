# Genesis Engine

Genesis Engine est un moteur de simulation de mondes vivants orienté web, avec une architecture modulaire et un MVP simple, exécutable et maintenable.

## Vision MVP

- Monde simulé en 2D qui évolue à chaque tick.
- Rôles jouables modulaires: `hero`, `faction`, `nation`, `gm`.
- Backend responsable de la logique (simulation, événements, IA provider).
- Frontend responsable de l'affichage et des interactions.
- IA optionnelle, locale en priorité via Ollama, sans coût API obligatoire.

## Architecture Simplifiée (MVP)

Objectif: garder la modularité sans trop fragmenter les dossiers.

```text
genesis-engine/
  client/
    src/
      main.tsx
      App.tsx
      styles.css
      pages/
        LandingPage.tsx
        CreateWorldPage.tsx
        WorldPage.tsx
        DashboardPage.tsx
      components/
        WorldMapGrid.tsx
        TerritoryPanel.tsx
        ControlBar.tsx
      services/
        api.ts
      types/
        world.ts
  server/
    src/
      index.ts
      app.ts
      config.ts
      routes.ts
      world.ts
      simulation.ts
      roles.ts
      events.ts
      ai.ts
      providers/
        mockProvider.ts
        ollamaProvider.ts
  shared/
    src/
      contracts.ts
  .env.example
  .gitignore
  README.md
```

## Carte MVP (définie)

- Type: grille 2D simple (pas de moteur graphique complexe).
- Taille configurable: ex. `10x10` (small/medium/large).
- Une case = un territoire.
- Données minimales par territoire:
  - `owner`
  - `richesse`
  - `stabilite`
  - `tensions`

## Simulation MVP (définie)

Règles simples et déterministes, sans logique cachée:

- À chaque tick, chaque territoire évolue:
  - `richesse` varie avec une dérive bornée et un bruit déterministe
  - `stabilite` baisse si `tensions` montent, remonte légèrement sinon
  - `tensions` montent selon conflits/événements, baissent en période calme
- Les valeurs sont bornées entre `0` et `100`.
- Un historique d'événements est conservé au niveau monde.

Événements MVP:

- `troubles`
- `alliance`
- `expansion`
- `crise_locale`
- `decouverte`

## Rôles MVP (scope réduit)

- `hero`: influence locale + position sur la carte.
- `faction`: contrôle de plusieurs territoires.
- `nation`: contrôle étendu.
- `gm`: peut déclencher des événements.

## IA locale (priorité absolue)

- App utilisable même avec `AI_ENABLED=false`.
- Providers backend uniquement (jamais côté frontend):
  - `mockProvider` (fallback garanti)
  - `ollamaProvider` (local)
- Sélection par variables d'environnement:
  - `AI_ENABLED=true|false`
  - `AI_PROVIDER=mock|ollama`
  - `OLLAMA_BASE_URL=http://localhost:11434`
  - `OLLAMA_CHAT_MODEL=qwen3:8b`
  - `OLLAMA_EMBED_MODEL=nomic-embed-text`

## Statut

- Dépôt Git initialisé.
- Base Git en place.
- Architecture MVP simplifiée validable avant génération du code.
