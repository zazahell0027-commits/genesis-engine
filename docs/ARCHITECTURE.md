# Architecture Overview

## High-Level Flow
1. Client calls API routes on the server.
2. Server mutates `GameState` through simulation services.
3. Updated state is persisted to SQLite.
4. Client reloads game and renders map + overlays.

## Server Modules
- `src/routes.ts`: HTTP contract and orchestration.
- `src/simulation.ts`: round resolution, map effects, diplomacy outcomes.
- `src/world.ts`: world/preset catalog, game lifecycle, snapshots, timelines.
- `src/database.ts`: SQLite access for games and wallets.
- `src/ai/`: provider abstraction (`mock`, `ollama`) and prompt shaping.

## Persistence Model

### `games`
- `id` (PK)
- `presetId`
- `stateJson` (full serialized `GameState`)
- `tokenBalance`
- `createdAt`
- `updatedAt`

### `wallets`
- `userId` (PK)
- `balance`
- `updatedAt`

## Client Surfaces
- Preset browser (`/`, `/presets`)
- Library pages (`/games`, `/flags`, `/community`)
- Full-screen game route (`/game/:id`)
  - Event window
  - Timeline panel
  - Actions/chats/advisor/search panels
  - Interactive world map with map effects

## Shared Contracts
`shared/src/contracts.ts` is the source of truth for:
- `GameState`
- `PresetSummary`
- `GameEvent`, `MapEffect`
- Advisor response/suggestions

## Testing Strategy
- API tests with Jest + Supertest in `server/tests/`.
- Focus areas:
  - Route health
  - Advisor output contract
  - Token economy endpoints

## Performance Notes
- Simulation currently runs in-process.
- SQLite writes are lightweight upserts per game mutation.
- Next optimization targets:
  - batch simulation workers
  - memoized scoring for large country sets
  - snapshot compaction for long sessions
