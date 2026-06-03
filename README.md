# Song Structure Mapper

Dark pastel MVP for visually analyzing electronic song structure.

## What it does now

- Shows a clean demo structure instantly.
- Lets you upload a full audio file to the Option A VPS backend.
- Shows communicative analysis progress while the job runs.
- Generates waveform energy, BPM estimate, bars, section labels, and stem-ready lanes.
- Plays/pauses the uploaded song and syncs the playhead to the waveform + section blocks.
- Lets you click waveform/blocks to seek.
- Falls back to browser-side analysis if the backend is unavailable.

## Option A VPS backend

Frontend is static React/Vite. Real upload/analysis runs on FastAPI.

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Useful env vars:

```bash
export SONG_MAPPER_STORAGE=/root/song-structure-mapper/backend/storage/tracks
export SONG_MAPPER_CORS="https://larvuz2.github.io,http://localhost:5173"
```

Frontend API target:

```bash
VITE_API_BASE_URL=http://YOUR_VPS_HOST:8000 npm run build
```

For local dev, the frontend defaults to:

```text
http://localhost:8000
```

## Stem separation target

The real separation layer should use Demucs, no paid API required:

```bash
python -m demucs -n htdemucs --out separated input.mp3      # 4 stems
python -m demucs -n htdemucs_6s --out separated input.mp3   # 6 stems
```

Current backend creates the stem-ready lane structure. Next server upgrade plugs Demucs into the same job pipeline.

Full plan: [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md)

## Run frontend locally

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Test backend

```bash
cd backend
uv run pytest -q
```

## Build frontend

```bash
npm run build
```
