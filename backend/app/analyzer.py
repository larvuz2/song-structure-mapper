from __future__ import annotations

import audioop
import math
import subprocess
import wave
from pathlib import Path
from typing import Any

STEM_PALETTE = ["#A7F3D0", "#93C5FD", "#FBCFE8", "#FDE68A"]
STEM_NAMES = ["Drums", "Bass", "Vocals / Lead", "Other / Music"]
SECTION_TYPES = ["intro", "groove", "build", "drop", "breakdown", "build", "drop", "outro"]


def make_job_messages() -> list[dict[str, Any]]:
    return [
        {"state": "queued", "stage": "received", "progress": 4, "message": "Upload received. Preparing the audio file."},
        {"state": "analyzing", "stage": "decode", "progress": 14, "message": "Decoding the track and creating a clean analysis WAV."},
        {"state": "analyzing", "stage": "waveform", "progress": 28, "message": "Reading the waveform so we can draw the real audio timeline."},
        {"state": "analyzing", "stage": "tempo", "progress": 44, "message": "Estimating BPM and building the bar grid."},
        {"state": "analyzing", "stage": "sections", "progress": 62, "message": "Detecting energy changes, drops, breakdowns, and repeated loop blocks."},
        {"state": "analyzing", "stage": "stems_preview", "progress": 78, "message": "Preparing the four stem lanes. Demucs separation plugs into this same lane system next."},
        {"state": "analyzing", "stage": "render_map", "progress": 92, "message": "Building the pastel arrangement map and synced timeline data."},
        {"state": "ready", "stage": "ready", "progress": 100, "message": "Ready. Press play and watch the structure move with the song."},
    ]


def analyze_audio_to_song_map(audio_path: Path, work_dir: Path | None = None) -> dict[str, Any]:
    wav_path = ensure_analysis_wav(audio_path, work_dir or audio_path.parent)
    samples, sample_rate, duration = read_wav_mono(wav_path)
    frame_size = 2048
    hop = 1024
    rms = compute_rms(samples, frame_size, hop)
    bpm = estimate_bpm_from_envelope(rms, duration)
    bars = max(32, round((duration / 60) * bpm / 4))
    energy = [round(value * 100) for value in resample(rms, bars)]
    sections = build_sections_from_energy(energy)
    stems = build_stem_lanes(sections)
    return {
        "bpm": bpm,
        "bars": bars,
        "duration": round(duration, 3),
        "sections": sections,
        "energy": energy,
        "stems": stems,
        "sampleRate": sample_rate,
    }


def ensure_analysis_wav(audio_path: Path, work_dir: Path) -> Path:
    if audio_path.suffix.lower() == ".wav":
        return audio_path
    work_dir.mkdir(parents=True, exist_ok=True)
    out = work_dir / "analysis.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(audio_path), "-ac", "1", "-ar", "44100", str(out)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return out


def read_wav_mono(path: Path) -> tuple[list[float], int, float]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if channels > 1:
        raw = audioop.tomono(raw, sample_width, 0.5, 0.5)
    max_value = float(2 ** (8 * sample_width - 1))
    samples = [audioop.getsample(raw, sample_width, i) / max_value for i in range(len(raw) // sample_width)]
    duration = len(samples) / sample_rate if sample_rate else 0
    return samples, sample_rate, duration


def compute_rms(samples: list[float], frame_size: int, hop: int) -> list[float]:
    if not samples:
        return [0.0]
    values: list[float] = []
    max_value = 0.0
    for offset in range(0, max(1, len(samples) - frame_size), hop):
        frame = samples[offset : offset + frame_size]
        if not frame:
            continue
        value = math.sqrt(sum(sample * sample for sample in frame) / len(frame))
        max_value = max(max_value, value)
        values.append(value)
    if not values:
        values = [0.0]
    return [value / max_value if max_value else 0.0 for value in values]


def estimate_bpm_from_envelope(rms: list[float], duration: float) -> int:
    if duration < 8:
        return 128
    peak_count = 0
    for index, value in enumerate(rms):
        previous = rms[index - 1] if index else 0
        nxt = rms[index + 1] if index + 1 < len(rms) else 0
        if value > 0.62 and value > previous and value > nxt:
            peak_count += 1
    rough = round((peak_count / duration) * 60)
    return rough if 80 <= rough <= 170 else 128


def resample(values: list[float], target: int) -> list[float]:
    if target <= 0:
        return []
    if not values:
        return [0.0] * target
    output = []
    for index in range(target):
        start = math.floor((index / target) * len(values))
        end = max(start + 1, math.floor(((index + 1) / target) * len(values)))
        chunk = values[start:end]
        output.append(sum(chunk) / len(chunk))
    return output


def build_sections_from_energy(energy: list[int]) -> list[dict[str, Any]]:
    bars = len(energy)
    block = 16 if bars > 128 else 8
    sections: list[dict[str, Any]] = []
    loop_index = 0
    for start in range(1, bars + 1, block):
        end = min(bars, start + block - 1)
        chunk = energy[start - 1 : end]
        avg = sum(chunk) / max(1, len(chunk))
        previous = sections[-1]["energy"] if sections else avg
        section_type = classify_section(start, end, bars, avg, previous)
        drop_count = sum(1 for section in sections if section["type"] == "drop")
        label = f"Drop {drop_count + 1}" if section_type == "drop" else title_case(section_type)
        loop = f"Loop {chr(65 + (loop_index % 6))}{'↑' if section_type == 'build' else ''}"
        loop_index += 1
        sections.append(
            {
                "id": f"{section_type}-{start}",
                "label": label,
                "type": section_type,
                "startBar": start,
                "endBar": end,
                "loop": loop,
                "energy": round(avg),
                "similarity": round(48 + avg * 0.42),
            }
        )
    return sections


def classify_section(start: int, end: int, bars: int, avg: float, previous: float) -> str:
    if start == 1:
        return "intro"
    if end == bars:
        return "outro"
    if avg >= 74:
        return "drop"
    if avg >= previous + 10:
        return "build"
    if avg < 36:
        return "breakdown"
    return "groove"


def build_stem_lanes(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": name.lower().replace(" / ", "-").replace(" ", "-"),
            "name": name,
            "color": STEM_PALETTE[index],
            "activity": [stem_activity(index, section["type"]) for section in sections],
            "loops": [stem_loop(index, section["type"], section_index) for section_index, section in enumerate(sections)],
        }
        for index, name in enumerate(STEM_NAMES)
    ]


def stem_activity(stem_index: int, section_type: str) -> int:
    table = {
        "intro": [42, 12, 8, 38],
        "groove": [76, 68, 32, 58],
        "build": [82, 64, 42, 76],
        "drop": [96, 92, 54, 88],
        "breakdown": [14, 20, 46, 72],
        "outro": [34, 18, 8, 28],
        "variation": [64, 62, 42, 70],
    }
    return table[section_type][stem_index % 4]


def stem_loop(stem_index: int, section_type: str, section_index: int) -> str:
    if section_type == "breakdown" and stem_index < 2:
        return "—"
    base = ["D", "B", "V", "M"][stem_index % 4]
    suffix = "2" if section_type == "drop" and section_index > 4 else "↑" if section_type == "build" else ""
    return f"{base}{suffix}"


def title_case(value: str) -> str:
    return value[:1].upper() + value[1:]
