import math
import wave
from pathlib import Path

from app.analyzer import analyze_audio_to_song_map, build_sections_from_energy, make_job_messages


def write_sine_wav(path: Path, seconds: float = 4.0, sample_rate: int = 22050) -> None:
    frames = int(seconds * sample_rate)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(frames):
            envelope = 0.25 + 0.7 * (i / max(1, frames - 1))
            sample = int(math.sin(2 * math.pi * 220 * i / sample_rate) * envelope * 32767)
            wav.writeframesraw(sample.to_bytes(2, byteorder="little", signed=True))


def test_build_sections_uses_readable_electronic_blocks():
    energy = [18] * 8 + [56] * 8 + [72] * 8 + [92] * 16 + [28] * 8 + [84] * 16 + [20] * 8

    sections = build_sections_from_energy(energy)

    assert sections[0]["type"] == "intro"
    assert any(section["type"] == "drop" for section in sections)
    assert sections[-1]["type"] == "outro"
    assert all(section["startBar"] <= section["endBar"] for section in sections)
    assert all(section["loop"].startswith("Loop ") for section in sections)


def test_analyze_audio_to_song_map_returns_frontend_shape(tmp_path: Path):
    audio_path = tmp_path / "first-song.wav"
    write_sine_wav(audio_path)

    song_map = analyze_audio_to_song_map(audio_path)

    assert song_map["bpm"] >= 80
    assert song_map["bars"] >= 32
    assert song_map["duration"] > 3.9
    assert len(song_map["energy"]) == song_map["bars"]
    assert len(song_map["sections"]) >= 4
    assert len(song_map["stems"]) == 4
    assert {stem["name"] for stem in song_map["stems"]} == {"Drums", "Bass", "Vocals / Lead", "Other / Music"}


def test_job_messages_are_user_facing_and_progressive():
    messages = make_job_messages()

    assert messages[0]["progress"] == 4
    assert messages[-1]["progress"] == 100
    assert "Ready" in messages[-1]["message"]
    assert all("message" in item and item["message"] for item in messages)
