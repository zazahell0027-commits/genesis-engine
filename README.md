# Genesis Atlas

Strategic atlas for alternate-history campaigns with:
- Preset browser + launch flow
- Full-screen map gameplay
- Orders, quick actions, diplomacy, advisor
- Timeline snapshots and event window
- Local persistence with SQLite

## Stack
- Client: React + Vite + TypeScript
- Server: Express + TypeScript
- Shared contracts: `shared/`
- Persistence: SQLite (`node:sqlite`)

## Monorepo
- `client/` web UI
- `server/` API + simulation + persistence
- `shared/` shared types

## Local Run
```powershell
cd C:\Users\Zizi\Documents\genesis-engine
npm install
$env:AI_PROVIDER="ollama"
$env:OLLAMA_CHAT_MODEL="mistral:latest"
npm run dev
```

Client: `http://localhost:5173`  
Server: `http://localhost:4000`

If port `4000` is busy:
```powershell
$env:SERVER_PORT="4102"
$env:VITE_API_BASE_URL="http://localhost:4102"
npm run dev
```

## Persistence
Game state is saved automatically in SQLite:
- Default path: `server/.data/genesis.sqlite`
- Override with env: `SERVER_DB_PATH`

## Tests
```powershell
cd C:\Users\Zizi\Documents\genesis-engine
npm test
```

Current suite validates:
- `/health`
- advisor output structure
- token earn/spend API

## API (Main)
Gameplay:
- `POST /game/start`
- `GET /game/:gameId`
- `POST /game/order`
- `POST /game/quick-action`
- `POST /game/order/remove`
- `POST /game/jump`
- `POST /game/jump/major-event`
- `POST /game/diplomacy`
- `POST /game/advisor`

Preset/browser:
- `GET /presets`
- `GET /presets/categories`
- `GET /presets/:presetId/setup`
- `GET /countries`

Persistent APIs:
- `GET /api/presets`
- `GET /api/games`
- `POST /api/games`
- `GET /api/games/:gameId`
- `DELETE /api/games/:gameId`
- `GET /api/tokens`
- `POST /api/tokens/earn`
- `POST /api/tokens/spend`

## Deployment Notes
- Ensure your LLM service (e.g. Ollama) is running before server start.
- Keep `SERVER_DB_PATH` on persistent volume in production.
- Add CI steps for `npm run typecheck`, `npm test`, `npm run build`.

## Docs
- Architecture overview: `docs/ARCHITECTURE.md`
- MapLibre tooling shortlist: `docs/maplibre-tooling.md`
