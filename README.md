# BMAD

[BMAD](https://docs.bmad-method.org/)

## Voraussetzungen
- claude cli installiert und eingeloggt
- google cloud cli installiert und eingeloggt und ein projekt mit billing alerts erstellt - das gesamte deployment hat die ki gemacht

## Vorgehen: 
npx bmad-method install

claude commands:
-  run bmad-help to understand the bmad method
- YOLO MODE voller BMAD Workflow, lege ein prd, architektur, ux design an und erzeuge dann Epcis/Stories und lass diese dann mit BMAD DEV umsetzen. 
- Ziel ist es eine Anwendung zu haben, um Pokemon zu spielen in 2D Grafik, single player mode, denk dir was cooles aus
- then deploy the app  to google cloud run in a container in the "bmad-demo-501112" project
  the gcp cli is already logged in, give me the url where i can access the service, use firestore to persist information so i can store information on the backend for demo purposes, the solution should be able to process  multiple users!

DAS WAR DAS EINZIGE KOMMANDO ZUR ERSTELLUNG DER GESAMTEN APP!

## Erkenntnis:
BMAD erzeugt lesbare sourcen.
BMAD geht strkturiert vor.
Spezifika einer spezfischen Sprache muss man nicht mehr unbedingt lernen.


## Finaler Ouotput

Fertig. Der volle BMAD-YOLO-Workflow ist durchgelaufen — von PRD bis Live-Deployment.

🎮 Deine App ist live

https://monmon-quest-267814974346.europe-west3.run.app

Einfach im Browser öffnen, Trainernamen eingeben, Starter wählen und losspielen (WASD/Pfeile bewegen, ins hohe Gras für Wild-Encounter).

Was gebaut wurde: „Monmon Quest"

Ein 2D-Top-Down-Monsterfänger im Pokémon-Stil mit eigenen Kreaturen (rechtssicher, keine Nintendo-Assets):
- Overworld mit Kamera, Kollision, hohem Gras & Zufallsbegegnungen — komplett prozedural gezeichnet (keine Bilddateien → schneller Container/Cold-Start)
- Rundenbasierter Kampf mit Typ-Effektivität (Feuer/Wasser/Pflanze/Elektro/Normal), 10 Spezies, Fangen (mit Wackel-Animation), XP & Level-Up
- Firestore-Persistenz pro Spieler + globales Leaderboard (Multi-User)
- Touch-fähig (D-Pad) und Keyboard

BMAD-Artefakte (_bmad-output/)

┌────────────────┬────────────────────────────────────────────────────────────────────────────────┐
│     Phase      │                                    Artefakt                                    │
├────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ Planning       │ planning-artifacts/prd.md, ux-design.md, architecture.md, epics-and-stories.md │
├────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ Implementation │ Code (server.js, public/, Dockerfile) + implementation-artifacts/deployment.md │
└────────────────┴────────────────────────────────────────────────────────────────────────────────┘

Architektur & Verifikation

- Ein Node-Container serviert Spielclient + JSON-API; Zustand komplett in Firestore → stateless → skaliert horizontal (min 0 / max 4 Instanzen, Concurrency 80).
- Live geprüft: health (firestore:true), Save→Reload liefert identische Daten, zwei User = zwei isolierte Docs, Leaderboard rankt korrekt. Meine Test-Profile habe ich danach aus Firestore gelöscht → Ranking startet sauber leer.
- Unterwegs zwei echte Bugs gefixt: Firestore-Fallback (kein permanentes Abschalten der Instanz bei transientem Fehler) und die Leaderboard-Query ohne Composite-Index-Zwang.

GCP-Setup: APIs aktiviert (run, cloudbuild, artifactregistry, firestore), Runtime-SA …-compute@… mit roles/datastore.user, Deploy in europe-west3 (passend zur bestehenden Firestore-(default)-DB).

Möchtest du als nächstes einen BMAD-Retro (bmad-retrospective), weitere Features (Speichern mehrerer Teams, mehr Monmons, Heilstationen) oder Custom-Domain/Auth?

## Add on techniques 

### usage tracking
- ssburn
- codeburn - trackt komplette nutzung

### Inferenz 
- ollama.com
- openrouter
oder lokal, bestes Modell aktuell glm5.2

### harness 
japan https://sakana.ai/fugu/ 
# bmad-live-demo-tuebingen-2026
