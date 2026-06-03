# Audio Timeline Overlay Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a real audio-timeline-style visualization with waveform lanes and section blocks overlaid on top.

**Architecture:** Keep the current React/Vite app. Reuse `SongMap.energy` as the MVP waveform source: demo data renders a synthetic waveform, uploaded tracks render RMS-derived amplitude bars. Place section blocks in an absolute overlay above the waveform so the visual reads like a DAW timeline with arrangement blocks on top.

**Tech Stack:** React, TypeScript, CSS grid/flex, Web Audio API/RMS data already in `analysis.ts`.

---

## Acceptance criteria

- Add a new timeline module above the existing section-card timeline.
- The new module must look like an actual audio timeline: ruler, playhead, waveform body, mirrored amplitude bars, and time/bar labels.
- Section blocks must sit on top of the waveform and match section widths.
- Clicking overlay section blocks selects the section.
- Keep the dark/pastel visual direction.
- `npm run build` and `npm run lint` must pass.
- Push source to `main` and redeploy GitHub Pages.

## Tasks

### Task 1: Add waveform timeline markup

**Objective:** Add the new visual module to `src/App.tsx`.

**Files:**

- Modify: `src/App.tsx`

**Steps:**

1. Add a `waveformBars` memo derived from `map.energy`.
2. Add a `barMarkers` memo for readable timeline ruler markers.
3. Insert a new `audio-timeline-panel` between the control strip and the existing section block panel.
4. Render section overlay blocks at the top.
5. Render mirrored waveform bars under the overlay.
6. Render a vertical playhead aligned to the selected section.

### Task 2: Style the timeline like a clean DAW strip

**Objective:** Make the visual feel like an audio timeline, not a chart.

**Files:**

- Modify: `src/App.css`

**Steps:**

1. Add panel styling.
2. Add timeline ruler styling.
3. Add overlay section styling.
4. Add waveform grid styling.
5. Add responsive overflow for mobile.

### Task 3: Verify and ship

**Objective:** Build, lint, commit, push, deploy, and verify live.

**Commands:**

```bash
npm run build
npm run lint
git add src/App.tsx src/App.css docs/plans/2026-06-03-audio-timeline-overlay.md
git commit -m "feat: add waveform timeline overlay"
git push origin main
```

Then deploy `dist/` to `gh-pages` and verify:

```bash
curl -L -s -o /tmp/songmap.html -w '%{http_code}' https://larvuz2.github.io/song-structure-mapper/
```
