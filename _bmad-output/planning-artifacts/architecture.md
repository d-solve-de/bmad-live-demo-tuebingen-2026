# Architecture — Monmon Quest

## Architectural spine (invariants)

1. **Stateless app, stateful DB.** App instances hold no player state; all durable state lives in Firestore. This is what makes Cloud Run horizontal scaling and multi-user safe.
2. **Single deployable unit.** One Node container serves both the static game client and the JSON API. No separate frontend host, no build step for the client.
3. **Server owns the save; client owns the render.** The browser renders and plays; the server is the source of truth for a profile. Client sends compact state deltas, server validates & persists.
4. **Identity = anonymous userId.** A UUID minted client-side, stored in `localStorage`, sent as `x-user-id`. No auth system for the demo.
5. **No binary assets.** Everything is procedural → tiny image, fast cold starts.

## Component view

```
Browser (HTML5 Canvas)                 Cloud Run (Node/Express)            Firestore (native)
┌───────────────────────┐   REST/JSON  ┌───────────────────────┐  SDK    ┌────────────────────┐
│ game.js (engine)       │────────────▶│ server.js              │────────▶│ players/{userId}   │
│  - overworld/battle    │  x-user-id  │  GET  /api/health      │         │  {name,party,dex,  │
│  - input, render       │◀────────────│  POST /api/profile     │◀────────│   pos,caught,wins} │
│  - autosave client     │             │  GET  /api/profile     │         │                    │
│ index.html / style.css │             │  PUT  /api/profile     │         │ leaderboard = query│
└───────────────────────┘             │  GET  /api/leaderboard  │         └────────────────────┘
                                        │  static file serving   │
                                        └───────────────────────┘
```

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node 20 (LTS) | Small, fast cold start on Cloud Run |
| Web framework | Express 4 | Minimal, well-understood |
| DB client | `@google-cloud/firestore` | Uses Cloud Run's Application Default Credentials automatically |
| Client | Vanilla JS + Canvas 2D | No build step, no asset pipeline |
| Container | `node:20-slim` + `npm ci --omit=dev` | Lean image |
| Deploy | `gcloud run deploy --source` (Cloud Build) | One command, no local registry push |

## Data model — `players/{userId}`

```json
{
  "userId": "uuid",
  "name": "Ash",
  "createdAt": 1719849600000,
  "updatedAt": 1719849999000,
  "pos": { "x": 8, "y": 6 },
  "party": [ { "species": "pyracat", "level": 5, "xp": 0, "hp": 21, "maxHp": 21 } ],
  "dexSeen": ["pyracat","aquapup"],
  "dexCaught": ["pyracat"],
  "caught": 1,
  "wins": 0,
  "playSteps": 0
}
```

Leaderboard = `players` ordered by `caught desc, wins desc` limit 20 (server-side query; no separate collection needed).

## API contract

- `GET /api/health` → `{ ok, firestore: bool }` (readiness; degrades gracefully if DB missing).
- `POST /api/profile` `{ name }` → creates/returns profile for `x-user-id`.
- `GET /api/profile` → profile for `x-user-id` (404 if none).
- `PUT /api/profile` `{ pos, party, dexSeen, dexCaught, caught, wins, playSteps }` → validated merge-save.
- `GET /api/leaderboard` → `[{ name, caught, wins }]`.

## Scaling & failure posture

- Concurrency default (80/instance), min instances 0, max autoscale → many users, isolated docs.
- If Firestore is unreachable the client still plays locally (localStorage mirror) and retries saves; `/api/health` reports `firestore:false`.
- Server validates numeric bounds on save to keep leaderboard honest under demo load.

## Security notes (demo posture)

- No secrets in the image; Firestore auth via ADC / Cloud Run service account.
- Input validation + size caps on save payloads. CORS same-origin only.
