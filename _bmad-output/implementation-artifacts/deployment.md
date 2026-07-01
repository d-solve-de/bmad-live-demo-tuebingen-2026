# Deployment Record — Monmon Quest

**Date:** 2026-07-01 · **Status:** ✅ Live

## Live URL
https://monmon-quest-267814974346.europe-west3.run.app

## Target
- **Project:** `bmad-demo-501112`
- **Platform:** Google Cloud Run (fully managed)
- **Service:** `monmon-quest` · **Region:** `europe-west3`
- **Revision serving:** `monmon-quest-00002-f6q`
- **Persistence:** Firestore native `(default)` database, region `europe-west3`, collection `players`

## Cloud Run config
| Setting | Value |
|---------|-------|
| Container | Built from `Dockerfile` (node:20-slim) via Cloud Build `--source` |
| Ingress | Public (`--allow-unauthenticated`) |
| Memory / CPU | 512Mi / 1 |
| Concurrency | 80 |
| Autoscaling | min 0 / max 4 instances |
| Port | 8080 |

## Identity & access
- Runtime service account: `267814974346-compute@developer.gserviceaccount.com`
- Granted role: `roles/datastore.user` (Firestore read/write)

## Multi-user model
- Stateless app instances; all state in Firestore → safe horizontal autoscaling.
- Each player = one `players/{userId}` doc; `userId` is an anonymous UUID from the browser (`x-user-id` header).
- Shared leaderboard via `players` ordered by `caught` (auto-indexed) with `wins` tiebreak in memory — no composite index required.

## Verification performed
- `GET /api/health` → `{ ok:true, firestore:true }`
- Save → reload returns identical profile (persistence across stateless requests). ✅
- Two distinct users produced two isolated docs; leaderboard ranked them correctly. ✅
- Static client (`/`, `/game.js`, `/style.css`) served 200. ✅
- Test/seed profiles deleted after verification; leaderboard reset to empty for demo. ✅

## Redeploy command
```bash
gcloud run deploy monmon-quest --source . \
  --project bmad-demo-501112 --region europe-west3 \
  --allow-unauthenticated --memory 512Mi --cpu 1 \
  --concurrency 80 --min-instances 0 --max-instances 4 --port 8080 \
  --set-env-vars NODE_ENV=production
```

## Known follow-ups (non-blocking)
- `README.md` contains an OAuth `client_secret` in plaintext under git — rotate & remove before sharing the repo.
- Anonymous identity is device-bound (localStorage); add real auth if the demo needs cross-device accounts.
