/* Monmon Quest - client engine (vanilla Canvas 2D) */
'use strict';

// ---------------------------------------------------------------------------
// Constants & data
// ---------------------------------------------------------------------------
const TILE = 32;
const VIEW_W = 512, VIEW_H = 384;           // canvas logical size
const COLS = Math.floor(VIEW_W / TILE);      // 16
const ROWS = Math.floor(VIEW_H / TILE);      // 12
const MAP_W = 40, MAP_H = 30;
const ENCOUNTER_RATE = 0.12;

const TYPE_COLORS = {
  Fire: '#ff5a3c', Water: '#3ca7ff', Grass: '#4ecb5a',
  Electric: '#ffd23c', Normal: '#c9c9c9'
};

// effectiveness[attack][defend]
const TYPE_CHART = {
  Fire:     { Grass: 2, Water: .5, Fire: .5 },
  Water:    { Fire: 2, Grass: .5, Water: .5 },
  Grass:    { Water: 2, Fire: .5, Grass: .5 },
  Electric: { Water: 2, Grass: .5, Electric: .5 },
  Normal:   {}
};
function effectiveness(atk, def) {
  return (TYPE_CHART[atk] && TYPE_CHART[atk][def]) || 1;
}

const MOVES = {
  Fire:     [{ name: 'Ember', type: 'Fire', power: 7 }, { name: 'Flame Burst', type: 'Fire', power: 11 }],
  Water:    [{ name: 'Bubble', type: 'Water', power: 7 }, { name: 'Aqua Jet', type: 'Water', power: 11 }],
  Grass:    [{ name: 'Vine Whip', type: 'Grass', power: 7 }, { name: 'Leaf Blade', type: 'Grass', power: 11 }],
  Electric: [{ name: 'Spark', type: 'Electric', power: 7 }, { name: 'Thunderbolt', type: 'Electric', power: 11 }],
  Normal:   [{ name: 'Tackle', type: 'Normal', power: 6 }, { name: 'Body Slam', type: 'Normal', power: 10 }]
};
function movesFor(type) {
  return [...(MOVES[type] || MOVES.Normal), ...MOVES.Normal].slice(0, 4);
}

// species: baseHp, power, type, shape hint
const SPECIES = {
  pyracat:   { name: 'Pyracat',   type: 'Fire',     baseHp: 20, ears: true,  fin: false },
  emberfox:  { name: 'Emberfox',  type: 'Fire',     baseHp: 22, ears: true,  fin: false },
  aquapup:   { name: 'Aquapup',   type: 'Water',    baseHp: 22, ears: true,  fin: true },
  coralray:  { name: 'Coralray',  type: 'Water',    baseHp: 24, ears: false, fin: true },
  floralynx: { name: 'Floralynx', type: 'Grass',    baseHp: 21, ears: true,  fin: false },
  thornmoth: { name: 'Thornmoth', type: 'Grass',    baseHp: 19, ears: false, fin: false, wings: true },
  voltbunny: { name: 'Voltbunny', type: 'Electric', baseHp: 18, ears: true,  fin: false },
  sparkit:   { name: 'Sparkit',   type: 'Electric', baseHp: 17, ears: true,  fin: false },
  terrapup:  { name: 'Terrapup',  type: 'Normal',   baseHp: 25, ears: true,  fin: false },
  pebblup:   { name: 'Pebblup',   type: 'Normal',   baseHp: 26, ears: false, fin: false, rock: true }
};
const SPECIES_KEYS = Object.keys(SPECIES);
const WILD_POOL = SPECIES_KEYS; // any species can appear wild
const STARTERS = ['pyracat', 'aquapup', 'floralynx'];

function maxHpFor(species, level) {
  return SPECIES[species].baseHp + level * 3;
}
function makeMon(species, level) {
  const mHp = maxHpFor(species, level);
  return { species, level, xp: 0, hp: mHp, maxHp: mHp };
}

