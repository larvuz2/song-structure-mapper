#!/usr/bin/env python3
"""Demucs wrapper for Song Structure Mapper.

Usage:
  python scripts/separate_stems.py input.mp3 --model htdemucs
  python scripts/separate_stems.py input.mp3 --model htdemucs_6s
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Separate a song into 4 or 6 stems with Demucs.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--model", default="htdemucs_6s", choices=["htdemucs", "htdemucs_6s"], help="htdemucs = 4 stems, htdemucs_6s = 6 stems")
    parser.add_argument("--out", type=Path, default=Path("data/separated"))
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 2

    if shutil.which("python") is None and shutil.which("python3") is None:
        print("Python executable not found.", file=sys.stderr)
        return 2

    py = shutil.which("python") or shutil.which("python3")
    command = [py, "-m", "demucs", "-n", args.model, "--out", str(args.out), str(args.input)]
    print("Running:", " ".join(command))
    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
