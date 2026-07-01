# UX Design — Monmon Quest

## Art direction

Retro 8/16-bit arcade feel, but **100% procedural** — every sprite is drawn on the canvas from coloured rectangles/circles, no image files. Chunky pixel grid, saturated palette, bold outlines. Monmons are readable silhouettes with a type-colour body and a face.

## Screens / states

1. **Title / Name entry**
   - Big logo "MONMON QUEST", a name input, "Start Adventure" button.
   - If a save exists on this device → shows "Welcome back, {name}" + Continue.
2. **Overworld (exploration)**
   - Centered viewport following the player on a tile map (grass, path, water, trees, tall-grass).
   - HUD top-left: player name, party count, Monmons caught. Top-right: buttons Menu / Leaderboard.
   - Movement: Arrow keys or WASD. On-screen D-pad for touch.
3. **Battle**
   - Split view: enemy Monmon top-right, your Monmon bottom-left, both with HP bars + level.
   - Action menu: **Fight** (expands to 4 typed moves) · **Catch** · **Run**.
   - Battle log line ("WILD PYRACAT USED EMBER!"), damage flashes, catch shake animation.
4. **Party / Menu overlay**
   - List of party Monmons with HP, level, type badge. Heal-at-start-of-game only (demo).
5. **Leaderboard overlay**
   - Top 20 players by (caught desc, wins desc), with your rank highlighted.

## Interaction rules

- One tile = 32px. Movement is grid-snapped, ~8 tiles visible.
- Encounter chance ~12% per step onto tall grass.
- Battle is fully keyboard/mouse/touch driven; number keys 1–4 pick moves.
- Autosave: after every battle end, catch, and every 10s of movement (debounced).

## Feedback & juice

- Screen shake on hits, colour flash on damage, particle burst on catch success.
- Type badge colours: Fire=#ff5a3c, Water=#3ca7ff, Grass=#4ecb5a, Electric=#ffd23c, Normal=#c9c9c9.

## Accessibility

- Keyboard-complete; large hit targets; high-contrast HUD text with outline.
