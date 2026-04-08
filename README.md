# Genesis Engine

Genesis Engine est un moteur de simulation web orienté mondes vivants.
Le projet vise une base modulaire, stable et extensible, sans dépendance cloud obligatoire.

## État Actuel (MVP+)

- Landing + formulaire de création de monde.
- Monde démo chargeable en un clic.
- Carte 2D en grille (une case = territoire).
- Carte monde 2D interactive (pays stylisés, sélection de territoires).
- Continents générés et visibles sur la carte de territoires.
- Sélection de territoire + panneau local détaillé.
- Factions générées selon type/complexité et ownership initial.
- Scénario historique de base: `earth-2010` (départ en 2010).
- Boucle de tour type stratégie: soumettre jusqu'à 3 ordres, puis résoudre le tour.
- Tick déterministe avec influence des voisins + exécution des ordres planifiés.
- Commandes textuelles de tour (ex: `Investir en France`) converties en actions simulées.
- Rapport de résolution du tour avec highlights causes -> conséquences.
- Bascule de contrôle territorial (owner) en situation de crise.
- Feed d'événements (auto + manuel).
- Actions locales joueur sur territoire (`stabilize`, `invest`, `influence`, `disrupt`) via file d'ordres.
- Narration IA locale via backend (`/world/briefing`).
- Fallback automatique mock si IA désactivée ou indisponible.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Contrats partagés: package `@genesis/shared`
- Données: mémoire serveur (pas de DB pour le MVP)
- IA locale: Ollama (optionnel)

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
          ollamaProvider.ts
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
- `POST /world/action` (legacy direct)
- `POST /world/action/queue`
- `POST /world/action/remove`
- `POST /world/command/submit`
- `POST /world/command/remove`
- `POST /world/resolve`
- `POST /world/briefing`
- `GET /world/:worldId`

## Variables d'environnement

Copier `.env.example` vers `.env`.

- `SERVER_PORT=4000`
- `VITE_API_BASE_URL=http://localhost:4000`
- `AI_ENABLED=false`
- `AI_PROVIDER=mock` ou `ollama`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_CHAT_MODEL=qwen3:8b`
- `OLLAMA_TIMEOUT_MS=12000`

## Activer l'IA locale Ollama

1. Lancer Ollama localement.
2. Vérifier les modèles installés: `curl http://localhost:11434/api/tags`
3. Mettre `.env`:

```env
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3:8b
```

Notes:

- Si le modèle configuré n'est pas disponible, le provider tente un modèle local disponible.
- Si Ollama est indisponible, le jeu reste jouable avec narration mock.

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

1. Ajouter des actions de rôle (`hero`, `faction`, `nation`, `gm`) qui influencent la simulation.
2. Ajouter des objectifs narratifs (quêtes courts terme) pour renforcer le fun.
3. Ajouter mémoire légère des faits marquants pour continuité IA.
