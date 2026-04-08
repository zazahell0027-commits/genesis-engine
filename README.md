# Genesis Engine

Genesis Engine est un moteur de simulation web orienté mondes vivants.
Le projet vise une base modulaire, stable et extensible, sans dépendance cloud obligatoire.

## État Actuel (MVP exécuté)

- Landing + formulaire de création de monde.
- Monde démo chargeable en un clic.
- Carte 2D en grille (une case = territoire).
- Sélection de territoire + panneau local détaillé.
- Factions initiales générées selon type/complexité.
- Tick de simulation déterministe avec influence des voisins.
- Bascule de contrôle territorial (owner) sous tension.
- Feed d'événements (auto + manuel).
- Backend TypeScript (Express) + frontend React/Vite.
- IA non bloquante via `MockProvider`.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Contrats partagés: package `@genesis/shared`
- Données: mémoire serveur (pas de DB pour le MVP)

## Structure

```text
genesis-engine/
  client/
    src/
      App.tsx
      api.ts
      main.tsx
      styles.css
  server/
    src/
      app.ts
      config.ts
      index.ts
      routes.ts
      simulation.ts
      world.ts
      ai/
        index.ts
        types.ts
        providers/
          mockProvider.ts
  shared/
    src/
      contracts.ts
      index.ts
```

## API MVP

- `GET /health`
- `POST /world/create`
- `POST /world/demo`
- `POST /world/tick`
- `POST /world/event`
- `GET /world/:worldId`

## Variables d'environnement

Copier `.env.example` vers `.env`.

Variables principales:

- `SERVER_PORT=4000`
- `VITE_API_BASE_URL=http://localhost:4000`
- `AI_ENABLED=false`
- `AI_PROVIDER=mock`

## Lancer le projet

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Inspiration produit

Inspiration de haut niveau: expérience sandbox historique/fictive, carte centrale et progression temporelle.
Genesis Engine reste distinct par sa modularité de rôles (`hero`, `faction`, `nation`, `gm`) et son architecture moteur-first.

## Suite recommandée

1. Ajouter un mode d'action local `hero` (influence ciblée sur une case).
2. Ajouter un mini dashboard rôle-dépendant sans surcharger l'UI.
3. Préparer l'adaptateur `OllamaProvider` (optionnel, non bloquant).
