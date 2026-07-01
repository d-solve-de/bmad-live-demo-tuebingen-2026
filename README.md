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
