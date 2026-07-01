# Epics & Stories — Monmon Quest

## Epic 1 — Backend & persistence
- **S1.1** Express server serves static client + `/api/health`. _AC:_ health returns `{ok:true}`.
- **S1.2** Firestore integration with ADC; `players/{userId}` CRUD. _AC:_ profile survives restart.
- **S1.3** Profile API (POST/GET/PUT) keyed by `x-user-id` with validation. _AC:_ two users → two docs.
- **S1.4** Leaderboard query (caught desc, wins desc, limit 20). _AC:_ ranks reflect saved data.

## Epic 2 — Overworld engine
- **S2.1** Canvas render loop + camera following player. _AC:_ 60fps idle, viewport centered.
- **S2.2** Tile map (grass/path/water/tree/tall-grass) with collision. _AC:_ can't walk through trees/water.
- **S2.3** Grid movement (WASD/arrows/touch D-pad). _AC:_ smooth grid-snapped steps.
- **S2.4** Random encounter trigger on tall-grass steps. _AC:_ ~12% chance → battle.

## Epic 3 — Battle system
- **S3.1** Turn-based battle state machine (intro→player→enemy→resolve). _AC:_ no soft-locks.
- **S3.2** Typed moves + effectiveness chart + damage/HP. _AC:_ super-effective ~2x, resisted ~0.5x.
- **S3.3** Catch mechanic with shake animation & probability from enemy HP. _AC:_ low HP → higher catch rate.
- **S3.4** XP/leveling on win; stat growth. _AC:_ level up increases maxHp & power.

## Epic 4 — Progression & meta
- **S4.1** Party management + Monmon-dex tracking. _AC:_ caught species enter dex & party.
- **S4.2** Autosave client (debounced) + restore on load. _AC:_ reload restores party & position.
- **S4.3** Leaderboard overlay with self-highlight. _AC:_ current player highlighted in list.
- **S4.4** Title / name-entry / continue flow. _AC:_ returning device shows "welcome back".

## Epic 5 — Ship it
- **S5.1** Dockerfile (node:20-slim, npm ci). _AC:_ image builds & runs locally.
- **S5.2** Enable APIs + Firestore native DB in `bmad-demo-501112`. _AC:_ DB exists.
- **S5.3** Deploy to Cloud Run `--source`, public URL. _AC:_ URL loads game, battle completes, save persists.

## Sprint order
E1 → E2 → E3 → E4 → E5 (E1 & E2 partially parallel; battle depends on overworld encounter hook).
