'use strict';

const path = require('path');
const express = require('express');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const PORT = process.env.PORT || 8080;

// ---- Firestore (graceful degradation) --------------------------------------
let db = null;
let firestoreReady = false;
try {
  const { Firestore } = require('@google-cloud/firestore');
  db = new Firestore(); // uses Application Default Credentials on Cloud Run
  firestoreReady = true;
  console.log('[monmon] Firestore client initialised');
} catch (err) {
  console.warn('[monmon] Firestore unavailable, running in memory-only mode:', err.message);
}

const memStore = new Map(); // fallback when Firestore is not reachable
const COLLECTION = 'players';

function playersCol() {
  return db.collection(COLLECTION);
}

// ---- Validation helpers ----------------------------------------------------
const SPECIES = new Set([
  'pyracat', 'aquapup', 'floralynx', 'voltbunny', 'terrapup',
  'emberfox', 'coralray', 'thornmoth', 'sparkit', 'pebblup'
]);

function clampInt(v, min, max, dflt) {
  const n = Number.isFinite(v) ? Math.round(v) : dflt;
  return Math.max(min, Math.min(max, n));
}

function sanitizeName(name) {
  return String(name || 'Trainer').replace(/[^\w \-]/g, '').trim().slice(0, 16) || 'Trainer';
}

function sanitizeMon(m) {
  if (!m || typeof m !== 'object') return null;
  const species = SPECIES.has(m.species) ? m.species : 'pyracat';
  const level = clampInt(m.level, 1, 100, 5);
  const maxHp = clampInt(m.maxHp, 1, 999, 20);
  return {
    species,
    level,
    xp: clampInt(m.xp, 0, 1e6, 0),
    hp: clampInt(m.hp, 0, maxHp, maxHp),
    maxHp
  };
}

function sanitizeProfile(userId, name, body) {
  const b = body || {};
  const party = Array.isArray(b.party) ? b.party.slice(0, 6).map(sanitizeMon).filter(Boolean) : [];
  const dexSeen = Array.isArray(b.dexSeen) ? [...new Set(b.dexSeen.filter(s => SPECIES.has(s)))] : [];
  const dexCaught = Array.isArray(b.dexCaught) ? [...new Set(b.dexCaught.filter(s => SPECIES.has(s)))] : [];
  return {
    userId,
    name: sanitizeName(name),
    pos: { x: clampInt(b.pos && b.pos.x, 0, 200, 8), y: clampInt(b.pos && b.pos.y, 0, 200, 6) },
    party,
    dexSeen,
    dexCaught,
    caught: dexCaught.length,
    wins: clampInt(b.wins, 0, 1e6, 0),
    playSteps: clampInt(b.playSteps, 0, 1e9, 0),
    updatedAt: Date.now()
  };
}

// ---- Storage abstraction ----------------------------------------------------
// Firestore is the source of truth on Cloud Run. If it is unreachable (no ADC
// locally, DB missing, transient outage) we degrade to an in-memory store so the
// service keeps running instead of erroring.
let lastDegradeLog = 0;
function degrade(err) {
  // Fall back for THIS call only; do not permanently disable Firestore, so a
  // transient error or an index hiccup doesn't take the whole instance offline.
  const now = Date.now();
  if (now - lastDegradeLog > 10000) {
    console.warn('[monmon] Firestore call failed, using memory fallback for this request:', err.message);
    lastDegradeLog = now;
  }
}

async function getProfile(userId) {
  if (firestoreReady) {
    try {
      const snap = await playersCol().doc(userId).get();
      return snap.exists ? snap.data() : null;
    } catch (err) { degrade(err); }
  }
  return memStore.get(userId) || null;
}

async function saveProfile(userId, data) {
  if (firestoreReady) {
    try {
      await playersCol().doc(userId).set(data, { merge: true });
      const snap = await playersCol().doc(userId).get();
      return snap.exists ? snap.data() : data;
    } catch (err) { degrade(err); }
  }
  memStore.set(userId, { ...(memStore.get(userId) || {}), ...data });
  return memStore.get(userId);
}

async function topPlayers(limit = 20) {
  const byRank = (a, b) => ((b.caught || 0) - (a.caught || 0)) || ((b.wins || 0) - (a.wins || 0));
  if (firestoreReady) {
    try {
      // Single-field orderBy uses Firestore's automatic index (no composite
      // index required); the `wins` tiebreak is applied in memory afterwards.
      const snap = await playersCol()
        .orderBy('caught', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map(d => d.data()).sort(byRank);
    } catch (err) { degrade(err); }
  }
  return [...memStore.values()].sort(byRank).slice(0, limit);
}

// Probe Firestore at startup so /api/health reflects reality early.
async function probeFirestore() {
  if (!firestoreReady) return;
  try {
    await playersCol().limit(1).get();
    console.log('[monmon] Firestore reachable');
  } catch (err) { degrade(err); }
}

// ---- Middleware ------------------------------------------------------------
function requireUser(req, res, next) {
  const userId = String(req.header('x-user-id') || '').trim();
  if (!/^[a-zA-Z0-9\-]{8,64}$/.test(userId)) {
    return res.status(400).json({ error: 'missing or invalid x-user-id' });
  }
  req.userId = userId;
  next();
}

// ---- Routes ----------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, firestore: firestoreReady, ts: Date.now() });
});

app.post('/api/profile', requireUser, async (req, res) => {
  try {
    const existing = await getProfile(req.userId);
    if (existing) return res.json(existing);
    const profile = sanitizeProfile(req.userId, req.body && req.body.name, {
      pos: { x: 8, y: 6 }, party: [], dexSeen: [], dexCaught: [], wins: 0, playSteps: 0
    });
    profile.createdAt = Date.now();
    const saved = await saveProfile(req.userId, profile);
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/profile', err);
    res.status(500).json({ error: 'save failed' });
  }
});

app.get('/api/profile', requireUser, async (req, res) => {
  try {
    const profile = await getProfile(req.userId);
    if (!profile) return res.status(404).json({ error: 'not found' });
    res.json(profile);
  } catch (err) {
    console.error('GET /api/profile', err);
    res.status(500).json({ error: 'load failed' });
  }
});

app.put('/api/profile', requireUser, async (req, res) => {
  try {
    const existing = await getProfile(req.userId);
    const name = (req.body && req.body.name) || (existing && existing.name) || 'Trainer';
    const profile = sanitizeProfile(req.userId, name, req.body);
    if (existing && existing.createdAt) profile.createdAt = existing.createdAt;
    const saved = await saveProfile(req.userId, profile);
    res.json(saved);
  } catch (err) {
    console.error('PUT /api/profile', err);
    res.status(500).json({ error: 'save failed' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await topPlayers(20);
    res.json(rows.map(r => ({ name: r.name, caught: r.caught || 0, wins: r.wins || 0, userId: r.userId })));
  } catch (err) {
    console.error('GET /api/leaderboard', err);
    res.json([]); // leaderboard is best-effort
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[monmon] Monmon Quest listening on :${PORT}`);
  probeFirestore();
});
