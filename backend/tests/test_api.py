import math
import time
import wave
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def write_sine_wav(path: Path, seconds: float = 2.0, sample_rate: int = 22050) -> None:
    frames = int(seconds * sample_rate)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(frames):
            sample = int(math.sin(2 * math.pi * 220 * i / sample_rate) * 0.45 * 32767)
            wav.writeframesraw(sample.to_bytes(2, byteorder="little", signed=True))


def test_upload_track_returns_status_and_completed_map(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("SONG_MAPPER_STORAGE", str(tmp_path / "storage"))
    audio_path = tmp_path / "upload.wav"
    write_sine_wav(audio_path)
    client = TestClient(app)

    with audio_path.open("rb") as handle:
        response = client.post("/api/tracks", files={"file": ("upload.wav", handle, "audio/wav")})

    assert response.status_code == 200
    track_id = response.json()["trackId"]

    status = {}
    for _ in range(20):
        status = client.get(f"/api/tracks/{track_id}/status").json()
        if status["state"] == "ready":
            break
        time.sleep(0.05)
    song_map = client.get(f"/api/tracks/{track_id}/map").json()
    audio_response = client.get(f"/api/tracks/{track_id}/audio")

    assert status["state"] == "ready"
    assert status["progress"] == 100
    assert song_map["bars"] >= 32
    assert audio_response.status_code == 200