// ---------------------------------------------------------------------------
// Seeded map generation (deterministic across reloads)
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// tiles: 0 grass, 1 path, 2 tallgrass, 3 tree, 4 water
function buildMap() {
  const rnd = mulberry32(133742);
  const m = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      let t = 0;
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) t = 3; // border trees
      else if (rnd() < 0.05) t = 3;
      row.push(t);
    }
    m.push(row);
  }
  // a pond
  for (let y = 4; y < 9; y++) for (let x = 24; x < 31; x++) {
    if (Math.hypot(x - 27, y - 6) < 3.2) m[y][x] = 4;
  }
  // tall-grass patches
  const patches = [[5, 4], [12, 10], [20, 16], [8, 20], [30, 18], [16, 22], [33, 8]];
  for (const [px, py] of patches) {
    for (let y = py; y < py + 5; y++) for (let x = px; x < px + 6; x++) {
      if (m[y] && m[y][x] === 0 && rnd() < 0.8) m[y][x] = 2;
    }
  }
  // clear a spawn area around (8,6)
  for (let y = 5; y <= 7; y++) for (let x = 7; x <= 9; x++) m[y][x] = 1;
  return m;
}
const MAP = buildMap();
function tileAt(x, y) {
  if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) return 3;
  return MAP[y][x];
}
function blocked(x, y) {
  const t = tileAt(x, y);
  return t === 3 || t === 4;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const State = {
  mode: 'title',            // title | overworld | battle
  profile: null,            // server profile
  player: { x: 8, y: 6, dir: 'down' },
  party: [],
  dexSeen: new Set(),
  dexCaught: new Set(),
  wins: 0,
  playSteps: 0,
  battle: null,
  moving: false,
  animTime: 0
};

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------
function getUserId() {
  let id = localStorage.getItem('monmon_uid');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
         ('u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
    localStorage.setItem('monmon_uid', id);
  }
  return id;
}
const USER_ID = getUserId();

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok && res.status !== 404) throw new Error(path + ' -> ' + res.status);
  return res.status === 404 ? null : res.json();
}

function profilePayload() {
  return {
    name: State.profile ? State.profile.name : 'Trainer',
    pos: { x: State.player.x, y: State.player.y },
    party: State.party,
    dexSeen: [...State.dexSeen],
    dexCaught: [...State.dexCaught],
    wins: State.wins,
    playSteps: State.playSteps
  };
}

let saveTimer = null;
function scheduleSave(delay = 1500) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, delay);
}
async function saveNow() {
  clearTimeout(saveTimer);
  try {
    const p = await api('PUT', '/api/profile', profilePayload());
    if (p) State.profile = p;
  } catch (e) { console.warn('save failed', e.message); }
}

function loadProfileIntoState(p) {
  State.profile = p;
  State.player.x = (p.pos && p.pos.x) || 8;
  State.player.y = (p.pos && p.pos.y) || 6;
  State.party = (p.party && p.party.length ? p.party : []).map(m => ({ ...m }));
  State.dexSeen = new Set(p.dexSeen || []);
  State.dexCaught = new Set(p.dexCaught || []);
  State.wins = p.wins || 0;
  State.playSteps = p.playSteps || 0;
}

