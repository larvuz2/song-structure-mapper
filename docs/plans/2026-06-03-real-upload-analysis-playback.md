# Real Upload, Analysis, and Playback Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let a user upload one song, watch clear analysis progress, then play/pause the track while seeing waveform, section blocks, stem lanes, and current playback position in sync.

**Architecture:** Keep the React/Vite frontend as the visual client. Add a Python FastAPI backend for uploads, job state, stem separation, waveform/structure analysis, and static media serving. Use a background worker process for long analysis jobs so the UI can poll progress and show human-readable status updates.

**Tech Stack:** React + TypeScript + Vite frontend, Web Audio API/audio element playback, FastAPI backend, Python worker, Demucs for 4/6-stem separation, librosa/aubio/madmom-style analysis, local filesystem storage for MVP, future S3/R2 + Redis queue if deployed.

---

## User flow

1. User uploads a song.
2. UI immediately creates a track card and shows upload progress.
3. Backend stores the audio and creates a job.
4. UI shows step-by-step analysis status:
   - Upload received.
   - Preparing audio.
   - Reading waveform.
   - Estimating BPM and bar grid.
   - Separating stems.
   - Detecting energy blocks.
   - Finding repeated loop families.
   - Building visual map.
   - Ready to play.
5. User sees the timeline + sections.
6. User presses play/pause.
7. Playhead moves across waveform and section blocks.
8. Current section highlights in real time.
9. Stem lanes stay aligned with the same bar grid.

## MVP backend endpoints

### `POST /api/tracks`

Upload a song file.

Returns:

```json
{
  "trackId": "uuid",
  "status": "queued",
  "message": "Upload received. Preparing audio."
}
```

### `GET /api/tracks/:trackId/status`

Returns current job state.

```json
{
  "trackId": "uuid",
  "state": "analyzing",
  "progress": 42,
  "step": "separating_stems",
  "message": "Separating drums, bass, vocals, and other layers… this is the slowest step.",
  "updatedAt": "2026-06-03T00:00:00Z"
}
```

### `GET /api/tracks/:trackId/map`

Returns final visual map JSON.

```json
{
  "bpm": 128,
  "duration": 300,
  "bars": 160,
  "audioUrl": "/media/tracks/uuid/original.mp3",
  "waveform": [0.1, 0.22, 0.34],
  "sections": [],
  "stems": [],
  "similarity": []
}
```

### `GET /media/tracks/:trackId/original.ext`

Streams the uploaded original audio for playback.

### `GET /media/tracks/:trackId/stems/:stemName.wav`

Streams separated stem audio when available.

## Analysis pipeline

### Step 1: Normalize audio

Use FFmpeg:

```bash
ffmpeg -i input -ar 44100 -ac 2 data/tracks/{id}/original.wav
```

### Step 2: Waveform preview

Generate compact waveform data for UI:

- 800–2000 amplitude points.
- JSON array normalized 0–1.
- Good enough for visual timeline and playhead.

### Step 3: BPM + beat grid

Use librosa first:

- `librosa.beat.beat_track`
- derive beats, bars, phrase grid.

Later upgrade:

- madmom or essentia for better electronic downbeats.

### Step 4: Stem separation

Use Demucs.

4-stem default:

```bash
python -m demucs -n htdemucs --out data/tracks/{id}/stems data/tracks/{id}/original.wav
```

6-stem option:

```bash
python -m demucs -n htdemucs_6s --out data/tracks/{id}/stems data/tracks/{id}/original.wav
```

Expected stems:

- 4: drums, bass, vocals, other.
- 6: drums, bass, vocals, other, guitar, piano.

### Step 5: Section detection

For MVP:

- Split into 8/16-bar blocks.
- Calculate per-block RMS energy.
- Calculate onset density.
- Compare adjacent blocks.
- Label blocks as intro, groove, build, drop, breakdown, outro.

### Step 6: Loop family detection

For MVP:

- Extract features per block: energy, chroma, MFCC, spectral flux, stem activity.
- Compare blocks with cosine similarity.
- Group similar blocks into Loop A, B, C, C2, D.

## Frontend playback requirements

### Audio state

Add state:

```ts
type PlayerState = {
  isPlaying: boolean
  currentTime: number
  duration: number
  currentBar: number
  currentSectionId: string
}
```

### UI controls

- Play / Pause button.
- Time display.
- Click waveform to seek.
- Playhead follows current time.
- Active section highlights while playing.
- If user clicks a section block, seek to that section start.

### Communicative loading UI

Use a visible progress panel:

```text
Analyzing your track
42%
Separating drums, bass, vocals, and other layers… this is the slowest step.
```

Make it feel alive:

- Show current step.
- Show what the system is doing in plain language.
- Show expected slow points.
- Never leave the user staring at a spinner.
- If a step fails, explain exactly which step failed and what to try.

## Data model

```ts
type TrackJob = {
  id: string
  filename: string
  state: 'queued' | 'uploading' | 'preparing' | 'separating' | 'analyzing' | 'ready' | 'failed'
  progress: number
  message: string
  audioUrl?: string
  map?: SongMap
}
```

## Files to create

Backend:

- `backend/main.py`
- `backend/jobs.py`
- `backend/analyze.py`
- `backend/separate.py`
- `backend/storage.py`
- `backend/requirements.txt`

Frontend:

- `src/api.ts`
- `src/player.ts`
- `src/components/AnalysisProgress.tsx`
- `src/components/AudioPlayer.tsx`
- `src/components/WaveformTimeline.tsx`

## Deployment options

### Best MVP path

Run backend on the VPS and keep GitHub Pages frontend pointed to it.

Needs:

- public backend URL.
- CORS allowed for GitHub Pages origin.
- persistent storage folder.
- enough CPU/RAM for Demucs.

### Better production path

- Frontend: Vercel/Netlify.
- Backend: Render/Fly/VPS GPU box.
- Queue: Redis/RQ/Celery.
- Storage: Cloudflare R2 or S3.

## Important UX copy

Use clear status messages:

- “Upload received. Preparing the audio file.”
- “Reading the waveform so we can draw the timeline.”
- “Estimating BPM and the bar grid.”
- “Separating stems. This can take a few minutes.”
- “Listening for energy changes and section boundaries.”
- “Comparing repeated loops across the track.”
- “Building the visual song map.”
- “Ready. Press play.”

## Build order

1. Add local FastAPI backend with upload endpoint.
2. Add job status polling.
3. Add original audio playback from backend URL.
4. Sync playhead with waveform timeline.
5. Add waveform click-to-seek.
6. Add MVP analysis without Demucs first.
7. Add Demucs 4/6-stem job.
8. Add real stem activity lanes.
9. Deploy backend and connect public frontend.

## MVP acceptance criteria

- Upload one MP3/WAV.
- UI shows progress messages while analysis runs.
- Analysis result renders waveform and section blocks.
- Play/pause works.
- Playhead moves in sync with audio.
- Active section highlights while playback crosses section boundaries.
- Clicking a section seeks to its start.
- Backend supports at least 4-stem separation.
- Failure states are clear and non-technical.
