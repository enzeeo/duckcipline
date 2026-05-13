#!/usr/bin/env python3
"""Verify Duckcipline pixel asset coverage and PNG dimensions."""

from __future__ import annotations

import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "src" / "assets" / "pixel"

DUCK_VARIANTS = (
    "meadow-a",
    "meadow-b",
    "pond-a",
    "pond-b",
    "fancy-a",
    "fancy-b",
    "brown-green",
    "white",
    "yellow",
    "gray",
    "light-brown",
    "gold",
    "white-black",
)
DUCK_STAGES = (
    ("duckling", "duckling"),
    ("youngDuck", "young-duck"),
    ("adultDuck", "adult-duck"),
)
DUCK_ACTIVITIES = ("idle", "wander", "swim", "eat", "sleep")

EXPECTED_GRID_ASSETS = {
    "tiles/grass.png": (32, 32),
    "tiles/grass-variant-1.png": (32, 32),
    "tiles/water.png": (32, 32),
    "tiles/water-ripple-0.png": (32, 32),
    "tiles/water-ripple-1.png": (32, 32),
    "tiles/water-ripple-2.png": (32, 32),
    "tiles/water-ripple-3.png": (32, 32),
    "tiles/path.png": (32, 32),
    "tiles/dirt-path.png": (32, 32),
    "tiles/flower.png": (32, 32),
    "objects/tree.png": (64, 64),
    "objects/rock.png": (32, 32),
    "objects/reeds.png": (32, 32),
    "objects/lily-pad.png": (32, 32),
    "objects/nest.png": (32, 32),
    "ui/egg-meadow.png": (32, 32),
    "ui/egg-pond.png": (32, 32),
    "ui/egg-fancy.png": (32, 32),
    "ui/seed.png": (32, 32),
    "ui/seed-bag.png": (32, 32),
    "ui/claim-sparkle.png": (32, 32),
    "ui/duck-footprint.png": (32, 32),
    "ui/hourglass.png": (32, 32),
    "ui/panel-frame.png": (32, 32),
}


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as file:
        signature = file.read(8)
        if signature != b"\x89PNG\r\n\x1a\n":
            raise ValueError("not a PNG file")

        chunk_length = struct.unpack(">I", file.read(4))[0]
        chunk_name = file.read(4)
        if chunk_name != b"IHDR" or chunk_length < 8:
            raise ValueError("missing IHDR chunk")

        width, height = struct.unpack(">II", file.read(8))
        return width, height


def add_expected_duck_assets(expected_assets: dict[str, tuple[int, int]]) -> None:
    for variant_id in DUCK_VARIANTS:
        for _growth_stage, stage_prefix in DUCK_STAGES:
            expected_assets[f"ducks/{stage_prefix}-{variant_id}.png"] = (32, 32)
            for activity in DUCK_ACTIVITIES:
                for frame_index in range(4):
                    expected_assets[f"ducks/{stage_prefix}-{variant_id}-{activity}-{frame_index}.png"] = (32, 32)


def main() -> None:
    expected_assets = dict(EXPECTED_GRID_ASSETS)
    add_expected_duck_assets(expected_assets)

    failures: list[str] = []
    for relative_path, expected_size in sorted(expected_assets.items()):
        path = ASSET_ROOT / relative_path
        if not path.exists():
            failures.append(f"missing {relative_path}")
            continue

        try:
            actual_size = read_png_size(path)
        except ValueError as error:
            failures.append(f"{relative_path}: {error}")
            continue

        if actual_size != expected_size:
            failures.append(f"{relative_path}: expected {expected_size[0]}x{expected_size[1]}, got {actual_size[0]}x{actual_size[1]}")

    if failures:
        print("asset verification failed")
        for failure in failures[:40]:
            print(f"- {failure}")
        if len(failures) > 40:
            print(f"- ... {len(failures) - 40} more")
        raise SystemExit(1)

    print(f"verified {len(expected_assets)} pixel assets")


if __name__ == "__main__":
    main()
