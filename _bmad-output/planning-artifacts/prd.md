# PRD — Monmon Quest

**Author:** BMad Method (YOLO run) · **Owner:** Fp-linux · **Date:** 2026-07-01 · **Status:** Approved for build

## 1. Vision

A browser-based, single-player 2D creature-catching adventure inspired by classic Pokémon. Players explore a tile world, encounter wild "Monmons" in tall grass, battle them turn-based, catch them, and build a team. All progress persists server-side (Firestore) so a player can return on any device, and a global leaderboard makes it multi-user.

## 2. Goals

- G1 — Deliver a playable 2D top-down monster-catcher that runs in any modern browser with no install.
- G2 — Persist each player's save (party, Monmon-dex, position, stats) on the backend.
- G3 — Support many concurrent users, each with an isolated profile, plus a shared leaderboard.
- G4 — Ship as a single container on Google Cloud Run with a public URL.

## 3. Non-Goals

- No multiplayer battles / real-time PvP (single-player only).
- No copyrighted Pokémon assets — all creatures, names and art are original/procedural.
- No login/passwords for the demo — identity is an anonymous device-bound `userId`.

## 4. Personas

- **Demo Viewer** — opens the URL, picks a name, plays a few minutes, wants instant fun.
- **Returning Player** — comes back later; expects their team and progress restored.

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Player enters a display name and receives a persistent profile. | Must |
| FR2 | Top-down grid world the player walks with arrow/WASD keys. | Must |
| FR3 | Stepping on grass tiles has a chance to trigger a wild encounter. | Must |
| FR4 | Turn-based battle: Fight (typed moves), Catch, Run. | Must |
| FR5 | Type-effectiveness chart affects damage (Fire/Water/Grass/Electric/Normal). | Must |
| FR6 | Caught Monmons join the party; party has HP, level and XP. | Must |
| FR7 | Winning battles grants XP; leveling raises stats. | Must |
| FR8 | Monmon-dex tracks which species have been seen/caught. | Should |
| FR9 | Progress auto-saves to Firestore and restores on return. | Must |
| FR10 | Global leaderboard ranks players by Monmons caught & battles won. | Must |
| FR11 | Solution serves many concurrent users with isolated saves. | Must |

## 6. Non-Functional Requirements

- NFR1 — First interactive frame < 2s on broadband.
- NFR2 — Stateless app instances; all state in Firestore → horizontal scale on Cloud Run.
- NFR3 — No external image/audio assets; sprites drawn procedurally (fast, self-contained container).
- NFR4 — API responses < 300ms p95 for save/load under demo load.

## 7. Success Metrics

- A public Cloud Run URL loads the game and a first battle can be completed.
- Reloading the page restores the exact party & position from Firestore.
- Two different browsers/users produce two independent saves + both appear on the leaderboard.

## 8. Release Scope (this build)

Everything under FR1–FR11. Deployment target: Cloud Run, project `bmad-demo-501112`, Firestore (native mode) for persistence.
