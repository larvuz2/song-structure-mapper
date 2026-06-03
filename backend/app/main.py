from __future__ import annotations

import json
import os
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .analyzer import analyze_audio_to_song_map, make_job_messages

app = FastAPI(title="Song Structure Mapper API")

allowed_origins = os.environ.get("SONG_MAPPER_CORS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def storage_root() -> Path:
    return Path(os.environ.get("SONG_MAPPER_STORAGE", "storage/tracks")).resolve()


def track_dir(track_id: str) -> Path:
    return storage_root() / track_id


def status_path(track_id: str) -> Path:
    return track_dir(track_id) / "status.json"


def map_path(track_id: str) -> Path:
    return track_dir(track_id) / "analysis.json"


def original_path(track_id: str) -> Path:
    matches = list(track_dir(track_id).glob("original.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Audio file not found")
    return matches[0]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/api/tracks")
def create_track(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Upload an audio file.")

    track_id = uuid.uuid4().hex[:12]
    folder = track_dir(track_id)
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    audio_file = folder / f"original{suffix}"
    with audio_file.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)

    write_status(track_id, make_job_messages()[0])
    thread = threading.Thread(target=run_analysis_job, args=(track_id, audio_file), daemon=True)
    thread.start()
    return {"trackId": track_id}


@app.get("/api/tracks/{track_id}/status")
def get_status(track_id: str) -> dict[str, Any]:
    path = status_path(track_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track not found")
    return read_json(path)


@app.get("/api/tracks/{track_id}/map")
def get_map(track_id: str) -> dict[str, Any]:
    path = map_path(track_id)
    if not path.exists():
        raise HTTPException(status_code=409, detail="Analysis is not ready yet")
    return read_json(path)


@app.get("/api/tracks/{track_id}/audio")
def get_audio(track_id: str) -> FileResponse:
    return FileResponse(original_path(track_id), media_type="audio/mpeg")


def run_analysis_job(track_id: str, audio_file: Path) -> None:
    messages = make_job_messages()
    try:
        for message in messages[1:3]:
            write_status(track_id, message)
            time.sleep(0.08)
        song_map = analyze_audio_to_song_map(audio_file, track_dir(track_id))
        for message in messages[3:-1]:
            write_status(track_id, message)
            time.sleep(0.08)
        write_json(map_path(track_id), song_map)
        write_status(track_id, messages[-1])
    except Exception as exc:  # pragma: no cover - defensive status path
        write_status(
            track_id,
            {
                "state": "error",
                "stage": "error",
                "progress": 100,
                "message": f"Analysis failed: {exc}",
            },
        )


def write_status(track_id: str, status: dict[str, Any]) -> None:
    status = {**status, "trackId": track_id}
    write_json(status_path(track_id), status)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
