# lachatadede-engine

Deterministic 5v5 futsal match simulation engine for Lachatadede (Node.js + Fastify).

Same seed in, same match out — every time (NFR14). The seeded PRNG (`mulberry32`)
is the only randomness source; the simulation loop is free of `Math.random()`
and `Date.now()`.

## Game rules

60 ticks/second, 3 minutes per match (10,800 ticks), field 100x50, 5v5.
Constants live in `src/engine/constants.ts` and are copied exactly from
`_bmad-output/planning-artifacts/game-rules.md` (authoritative).

## Local development

```bash
npm install
npm run dev   # tsx watch on port 3001 (override with the PORT env var)
```

## Tests

```bash
npm test          # vitest run (node environment)
npm run test:watch
```

The determinism gate: two runs with the same seed must produce byte-identical
JSON output; different seeds must diverge.

## Build

```bash
npm run build     # tsc -> dist/
```

## API

### `GET /health`

```json
{ "status": "ok" }
```

### `POST /simulate`

Runs a full match synchronously and writes the frame file to
`{output_path}/{match_id}.json`.

```json
{
  "match_id": "uuid",
  "seed": 12345,
  "output_path": "/app/storage/simulations/",
  "challenger": {
    "players": [
      { "slot": 1, "x": 10, "y": 25, "script": "" }
    ]
  },
  "opponent": { "players": ["..."] }
}
```

- `match_id` — non-empty, must not contain path separators or `..`
- `seed` — integer in `[0, 4294967295]` (the PRNG state is 32-bit; larger values alias)
- `output_path` — directory the frame file is written to; use the shared
  storage mount (`/app/storage` in the compose deployment)

- `200` — `{ "success": true, "file": "...", "result": { "score_challenger": 0, "score_opponent": 0, "duration_frames": 10800 } }`
- `422` — invalid payload (`{ "success": false, "error": "..." }`)
- `500` — internal failure (`{ "success": false, "error": "..." }`)

## Docker

Build context is this directory (see `deploy/docker/Dockerfile.node`):

```bash
docker build -f ../deploy/docker/Dockerfile.node --target production .
```

The `node` service in `deploy/docker-compose.yml` mounts
`lachatadede-api/storage` at `/app/storage`; Laravel passes `output_path`
pointing there so both services share the frame files.
