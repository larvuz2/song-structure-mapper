# Song Structure Mapper

Dark pastel MVP for visually analyzing electronic song structure.

## What it does now

- Shows a clean demo structure instantly.
- Lets you upload a full audio file for rough browser-side analysis.
- Estimates BPM, bars, energy blocks, and section labels.
- Lets you upload multiple separated stems and maps them as visual lanes.
- Supports 4+ stem visual workflows.

## Stem separation target

The real separation layer should use Demucs, no paid API required:

```bash
python -m demucs -n htdemucs --out separated input.mp3      # 4 stems
python -m demucs -n htdemucs_6s --out separated input.mp3   # 6 stems
```

Full plan: [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md)

## Run locally

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Build

```bash
npm run build
```
