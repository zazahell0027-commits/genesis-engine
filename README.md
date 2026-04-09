# Genesis Engine

Genesis Engine is a web strategy sandbox focused on one core loop:

1. Pick a scenario and a country.
2. Write text orders and diplomacy messages.
3. Jump time forward.
4. Read consequences on map and events.
5. Adapt strategy and repeat.

## Current Restart Scope

This version is a full restart of the previous codebase.

Included now:
- Scenario start flow (`Earth 2010`)
- Full country list with search (175 countries)
- Interactive world map (bloc / tension / stability lenses)
- Text order system with queue and removal
- Time jump system (`week`, `month`, `quarter`, `year`)
- `Next Major Event` jump
- Diplomacy messaging with simulated stance/reply
- Event feed and round summary
- Advisor endpoint (mock by default, backend-only)

## Stack

- Client: React + Vite + TypeScript
- Server: Node.js + Express + TypeScript
- Shared contracts package: TypeScript
- Data: in-memory game state

## Monorepo Structure

- `client/` React application
- `server/` API and simulation engine
- `shared/` shared contracts used by client/server

## Run Local

```bash
cd C:\Users\Zizi\Documents\genesis-engine
npm install
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:4000`

## API Surface (MVP)

- `GET /health`
- `GET /scenarios`
- `GET /countries?scenarioId=earth-2010`
- `POST /game/start`
- `GET /game/:gameId`
- `POST /game/order`
- `POST /game/order/remove`
- `POST /game/jump`
- `POST /game/jump/major-event`
- `POST /game/diplomacy`
- `POST /game/advisor`

## Next Priorities

1. Country-level attack/defend quick actions on map click
2. Preset browser UI (cards + categories + metadata)
3. Continent and regional pressure overlays
4. Better diplomacy memory and bilateral relation history
5. Optional Ollama narrative mode for richer advisor output