// ---------------------------------------------------------------------------
// Rendering: sprites (procedural)
// ---------------------------------------------------------------------------
function drawMon(c, cx, cy, r, species, facingLeft) {
  const s = SPECIES[species];
  const col = TYPE_COLORS[s.type];
  c.save();
  c.translate(cx, cy);
  if (facingLeft) c.scale(-1, 1);
  // shadow
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath(); c.ellipse(0, r * 0.9, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); c.fill();
  // wings (thornmoth)
  if (s.wings) {
    c.fillStyle = shade(col, -20);
    c.beginPath(); c.ellipse(-r * 0.7, -r * 0.1, r * 0.6, r * 0.9, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * 0.7, -r * 0.1, r * 0.6, r * 0.9, -0.4, 0, Math.PI * 2); c.fill();
  }
  // ears
  if (s.ears) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.6); c.lineTo(-r * 0.75, -r * 1.25); c.lineTo(-r * 0.15, -r * 0.75); c.fill();
    c.beginPath(); c.moveTo(r * 0.5, -r * 0.6); c.lineTo(r * 0.75, -r * 1.25); c.lineTo(r * 0.15, -r * 0.75); c.fill();
  }
  // body
  c.fillStyle = col;
  c.strokeStyle = '#000'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 0, r * 0.8, r * 0.85, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // rock plates (pebblup)
  if (s.rock) {
    c.fillStyle = shade(col, -35);
    c.fillRect(-r * 0.5, -r * 0.2, r * 0.35, r * 0.35);
    c.fillRect(r * 0.15, 0, r * 0.35, r * 0.3);
  }
  // fin (water types)
  if (s.fin) {
    c.fillStyle = shade(col, 25);
    c.beginPath(); c.moveTo(0, -r * 0.85); c.lineTo(-r * 0.25, -r * 1.3); c.lineTo(r * 0.2, -r * 0.9); c.fill();
  }
  // belly
  c.fillStyle = shade(col, 45);
  c.beginPath(); c.ellipse(0, r * 0.25, r * 0.4, r * 0.45, 0, 0, Math.PI * 2); c.fill();
  // eyes
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(-r * 0.28, -r * 0.1, r * 0.16, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(r * 0.28, -r * 0.1, r * 0.16, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111';
  c.beginPath(); c.arc(-r * 0.24, -r * 0.08, r * 0.08, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(r * 0.32, -r * 0.08, r * 0.08, 0, Math.PI * 2); c.fill();
  // spark cheeks for electric
  if (s.type === 'Electric') {
    c.fillStyle = '#ffe66b';
    c.beginPath(); c.arc(-r * 0.5, r * 0.15, r * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * 0.5, r * 0.15, r * 0.12, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

function drawPlayer(c, cx, cy, dir) {
  c.save(); c.translate(cx, cy);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath(); c.ellipse(0, 12, 11, 4, 0, 0, Math.PI * 2); c.fill();
  // body
  c.fillStyle = '#3ca7ff'; c.strokeStyle = '#000'; c.lineWidth = 2;
  c.fillRect(-8, -4, 16, 16); c.strokeRect(-8, -4, 16, 16);
  // head
  c.fillStyle = '#ffd9a8';
  c.beginPath(); c.arc(0, -10, 8, 0, Math.PI * 2); c.fill(); c.stroke();
  // cap
  c.fillStyle = '#ff5a3c';
  c.beginPath(); c.arc(0, -12, 8, Math.PI, 0); c.fill();
  c.fillRect(-8, -13, 16, 3);
  if (dir === 'down' || dir === 'up') { c.fillStyle = '#111';
    if (dir === 'down') { c.fillRect(-4, -11, 2, 2); c.fillRect(2, -11, 2, 2); } }
  c.restore();
}

// ---------------------------------------------------------------------------
// Rendering: overworld
// ---------------------------------------------------------------------------
function drawTile(t, px, py, wobble) {
  switch (t) {
    case 0: ctx.fillStyle = '#2e7d32'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#379a3b'; ctx.fillRect(px + 6, py + 8, 3, 3); ctx.fillRect(px + 20, py + 18, 3, 3); break;
    case 1: ctx.fillStyle = '#c9a86a'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#b9975a'; ctx.fillRect(px + 4, py + 4, 4, 4); ctx.fillRect(px + 22, py + 20, 4, 4); break;
    case 2: ctx.fillStyle = '#256b2a'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#3fae44';
            for (let i = 0; i < 5; i++) {
              const bx = px + 3 + i * 6, sway = Math.sin(wobble + i) * 1.5;
              ctx.fillRect(bx + sway, py + 10, 3, 18);
            } break;
    case 3: ctx.fillStyle = '#2e7d32'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#4b2e15'; ctx.fillRect(px + 13, py + 18, 6, 12);
            ctx.fillStyle = '#1f6b34'; ctx.beginPath(); ctx.arc(px + 16, py + 13, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a8a44'; ctx.beginPath(); ctx.arc(px + 12, py + 11, 6, 0, Math.PI * 2); ctx.fill(); break;
    case 4: ctx.fillStyle = '#2775c9'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#4a9be0'; ctx.fillRect(px + 3, py + 6 + Math.sin(wobble) * 1, TILE - 8, 2);
            ctx.fillRect(px + 6, py + 18 + Math.cos(wobble) * 1, TILE - 12, 2); break;
  }
}

function renderOverworld(dt) {
  State.animTime += dt;
  const wob = State.animTime * 4;
  // camera: center on player
  let camX = State.player.x - Math.floor(COLS / 2);
  let camY = State.player.y - Math.floor(ROWS / 2);
  camX = Math.max(0, Math.min(MAP_W - COLS, camX));
  camY = Math.max(0, Math.min(MAP_H - ROWS, camY));

  ctx.fillStyle = '#0c1a12';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let ry = 0; ry < ROWS; ry++) {
    for (let rx = 0; rx < COLS; rx++) {
      const mx = camX + rx, my = camY + ry;
      drawTile(tileAt(mx, my), rx * TILE, ry * TILE, wob + rx);
    }
  }
  // player
  const psx = (State.player.x - camX) * TILE + TILE / 2;
  const psy = (State.player.y - camY) * TILE + TILE / 2;
  drawPlayer(ctx, psx, psy, State.player.dir);
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------
function tryMove(dir) {
  if (State.mode !== 'overworld' || State.moving) return;
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  if (!d) return;
  State.player.dir = dir;
  const nx = State.player.x + d[0], ny = State.player.y + d[1];
  if (blocked(nx, ny)) return;
  State.moving = true;
  State.player.x = nx; State.player.y = ny;
  State.playSteps++;
  setTimeout(() => { State.moving = false; }, 110);

  if (tileAt(nx, ny) === 2 && Math.random() < ENCOUNTER_RATE) {
    startBattle();
  } else {
    scheduleSave(4000);
  }
}

// ---------------------------------------------------------------------------
// Battle system
// ---------------------------------------------------------------------------
function activeMon() {
  return State.party.find(m => m.hp > 0) || State.party[0];
}
function wildLevel() {
  const base = Math.max(3, Math.round((State.party.reduce((a, m) => a + m.level, 0) / Math.max(1, State.party.length)) || 4));
  return Math.max(2, base - 1 + Math.floor(Math.random() * 3));
}

function startBattle() {
  const species = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)];
  const lvl = wildLevel();
  const enemy = makeMon(species, lvl);
  const mine = activeMon();
  if (!mine || mine.hp <= 0) { healParty(); }
  State.dexSeen.add(species);
  State.battle = {
    enemy, mine: activeMon(), phase: 'menu', log: `A wild ${SPECIES[species].name} (Lv${lvl}) appeared!`,
    shake: 0, flashEnemy: 0, flashMine: 0, catchShake: 0, ballThrown: false, ended: false
  };
  State.mode = 'battle';
  showBattleUI(true);
  renderBattleUI();
  scheduleSave(3000);
}

function healParty() {
  State.party.forEach(m => { m.hp = m.maxHp; });
}

function typeMul(move, defender) {
  return effectiveness(move.type, SPECIES[defender.species].type);
}
function calcDamage(attacker, move, defender) {
  const levelScale = 1 + (attacker.level - 1) * 0.06;
  const eff = typeMul(move, defender);
  const rand = 0.85 + Math.random() * 0.15;
  return { dmg: Math.max(1, Math.round(move.power * levelScale * eff * rand)), eff };
}

function playerMove(moveIndex) {
  const b = State.battle;
  if (!b || b.phase !== 'menu') return;
  const mine = b.mine;
  const move = movesFor(SPECIES[mine.species].type)[moveIndex];
  b.phase = 'anim';
  const { dmg, eff } = calcDamage(mine, move, b.enemy);
  b.enemy.hp = Math.max(0, b.enemy.hp - dmg);
  b.flashEnemy = 0.3; b.shake = 0.3;
  b.log = `${SPECIES[mine.species].name} used ${move.name}!` + effText(eff);
  renderBattleUI();
  setTimeout(() => {
    if (b.enemy.hp <= 0) return winBattle();
    enemyTurn();
  }, 750);
}

function effText(eff) {
  if (eff >= 2) return ' Super effective!';
  if (eff <= 0.5) return ' Not very effective…';
  return '';
}

function enemyTurn() {
  const b = State.battle;
  const move = movesFor(SPECIES[b.enemy.species].type)[Math.floor(Math.random() * 2)];
  const { dmg, eff } = calcDamage(b.enemy, move, b.mine);
  b.mine.hp = Math.max(0, b.mine.hp - dmg);
  b.flashMine = 0.3; b.shake = 0.3;
  b.log = `Wild ${SPECIES[b.enemy.species].name} used ${move.name}!` + effText(eff);
  renderBattleUI();
  setTimeout(() => {
    // sync hp back to party member
    const pm = State.party.find(m => m === b.mine) || State.party[0];
    if (pm) pm.hp = b.mine.hp;
    if (b.mine.hp <= 0) {
      const next = State.party.find(m => m.hp > 0);
      if (next) { b.mine = next; b.log = `Go, ${SPECIES[next.species].name}!`; b.phase = 'menu'; renderBattleUI(); }
      else return loseBattle();
    } else {
      b.phase = 'menu'; renderBattleUI();
    }
  }, 750);
}

function tryCatch() {
  const b = State.battle;
  if (!b || b.phase !== 'menu') return;
  b.phase = 'anim'; b.ballThrown = true;
  const ratio = b.enemy.hp / b.enemy.maxHp;
  const p = Math.max(0.05, Math.min(0.9, (1 - ratio) * 0.6 + 0.2));
  const success = Math.random() < p;
  b.log = 'You threw a Monmon Ball…';
  renderBattleUI();
  let shakes = 0;
  const shakeInt = setInterval(() => {
    shakes++; b.catchShake = 0.4; renderBattleUI();
    if (shakes >= 3) {
      clearInterval(shakeInt);
      b.ballThrown = false;
      if (success) return catchSuccess();
      b.log = `${SPECIES[b.enemy.species].name} broke free!`;
      renderBattleUI();
      setTimeout(enemyTurn, 700);
    }
  }, 450);
}

function catchSuccess() {
  const b = State.battle;
  const caught = makeMon(b.enemy.species, b.enemy.level);
  State.dexCaught.add(b.enemy.species);
  if (State.party.length < 6) State.party.push(caught);
  b.log = `Gotcha! ${SPECIES[b.enemy.species].name} was caught!`;
  b.ended = true; b.phase = 'over';
  renderBattleUI();
  toast(`Caught ${SPECIES[b.enemy.species].name}! 🎉`);
  setTimeout(endBattle, 1400);
}

function winBattle() {
  const b = State.battle;
  b.phase = 'over'; b.ended = true;
  State.wins++;
  const gain = b.enemy.level * 8;
  const winner = b.mine;
  winner.xp += gain;
  let leveled = false;
  while (winner.xp >= winner.level * 30) {
    winner.xp -= winner.level * 30;
    winner.level++;
    const nm = maxHpFor(winner.species, winner.level);
    winner.hp += (nm - winner.maxHp); winner.maxHp = nm;
    leveled = true;
  }
  // sync
  const pm = State.party.find(m => m === winner);
  if (pm) { pm.xp = winner.xp; pm.level = winner.level; pm.hp = winner.hp; pm.maxHp = winner.maxHp; }
  b.log = `You won! +${gain} XP` + (leveled ? ` — ${SPECIES[winner.species].name} grew to Lv${winner.level}!` : '');
  renderBattleUI();
  setTimeout(endBattle, 1400);
}

function loseBattle() {
  const b = State.battle;
  b.phase = 'over'; b.ended = true;
  b.log = 'Your team fainted! You scurry home and heal.';
  renderBattleUI();
  healParty();
  State.player.x = 8; State.player.y = 6;
  setTimeout(endBattle, 1400);
}

function runBattle() {
  const b = State.battle;
  if (!b || b.phase !== 'menu') return;
  if (Math.random() < 0.75) { b.log = 'Got away safely!'; b.phase = 'over'; b.ended = true; renderBattleUI(); setTimeout(endBattle, 700); }
  else { b.log = "Couldn't escape!"; b.phase = 'anim'; renderBattleUI(); setTimeout(enemyTurn, 700); }
}

function endBattle() {
  State.battle = null;
  State.mode = 'overworld';
  showBattleUI(false);
  updateHUD();
  saveNow();
}

// ---------------------------------------------------------------------------
// Battle rendering (canvas + DOM)
// ---------------------------------------------------------------------------
function renderBattleScene(dt) {
  const b = State.battle; if (!b) return;
  const sh = b.shake > 0 ? (Math.random() - 0.5) * 8 * b.shake : 0;
  b.shake = Math.max(0, b.shake - dt * 2);
  b.flashEnemy = Math.max(0, b.flashEnemy - dt * 2);
  b.flashMine = Math.max(0, b.flashMine - dt * 2);
  b.catchShake = Math.max(0, b.catchShake - dt * 2);

  // backdrop
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#7ec0ff'); g.addColorStop(1, '#bfe9a0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#3fae44';
  ctx.beginPath(); ctx.ellipse(370, 170, 90, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(150, 320, 120, 34, 0, 0, Math.PI * 2); ctx.fill();

  // enemy (top-right)
  ctx.save(); ctx.translate(sh, 0);
  if (b.flashEnemy > 0) { ctx.globalAlpha = 0.6; }
  if (!(b.catchShake > 0 && b.ballThrown)) drawMon(ctx, 370, 150, 46, b.enemy.species, true);
  ctx.globalAlpha = 1;
  // ball when catching
  if (b.ballThrown) {
    const bx = 370 + Math.sin(State.animTime * 20) * 6 * b.catchShake;
    ctx.fillStyle = '#e83b3b'; ctx.beginPath(); ctx.arc(bx, 150, 12, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, 150, 12, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, 150, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 12, 150); ctx.lineTo(bx + 12, 150); ctx.stroke();
  }
  // player mon (bottom-left, back view = facing right, not flipped)
  if (b.flashMine > 0) ctx.globalAlpha = 0.6;
  drawMon(ctx, 150, 300, 52, b.mine.species, false);
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHpPlate(ctx, 300, 60, b.enemy, false);
  drawHpPlate(ctx, 30, 210, b.mine, true);
}

function drawHpPlate(c, x, y, mon, showXp) {
  const w = 180, h = showXp ? 56 : 46;
  c.fillStyle = 'rgba(20,16,45,.92)';
  roundRect(c, x, y, w, h, 8); c.fill();
  c.strokeStyle = '#000'; c.lineWidth = 2; roundRect(c, x, y, w, h, 8); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 14px Trebuchet MS';
  c.fillText(SPECIES[mon.species].name, x + 10, y + 19);
  c.fillStyle = TYPE_COLORS[SPECIES[mon.species].type];
  c.fillText('Lv' + mon.level, x + w - 40, y + 19);
  // hp bar
  const bw = w - 20, pct = Math.max(0, mon.hp / mon.maxHp);
  c.fillStyle = '#000'; c.fillRect(x + 10, y + 26, bw, 8);
  c.fillStyle = pct > 0.5 ? '#4ecb5a' : pct > 0.2 ? '#ffd23c' : '#ff5a3c';
  c.fillRect(x + 10, y + 26, bw * pct, 8);
  if (showXp) {
    const xpPct = Math.max(0, Math.min(1, mon.xp / (mon.level * 30)));
    c.fillStyle = '#000'; c.fillRect(x + 10, y + 40, bw, 5);
    c.fillStyle = '#3ca7ff'; c.fillRect(x + 10, y + 40, bw * xpPct, 5);
  }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r); c.closePath();
}

// DOM battle controls
const battleUI = document.getElementById('battle-ui');
const battleLog = document.getElementById('battle-log');
const battleActions = document.getElementById('battle-actions');
const moveMenu = document.getElementById('move-menu');

function showBattleUI(on) {
  battleUI.classList.toggle('hidden', !on);
  document.getElementById('hud').classList.toggle('hidden', on);
  document.getElementById('dpad').classList.toggle('hidden', on || !isTouch);
}
function renderBattleUI() {
  const b = State.battle; if (!b) return;
  battleLog.textContent = b.log;
  const menuOpen = b.phase === 'menu';
  battleActions.classList.toggle('hidden', !menuOpen || moveMenu.dataset.open === '1');
  if (!menuOpen) { moveMenu.classList.add('hidden'); moveMenu.dataset.open = '0'; }
}
function openMoves() {
  const b = State.battle; if (!b || b.phase !== 'menu') return;
  const moves = movesFor(SPECIES[b.mine.species].type);
  moveMenu.innerHTML = '';
  moves.forEach((mv, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `${i + 1}. ${mv.name}<br><small style="color:${TYPE_COLORS[mv.type]}">${mv.type} · ${mv.power}</small>`;
    btn.onclick = () => { closeMoves(); playerMove(i); };
    moveMenu.appendChild(btn);
  });
  const back = document.createElement('button');
  back.textContent = '↩ Back'; back.onclick = closeMoves;
  moveMenu.appendChild(back);
  moveMenu.classList.remove('hidden'); moveMenu.dataset.open = '1';
  battleActions.classList.add('hidden');
}
function closeMoves() {
  moveMenu.classList.add('hidden'); moveMenu.dataset.open = '0';
  if (State.battle && State.battle.phase === 'menu') battleActions.classList.remove('hidden');
}

battleActions.addEventListener('click', (e) => {
  const act = e.target.closest('button') && e.target.closest('button').dataset.act;
  if (act === 'fight') openMoves();
  else if (act === 'catch') tryCatch();
  else if (act === 'run') runBattle();
});

// ---------------------------------------------------------------------------
// HUD & overlays
// ---------------------------------------------------------------------------
function updateHUD() {
  document.getElementById('hud-name').textContent = State.profile ? State.profile.name : '—';
  document.getElementById('hud-caught').textContent = State.dexCaught.size;
  document.getElementById('hud-party').textContent = State.party.length;
}

function typeBadge(type) {
  return `<span class="type-badge" style="background:${TYPE_COLORS[type]}">${type}</span>`;
}

function renderParty() {
  const list = document.getElementById('party-list');
  list.innerHTML = '';
  if (!State.party.length) { list.innerHTML = '<p style="color:var(--muted)">No Monmons yet.</p>'; }
  State.party.forEach(m => {
    const row = document.createElement('div');
    row.className = 'party-row';
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    drawMon(cv.getContext('2d'), 32, 38, 22, m.species, false);
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<b>${SPECIES[m.species].name}</b> ${typeBadge(SPECIES[m.species].type)}
      <span style="float:right;color:var(--muted)">Lv${m.level}</span>
      <div class="hpbar"><i style="width:${Math.round(100 * m.hp / m.maxHp)}%"></i></div>
      <small style="color:var(--muted)">HP ${m.hp}/${m.maxHp}</small>`;
    row.appendChild(cv); row.appendChild(meta);
    list.appendChild(row);
  });
}

async function renderBoard() {
  const list = document.getElementById('board-list');
  list.textContent = 'Loading…';
  try {
    const rows = await api('GET', '/api/leaderboard');
    if (!rows || !rows.length) { list.innerHTML = '<p style="color:var(--muted)">No trainers yet.</p>'; return; }
    list.innerHTML = '';
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'board-row' + (r.userId === USER_ID ? ' me' : '');
      row.innerHTML = `<span class="rank">#${i + 1}</span><b>${escapeHtml(r.name)}</b>
        <span class="bstats">🐾 ${r.caught} · ⚔️ ${r.wins}</span>`;
      list.appendChild(row);
    });
  } catch (e) { list.textContent = 'Leaderboard unavailable.'; }
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ---------------------------------------------------------------------------
// Title / starter flow
// ---------------------------------------------------------------------------
function renderStarters() {
  const wrap = document.getElementById('starter-list');
  wrap.innerHTML = '';
  STARTERS.forEach(sp => {
    const card = document.createElement('div');
    card.className = 'starter-card';
    const cv = document.createElement('canvas'); cv.width = 72; cv.height = 72;
    drawMon(cv.getContext('2d'), 36, 42, 26, sp, false);
    card.appendChild(cv);
    const label = document.createElement('div'); label.className = 'sname';
    label.innerHTML = `${SPECIES[sp].name}<br>${typeBadge(SPECIES[sp].type)}`;
    card.appendChild(label);
    card.onclick = () => chooseStarter(sp);
    wrap.appendChild(card);
  });
}
function chooseStarter(sp) {
  const starter = makeMon(sp, 5);
  State.party = [starter];
  State.dexSeen.add(sp); State.dexCaught.add(sp);
  document.getElementById('starter').classList.add('hidden');
  enterOverworld();
  saveNow();
  toast(`${SPECIES[sp].name} joined your team!`);
}

function enterOverworld() {
  State.mode = 'overworld';
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('dpad').classList.toggle('hidden', !isTouch);
  updateHUD();
}

async function startNewGame() {
  const name = document.getElementById('name-input').value.trim() || 'Trainer';
  try {
    const p = await api('POST', '/api/profile', { name });
    State.profile = p;
  } catch (e) { State.profile = { name }; }
  // fresh game -> starter pick
  document.getElementById('title').classList.add('hidden');
  document.getElementById('starter').classList.remove('hidden');
  renderStarters();
}

async function boot() {
  let existing = null;
  try { existing = await api('GET', '/api/profile'); } catch (e) {}
  if (existing && existing.party && existing.party.length) {
    loadProfileIntoState(existing);
    document.getElementById('title-new').classList.add('hidden');
    document.getElementById('title-continue').classList.remove('hidden');
    document.getElementById('continue-name').textContent = existing.name;
  } else if (existing) {
    State.profile = existing;
    document.getElementById('name-input').value = existing.name || '';
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

window.addEventListener('keydown', (e) => {
  if (State.mode === 'overworld') {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    if (map[e.key]) { e.preventDefault(); tryMove(map[e.key]); }
  } else if (State.mode === 'battle') {
    const b = State.battle; if (!b || b.phase !== 'menu') return;
    if (moveMenu.dataset.open === '1') {
      if (['1', '2', '3', '4'].includes(e.key)) { const i = +e.key - 1; closeMoves(); playerMove(i); }
      else if (e.key === 'Escape') closeMoves();
    } else {
      if (e.key === '1' || e.key.toLowerCase() === 'f') openMoves();
      else if (e.key === '2' || e.key.toLowerCase() === 'c') tryCatch();
      else if (e.key === '3' || e.key.toLowerCase() === 'r') runBattle();
    }
  }
});

// dpad
document.getElementById('dpad').addEventListener('click', (e) => {
  const dir = e.target.dataset.dir; if (dir) tryMove(dir);
});

// buttons
document.getElementById('btn-start').onclick = startNewGame;
document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') startNewGame(); });
document.getElementById('btn-continue').onclick = () => enterOverworld();
document.getElementById('btn-newgame').onclick = () => {
  document.getElementById('title-continue').classList.add('hidden');
  document.getElementById('title-new').classList.remove('hidden');
};
document.getElementById('btn-party').onclick = () => { renderParty(); document.getElementById('party-panel').classList.remove('hidden'); };
document.getElementById('btn-board').onclick = () => { renderBoard(); document.getElementById('board-panel').classList.remove('hidden'); };
document.querySelectorAll('.close-overlay').forEach(b => b.onclick = () => {
  document.getElementById('party-panel').classList.add('hidden');
  document.getElementById('board-panel').classList.add('hidden');
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (State.mode === 'battle') renderBattleScene(dt);
  else renderOverworld(dt);
  requestAnimationFrame(loop);
}

boot();
requestAnimationFrame(loop);
window.addEventListener('beforeunload', () => { try { navigator.sendBeacon && saveNow(); } catch (e) {} });
