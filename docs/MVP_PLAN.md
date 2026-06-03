# Song Structure Mapper MVP Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a dark, elegant, visual MVP that maps electronic songs into repeated musical blocks and stem lanes.

**Architecture:** Browser-first React/Vite MVP for fast preview. It analyzes uploaded audio in-browser for rough energy/BPM/sections and visualizes stems as lanes. Real stem separation is designed as a local/backend Demucs job so the product can support 4 or 6 stems without paid APIs.

**Tech Stack:** React, TypeScript, Vite, Web Audio API, CSS custom properties, future Python FastAPI + Demucs backend.

---

## Product goal

A visual x-ray for electronic tracks.

The user uploads a full song. The system shows:

- Full structure by musical sections.
- 8/16/32-bar style blocks.
- Repeated base loop families.
- Energy curve.
- Stem activity lanes.
- Self-similarity sketch.
- Support for more than 2 stems — target 4 minimum, 6 preferred.

## MVP scope now

### Included

- Dark pastel interface.
- Demo map for immediate preview.
- Full-song upload and in-browser audio decode.
- Rough BPM estimate.
- Bar-level energy map.
- Auto section blocks from energy.
- Stem lane visualization.
- Multi-stem upload to visualize separated files.
- 4+ stem support in UI.
- Saved plan in repo.

### Not included yet

- True production-grade stem separation running from the UI.
- Deep harmonic/chroma analysis.
- Accurate downbeat detection.
- Cloud deploy without API/deploy credentials.

## Stem separation target

No API is required for the real version.

Use **Demucs** locally/server-side:

```bash
python -m demucs -n htdemucs --out separated input.mp3
```

This gives 4 stems:

- drums
- bass
- vocals
- other

For 6 stems:

```bash
python -m demucs -n htdemucs_6s --out separated input.mp3
```

This gives:

- drums
- bass
- vocals
- other
- guitar
- piano

## Future backend plan

### API routes

- `POST /api/tracks` — upload song.
- `POST /api/tracks/:id/separate` — run Demucs 4/6-stem job.
- `GET /api/tracks/:id/status` — return queue progress.
- `GET /api/tracks/:id/map` — return analyzed structure JSON.
- `GET /api/tracks/:id/stems/:stemName` — stream stem audio.

### Python services

- `separate_stems.py` — Demucs wrapper.
- `analyze_song.py` — librosa/essentia analysis.
- `structure.py` — loop-family detection and block labeling.

### Analysis features

- Beat/downbeat detection.
- BPM and bar grid.
- RMS energy per bar.
- Onset density.
- Chroma/harmony per block.
- Self-similarity matrix.
- Repeated 4/8/16-bar loop grouping.
- Stem-specific activity detection.

## Visual design direction

Dark, elegant, cinematic software interface.

Avoid:

- generic SaaS cards.
- neon gamer UI.
- rainbow gradients.
- over-glossy glassmorphism.

Use:

- black-violet background.
- soft pastel accents.
- rounded blocks but not toy-like.
- clear timeline hierarchy.
- stem lanes like a music subway map.
- energy curve as glowing vertical bars.
- self-similarity matrix as a compact visual proof of repeated sections.

## MVP acceptance criteria

- `npm run build` passes.
- App opens locally.
- Demo structure is visible immediately.
- User can upload a song file.
- User can upload multiple separated stem files.
- UI displays at least 4 stem lanes.
- Plan exists at `docs/MVP_PLAN.md`.
- Repo is initialized with git.

## Next implementation tasks

### Task 1: Add real Demucs backend

**Objective:** True stem separation from uploaded tracks.

**Files:**

- Create: `backend/main.py`
- Create: `backend/separate_stems.py`
- Create: `backend/requirements.txt`

**Command:**

```bash
python -m demucs -n htdemucs_6s --out data/separated data/uploads/track.mp3
```

**Verification:** Output folder contains 6 wav files.

### Task 2: Add librosa structure analysis

**Objective:** Produce stable JSON map from full track and stems.

**Files:**

- Create: `backend/analyze_song.py`
- Create: `backend/structure.py`

**Verification:** JSON includes `bpm`, `bars`, `sections`, `energy`, `stems`, and `similarity`.

### Task 3: Connect frontend to backend

**Objective:** Replace client-only analysis with uploaded jobs.

**Files:**

- Modify: `src/App.tsx`
- Create: `src/api.ts`

**Verification:** Upload track → status → rendered structure map.

### Task 4: Exportable arrangement blueprint

**Objective:** Export PDF/JSON arrangement map for producers.

**Files:**

- Create: `src/export.ts`

**Verification:** Button exports clean JSON or PDF summary.
