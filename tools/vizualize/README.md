# Concurrent Viz (React SPA)

Frontend alat za lokalnu vizuelizaciju trace izvršavanja i theory mind mapa.

Lokacija: `tools/vizualize`

## Stack

- React 18
- React Router (`HashRouter`)
- Cytoscape.js
- Vite

## Instalacija

```bash
cd tools/vizualize
npm install
```

## Pokretanje

```bash
npm run dev
```

Aplikacija je single-page (`index.html`) i koristi rute:

- `#/` - Trace Viewer
- `#/theory` - Theory Mind Maps
- `#/admin` - Quiz Admin (Moodle XML + text import)

## Build

```bash
npm run build
npm run preview
```

## Struktura projekta

- `src/app/App.jsx` - glavni router layout
- `src/components/Navbar.jsx` - globalna navigacija
- `src/pages/TracePage.jsx` - trace UI (čisti React state)
- `src/pages/TheoryPage.jsx` - theory UI (čisti React state)
- `src/features/trace/*` - model/loaders/graph helperi
- `src/features/theory/theory.css` - theory stilovi
- `src/features/trace/styles.css` - trace stilovi

## Theory mape

Mape se učitavaju iz manifesta:

- `public/theory/index.json`

Svaka stavka manifesta sadrži:

- `key`
- `name`
- `path`
- `order`

## Dodavanje nove mape

Automatski kreiranje fajla + upis u manifest:

```bash
npm run theory:new -- 1.10 "Nedelja 1: Nova tema"
```

Skripta:

- `scripts/new-theory-map.mjs`

## Interakcije

Theory:

- klik na čvor: detalji pojma
- dupli klik na čvor sa `drilldown_map`: otvara detaljniju mapu
- klik na strelicu: prikaz objašnjenja veze
- `Export PNG` i `Export JSON`

Trace:

- replay kontrole (`Play`, `Pause`, `Next`, `Prev`, `Restart`)
- timeline scrub
- simple/detailed view
- auto thread jump

## Quiz text import format

`Quiz Admin` podrzava import iz `.txt`, `.quiz`, `.questions` i konverziju u Moodle XML.

Opsta pravila:

- Header (opciono, na pocetku fajla):
  - `@title: Naziv kviza`
  - `@category: $course$/top/Programiranje`
- Pitanja su razdvojena linijom `---`
- Komentar linije: `// ...`
- Kljucevi su `key: value`
- Za odgovore koristi `answers:` pa linije:
  - `+ tekst | feedback` (tacan)
  - `- tekst | feedback` (netacan)
  - `[50] tekst | feedback` (rucni procenat/fraction)

Primer:

```txt
@title: Nedelja 1 - Semafori
@category: $course$/top/OS/Kvizovi

type: multichoice
name: Mutex osnova
question: Sta mutex garantuje?
single: true
answers:
  + Medjusobno iskljucivanje | Tacno.
  - Fer raspodelu CPU vremena | To radi scheduler.
  - Da nikad nema cekanja | Nije tacno.
---
type: truefalse
name: Deadlock tvrdnja
question: Deadlock znaci da sve niti mogu da nastave.
correct: false
true_feedback: Nije tacno.
false_feedback: Tacno.
---
type: shortanswer
name: Naziv primitiva
question: Kako se zove P operacija nad semaforom?
usecase: 0
answers:
  [100] wait | Tacno.
  [100] down | Takodje tacno.
  [50] p | Prihvatljivo skraceno.
```
