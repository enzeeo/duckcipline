#!/usr/bin/env python3
"""Crop selected sprite sheets into Duckcipline pixel assets."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST_PATH = ROOT / "workflow" / "sprite_sheet_manifest.json"
ASSET_ROOT = ROOT / "src" / "assets" / "pixel"
DUCK_ROOT = ASSET_ROOT / "ducks"

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
DUCK_STAGES = {
    "duckling": "duckling",
    "youngDuck": "young-duck",
    "adultDuck": "adult-duck",
}
DUCK_ACTIVITIES = ("idle", "wander", "swim", "eat", "sleep")


def read_json_file(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")

    return data


def resolve_repo_path(path_value: str) -> Path:
    path = Path(path_value).expanduser()
    if path.is_absolute():
        return path
    return ROOT / path


def require_int(value: Any, field_name: str) -> int:
    if not isinstance(value, int):
        raise ValueError(f"{field_name} must be an integer")
    return value


def require_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    return value


def read_crop_box(sprite: dict[str, Any]) -> tuple[int, int, int, int]:
    crop = sprite.get("crop")
    if isinstance(crop, dict):
        return (
            require_int(crop.get("x"), "crop.x"),
            require_int(crop.get("y"), "crop.y"),
            require_int(crop.get("width"), "crop.width"),
            require_int(crop.get("height"), "crop.height"),
        )

    return (
        require_int(sprite["cropX"], "cropX"),
        require_int(sprite["cropY"], "cropY"),
        require_int(sprite["cropWidth"], "cropWidth"),
        require_int(sprite["cropHeight"], "cropHeight"),
    )


def add_background_cleanup_args(command: list[str], sprite: dict[str, Any], crop_width: int, crop_height: int) -> None:
    transparent_color = sprite.get("transparentColor")
    if transparent_color is not None:
        command.extend(["-fuzz", str(sprite.get("transparentColorFuzz", "8%")), "-transparent", str(transparent_color)])

    if sprite.get("floodTransparent", False) is True:
        command.extend(["-alpha", "set", "-fuzz", str(sprite.get("floodTransparentFuzz", "5%")), "-fill", "none"])
        command.extend(["-draw", "color 0,0 floodfill"])
        command.extend(["-draw", f"color {crop_width - 1},0 floodfill"])
        command.extend(["-draw", f"color 0,{crop_height - 1} floodfill"])
        command.extend(["-draw", f"color {crop_width - 1},{crop_height - 1} floodfill"])


def crop_sprite(
    magick_binary: str,
    source_path: Path,
    output_path: Path,
    sprite: dict[str, Any],
    default_output_width: int,
    default_output_height: int,
) -> None:
    crop_x, crop_y, crop_width, crop_height = read_crop_box(sprite)
    output_width = require_int(sprite.get("outputWidth", default_output_width), "outputWidth")
    output_height = require_int(sprite.get("outputHeight", default_output_height), "outputHeight")
    should_trim = sprite.get("trim", True) is True

    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        magick_binary,
        str(source_path),
        "-crop",
        f"{crop_width}x{crop_height}+{crop_x}+{crop_y}",
        "+repage",
    ]
    add_background_cleanup_args(command, sprite, crop_width, crop_height)
    if should_trim:
        command.extend(["-trim", "+repage"])
    command.extend(
        [
            "-filter",
            "point",
            "-resize",
            f"{output_width}x{output_height}",
            "-background",
            "none",
            "-gravity",
            "center",
            "-extent",
            f"{output_width}x{output_height}",
            str(output_path),
        ]
    )
    subprocess.run(command, check=True)


def clean_output_directories(manifest: dict[str, Any]) -> None:
    directories = manifest.get("cleanOutputDirectories", [])
    if not isinstance(directories, list):
        raise ValueError("cleanOutputDirectories must be a list")

    for directory_value in directories:
        directory = resolve_repo_path(require_string(directory_value, "cleanOutputDirectories[]"))
        if not directory.is_dir():
            continue

        for image_path in directory.glob("*.png"):
            image_path.unlink()


def crop_grid_sheet(sheet: dict[str, Any], magick_binary: str) -> int:
    source_path = resolve_repo_path(require_string(sheet["sourcePath"], "sourcePath"))
    if not source_path.exists():
        raise FileNotFoundError(f"sprite sheet does not exist: {source_path}")

    sprites = sheet.get("sprites", [])
    if not isinstance(sprites, list):
        raise ValueError("grid sheet sprites must be a list")

    cropped_count = 0
    for sprite in sprites:
        if not isinstance(sprite, dict):
            raise ValueError("grid sheet sprites must be objects")

        output_path = resolve_repo_path(require_string(sprite["outputPath"], "outputPath"))
        crop_sprite(magick_binary, source_path, output_path, sprite, 32, 32)
        cropped_count += 1

    return cropped_count


def get_duck_sprite_name(variant_id: str, stage_prefix: str) -> str:
    return f"{stage_prefix}-{variant_id}.png"


def get_duck_animation_sprite_name(variant_id: str, stage_prefix: str, activity: str, frame_index: int) -> str:
    return f"{stage_prefix}-{variant_id}-{activity}-{frame_index}.png"


def crop_duck_placeholder_sheet(sheet: dict[str, Any], magick_binary: str) -> int:
    source_path = resolve_repo_path(require_string(sheet["sourcePath"], "sourcePath"))
    if not source_path.exists():
        raise FileNotFoundError(f"sprite sheet does not exist: {source_path}")

    frames_by_activity = sheet.get("framesByActivity")
    if not isinstance(frames_by_activity, dict):
        raise ValueError("duck placeholder sheet requires framesByActivity")

    cropped_count = 0
    for variant_id in DUCK_VARIANTS:
        for stage_prefix in DUCK_STAGES.values():
            for activity in DUCK_ACTIVITIES:
                frames = frames_by_activity.get(activity)
                if not isinstance(frames, list) or len(frames) == 0:
                    raise ValueError(f"missing frames for duck activity: {activity}")

                for frame_index in range(4):
                    frame = frames[min(frame_index, len(frames) - 1)]
                    if not isinstance(frame, dict):
                        raise ValueError(f"duck frame for {activity} must be an object")

                    output_path = DUCK_ROOT / get_duck_animation_sprite_name(variant_id, stage_prefix, activity, frame_index)
                    crop_sprite(magick_binary, source_path, output_path, frame, 32, 32)
                    cropped_count += 1

            shutil.copyfile(
                DUCK_ROOT / get_duck_animation_sprite_name(variant_id, stage_prefix, "idle", 0),
                DUCK_ROOT / get_duck_sprite_name(variant_id, stage_prefix),
            )
            cropped_count += 1

    return cropped_count


def extract_assets(manifest_path: Path) -> int:
    manifest = read_json_file(manifest_path)
    magick_binary = str(manifest.get("magickBinary", "magick"))
    sprite_sheets = manifest.get("spriteSheets", [])
    if not isinstance(sprite_sheets, list):
        raise ValueError("spriteSheets must be a list")

    clean_output_directories(manifest)

    cropped_count = 0
    for sheet in sprite_sheets:
        if not isinstance(sheet, dict):
            raise ValueError("sprite sheet entries must be objects")

        sheet_type = sheet.get("type")
        if sheet_type == "grid":
            cropped_count += crop_grid_sheet(sheet, magick_binary)
        elif sheet_type == "duckPlaceholders":
            cropped_count += crop_duck_placeholder_sheet(sheet, magick_binary)
        else:
            raise ValueError(f"unsupported sprite sheet type: {sheet_type}")

    return cropped_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract selected sprite sheets into Duckcipline pixel assets.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST_PATH)
    args = parser.parse_args()

    manifest_path = args.manifest if args.manifest.is_absolute() else ROOT / args.manifest
    cropped_count = extract_assets(manifest_path)
    print(f"cropped {cropped_count} assets from {manifest_path}")


if __name__ == "__main__":
    main()
