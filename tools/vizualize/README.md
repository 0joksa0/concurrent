# Concurrent Trace Viewer (Vite + Cytoscape)

Frontend alat za lokalnu vizuelizaciju izvršavanja događaja iz postojećeg C projekta.

Lokacija: `tools/vizualize`

## Instalacija

```bash
cd tools/vizualize
npm install
```

## Pokretanje (dev)

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Učitavanje podataka

Viewer podržava:

1. `Load Sample`:
- učitava `public/sample/nodes.json`
- učitava `public/sample/trace.jsonl`

2. `Load Files`:
- ručni upload lokalnih `nodes.json` i `trace.jsonl`

## Novi execution-aware model

Glavni graf je **trace-driven**:

- prikazuje samo checkpoint node-ove koji se zaista pojavljuju u trace-u
- node-ovi iz `nodes.json` koji nisu viđeni u trace-u se ne prikazuju u glavnom grafu
- jedan code čvor predstavlja kombinaciju: `thread + function + node_id`

## Prikaz

Graf sadrži 4 nivoa:

1. **Thread lanes** (compound čvorovi)  
2. **Function containers** unutar lane-a  
3. **Code cards** (checkpoint kartice) unutar funkcija  
4. **State/resource čvorove** u posebnoj regiji

Code card prikazuje:

- label/id
- function
- file:line
- snippet (ako je dostupan ili fallback)
- type badge (`[type]`)

## Edge tipovi

- `control_flow`: između code kartica u istoj `thread+function` grupi
- state/resource relacije iz heuristike:
  - `waits_on`
  - `posts`
  - `locks`
  - `unlocks`
  - `reads`
  - `writes`
  - fallback `state_access`

## Replay

Kontrole:

- `Play`, `Pause`, `Next`, `Prev`, `Restart`
- brzina: `0.5x`, `1x`, `2x`, `4x`
- view mode: `Simple (Compressed)` / `Detailed`
- timeline slider (scrub)
- `Auto next same thread` opcija

`Simple (Compressed)` agregira iste `function + node_id` korake kroz više niti u jedinstvene code kartice, uz prikaz učesnika niti i manje state ivica.

Kad je event aktivan:

- highlight code card
- highlight thread lane
- highlight povezane resource čvorove
- info panel prikazuje thread/function/node, lokaciju i snippet

## Snippet/source

Viewer pokušava da učita source liniju za `file:line`:

- prvo iz Vite dev putanje `/@fs/...` (kad je putanja apsolutna)
- zatim kao relativan URL
- ako to ne uspe, koristi fallback snippet iz node metadata

## Ograničenja MVP verzije

- heuristika za resource detekciju nije savršena
- edge logika je lokalna po `thread+function` i ne modeluje sve moguće causal relacije
- snippet lookup je best-effort i zavisi od dostupnosti source fajlova preko dev servera
