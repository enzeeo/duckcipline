#!/usr/bin/env python3
"""Generate Duckcipline pixel sprites with no external dependencies."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "src" / "assets" / "pixel"
DUCK_ROOT = ASSET_ROOT / "ducks"
TILE_ROOT = ASSET_ROOT / "tiles"
OBJECT_ROOT = ASSET_ROOT / "objects"
UI_ROOT = ASSET_ROOT / "ui"

TRANSPARENT = (0, 0, 0, 0)
OUTLINE = (42, 32, 25, 255)
BEAK = (234, 139, 33, 255)
BEAK_LIGHT = (255, 186, 64, 255)
FOOT = (218, 105, 35, 255)
WATER_HIGHLIGHT = (181, 238, 246, 255)

VARIANTS = {
    "brown-green": {
        "body": (116, 74, 48, 255),
        "body_shadow": (82, 48, 34, 255),
        "body_light": (166, 126, 88, 255),
        "head": (26, 134, 104, 255),
        "head_shadow": (15, 86, 69, 255),
        "wing": (238, 236, 208, 255),
        "accent": (30, 151, 127, 255),
    },
    "white": {
        "body": (255, 244, 213, 255),
        "body_shadow": (226, 207, 181, 255),
        "body_light": (255, 252, 229, 255),
        "head": (255, 247, 216, 255),
        "head_shadow": (230, 214, 188, 255),
        "wing": (255, 236, 199, 255),
        "accent": (242, 192, 150, 255),
    },
    "yellow": {
        "body": (252, 210, 82, 255),
        "body_shadow": (217, 156, 49, 255),
        "body_light": (255, 233, 132, 255),
        "head": (255, 217, 83, 255),
        "head_shadow": (224, 165, 45, 255),
        "wing": (255, 232, 113, 255),
        "accent": (249, 179, 60, 255),
    },
    "gray": {
        "body": (112, 112, 108, 255),
        "body_shadow": (69, 68, 67, 255),
        "body_light": (151, 151, 143, 255),
        "head": (68, 75, 74, 255),
        "head_shadow": (38, 42, 42, 255),
        "wing": (89, 91, 88, 255),
        "accent": (239, 213, 166, 255),
    },
    "light-brown": {
        "body": (218, 162, 101, 255),
        "body_shadow": (151, 93, 55, 255),
        "body_light": (244, 193, 125, 255),
        "head": (238, 189, 127, 255),
        "head_shadow": (172, 107, 64, 255),
        "wing": (189, 123, 75, 255),
        "accent": (255, 223, 168, 255),
    },
    "gold": {
        "body": (246, 186, 50, 255),
        "body_shadow": (181, 112, 28, 255),
        "body_light": (255, 222, 86, 255),
        "head": (255, 204, 65, 255),
        "head_shadow": (190, 124, 30, 255),
        "wing": (255, 228, 103, 255),
        "accent": (255, 247, 177, 255),
    },
    "white-black": {
        "body": (239, 230, 204, 255),
        "body_shadow": (203, 190, 164, 255),
        "body_light": (255, 248, 225, 255),
        "head": (50, 49, 45, 255),
        "head_shadow": (25, 24, 23, 255),
        "wing": (58, 57, 52, 255),
        "accent": (255, 245, 214, 255),
    },
}

STAGES = ("duckling", "youngDuck", "adultDuck")
ANIMATIONS = ("idle", "wander", "swim", "eat", "sleep")


class Canvas:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.pixels = [TRANSPARENT] * (width * height)

    def set_pixel(self, x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y * self.width + x] = color

    def rect(self, x: int, y: int, width: int, height: int, color: tuple[int, int, int, int]) -> None:
        for row in range(y, y + height):
            for column in range(x, x + width):
                self.set_pixel(column, row, color)

    def ellipse(self, center_x: int, center_y: int, radius_x: int, radius_y: int, color: tuple[int, int, int, int]) -> None:
        for y in range(center_y - radius_y, center_y + radius_y + 1):
            for x in range(center_x - radius_x, center_x + radius_x + 1):
                normalized_x = (x - center_x) / max(1, radius_x)
                normalized_y = (y - center_y) / max(1, radius_y)
                if normalized_x * normalized_x + normalized_y * normalized_y <= 1:
                    self.set_pixel(x, y, color)

    def line(self, x1: int, y1: int, x2: int, y2: int, color: tuple[int, int, int, int]) -> None:
        dx = abs(x2 - x1)
        dy = -abs(y2 - y1)
        step_x = 1 if x1 < x2 else -1
        step_y = 1 if y1 < y2 else -1
        error = dx + dy
        x = x1
        y = y1
        while True:
            self.set_pixel(x, y, color)
            if x == x2 and y == y2:
                break
            doubled_error = 2 * error
            if doubled_error >= dy:
                error += dy
                x += step_x
            if doubled_error <= dx:
                error += dx
                y += step_y

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        raw_rows = []
        for row in range(self.height):
            raw_rows.append(bytes([0]))
            for pixel in self.pixels[row * self.width : (row + 1) * self.width]:
                raw_rows.append(bytes(pixel))
        raw = b"".join(raw_rows)

        def chunk(name: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(raw, 9))
        png += chunk(b"IEND", b"")
        path.write_bytes(png)


def stage_prefix(stage: str) -> str:
    if stage == "duckling":
        return "duckling"
    if stage == "youngDuck":
        return "young-duck"
    return "adult-duck"


def duck_size(stage: str) -> dict[str, int]:
    if stage == "duckling":
        return {"body_x": 13, "body_y": 18, "body_rx": 8, "body_ry": 5, "head_x": 19, "head_y": 12, "head_rx": 5, "head_ry": 5}
    if stage == "youngDuck":
        return {"body_x": 13, "body_y": 19, "body_rx": 10, "body_ry": 6, "head_x": 20, "head_y": 12, "head_rx": 5, "head_ry": 6}
    return {"body_x": 13, "body_y": 19, "body_rx": 12, "body_ry": 7, "head_x": 20, "head_y": 11, "head_rx": 6, "head_ry": 6}


def draw_duck(stage: str, palette: dict[str, tuple[int, int, int, int]], animation: str, frame: int) -> Canvas:
    canvas = Canvas(32, 32)
    size = duck_size(stage)
    body_x = size["body_x"]
    body_y = size["body_y"]
    head_x = size["head_x"]
    head_y = size["head_y"]
    foot_offset = 0

    if animation == "idle":
        head_y += frame % 2
    elif animation == "wander":
        body_x += -1 if frame in (1, 2) else 0
        head_x += -1 if frame in (1, 2) else 0
        foot_offset = -1 if frame % 2 == 0 else 1
    elif animation == "swim":
        body_y += 2
        head_y += 1
        canvas.line(4, 23, 27, 23, WATER_HIGHLIGHT)
        canvas.line(7 + frame, 26, 16 + frame, 26, WATER_HIGHLIGHT)
    elif animation == "eat":
        head_x -= 3
        head_y += 4 + (frame % 2)
    elif animation == "sleep":
        body_y += 2
        head_x -= 2
        head_y += 3

    tail_x = body_x - size["body_rx"] + 1
    tail_y = body_y - 3
    canvas.line(tail_x, tail_y, tail_x - 4, tail_y - 4, OUTLINE)
    canvas.line(tail_x, tail_y + 1, tail_x - 4, tail_y - 1, OUTLINE)
    canvas.line(tail_x + 1, tail_y, tail_x - 2, tail_y - 3, palette["body_light"])
    canvas.line(tail_x + 1, tail_y + 1, tail_x - 2, tail_y, palette["body_light"])

    canvas.ellipse(body_x, body_y, size["body_rx"] + 1, size["body_ry"] + 1, OUTLINE)
    canvas.ellipse(body_x, body_y, size["body_rx"], size["body_ry"], palette["body"])
    canvas.rect(body_x - size["body_rx"] + 4, body_y + 3, size["body_rx"] + 8, 3, palette["body_shadow"])
    canvas.ellipse(body_x + 1, body_y - 1, max(3, size["body_rx"] - 4), max(2, size["body_ry"] - 3), palette["body_light"])

    wing_x = body_x - 1
    wing_y = body_y
    canvas.ellipse(wing_x, wing_y, max(4, size["body_rx"] - 4), max(2, size["body_ry"] - 3), OUTLINE)
    canvas.ellipse(wing_x, wing_y, max(3, size["body_rx"] - 5), max(1, size["body_ry"] - 4), palette["wing"])
    canvas.rect(wing_x - 2, wing_y + 1, 6, 2, palette["accent"])

    neck_x = head_x - 4
    canvas.rect(neck_x, head_y + 3, 5, 8, OUTLINE)
    canvas.rect(neck_x + 1, head_y + 3, 3, 8, palette["head"])
    canvas.ellipse(head_x, head_y, size["head_rx"] + 1, size["head_ry"] + 1, OUTLINE)
    canvas.ellipse(head_x, head_y, size["head_rx"], size["head_ry"], palette["head"])
    canvas.rect(head_x - size["head_rx"] + 2, head_y + size["head_ry"] - 2, size["head_rx"] + 2, 2, palette["head_shadow"])

    beak_y = head_y + (3 if animation == "eat" else 0)
    canvas.rect(head_x + size["head_rx"] - 1, beak_y - 2, 7, 5, OUTLINE)
    canvas.rect(head_x + size["head_rx"], beak_y - 1, 7, 3, BEAK)
    canvas.rect(head_x + size["head_rx"], beak_y - 2, 5, 2, BEAK_LIGHT)

    if animation == "sleep":
        canvas.line(head_x + 1, head_y - 1, head_x + 4, head_y - 1, OUTLINE)
        canvas.rect(25, 5 - frame % 2, 2, 2, OUTLINE)
        canvas.rect(27, 3 - frame % 2, 2, 2, OUTLINE)
    else:
        canvas.rect(head_x + 2, head_y - 2, 2, 2, OUTLINE)
        canvas.set_pixel(head_x + 2, head_y - 2, (20, 80, 70, 255))

    if animation != "swim":
        canvas.rect(body_x - 4 + foot_offset, body_y + size["body_ry"], 3, 3, OUTLINE)
        canvas.rect(body_x - 3 + foot_offset, body_y + size["body_ry"], 2, 4, FOOT)
        canvas.rect(body_x + 6 - foot_offset, body_y + size["body_ry"], 3, 3, OUTLINE)
        canvas.rect(body_x + 7 - foot_offset, body_y + size["body_ry"], 2, 4, FOOT)

    return canvas


def draw_egg(color: tuple[int, int, int, int], accent: tuple[int, int, int, int]) -> Canvas:
    canvas = Canvas(32, 32)
    canvas.ellipse(16, 18, 9, 12, OUTLINE)
    canvas.ellipse(16, 18, 8, 11, color)
    canvas.rect(10, 21, 13, 5, accent)
    canvas.rect(12, 9, 6, 3, (255, 252, 232, 255))
    canvas.rect(22, 15, 2, 3, OUTLINE)
    return canvas


def draw_nest() -> Canvas:
    canvas = Canvas(32, 32)
    for offset in range(4):
        canvas.line(5, 19 + offset, 27, 15 + offset, (99, 62, 33, 255))
        canvas.line(7, 14 + offset, 25, 22 + offset, (156, 104, 55, 255))
    canvas.ellipse(16, 18, 11, 6, OUTLINE)
    canvas.ellipse(16, 18, 10, 5, (132, 79, 39, 255))
    canvas.ellipse(16, 17, 6, 3, (83, 50, 30, 255))
    return canvas


def draw_tree() -> Canvas:
    canvas = Canvas(64, 64)
    trunk = (104, 72, 39, 255)
    leaf_dark = (45, 91, 48, 255)
    leaf = (69, 126, 58, 255)
    leaf_light = (105, 159, 76, 255)
    canvas.rect(28, 34, 10, 24, OUTLINE)
    canvas.rect(30, 34, 7, 24, trunk)
    for center_x, center_y, radius in ((23, 25, 14), (34, 18, 17), (43, 29, 14), (31, 34, 17)):
        canvas.ellipse(center_x, center_y, radius, radius - 3, OUTLINE)
        canvas.ellipse(center_x, center_y, radius - 1, radius - 4, leaf)
    canvas.rect(22, 20, 9, 4, leaf_light)
    canvas.rect(37, 12, 9, 4, leaf_light)
    canvas.rect(42, 31, 8, 4, leaf_dark)
    return canvas


def draw_rock() -> Canvas:
    canvas = Canvas(32, 32)
    canvas.ellipse(16, 19, 12, 8, OUTLINE)
    canvas.ellipse(16, 19, 11, 7, (128, 129, 118, 255))
    canvas.rect(9, 14, 9, 3, (181, 177, 158, 255))
    canvas.rect(19, 21, 5, 3, (92, 93, 87, 255))
    return canvas


def draw_reeds() -> Canvas:
    canvas = Canvas(32, 32)
    green = (58, 113, 62, 255)
    cattail = (139, 87, 43, 255)
    for x, top in ((9, 8), (14, 4), (19, 10), (23, 6)):
        canvas.line(x, 29, x, top, OUTLINE)
        canvas.line(x + 1, 29, x + 1, top, green)
        canvas.rect(x - 1, top - 2, 4, 5, cattail)
    canvas.rect(5, 27, 22, 3, (48, 93, 52, 255))
    return canvas


def draw_lily_pad() -> Canvas:
    canvas = Canvas(32, 32)
    canvas.ellipse(16, 17, 11, 8, OUTLINE)
    canvas.ellipse(16, 17, 10, 7, (58, 139, 70, 255))
    canvas.line(16, 17, 25, 10, TRANSPARENT)
    canvas.line(15, 18, 25, 12, (39, 103, 53, 255))
    canvas.rect(12, 13, 4, 3, (102, 174, 85, 255))
    canvas.rect(18, 20, 6, 2, (39, 103, 53, 255))
    return canvas


def draw_tile(kind: str, frame: int = 0) -> Canvas:
    canvas = Canvas(32, 32)
    if kind == "water":
        canvas.rect(0, 0, 32, 32, (73, 158, 187, 255))
        canvas.rect(5, 10, 10, 2, (96, 190, 214, 255))
        canvas.rect(18, 22, 8, 2, (51, 134, 177, 255))
    elif kind == "water-ripple":
        canvas.rect(0, 0, 32, 32, (73, 158, 187, 255))
        canvas.rect(3 + frame * 2, 9, 11, 2, WATER_HIGHLIGHT)
        canvas.rect(18 - frame, 19, 9, 2, (96, 190, 214, 255))
        canvas.rect(8, 25 - frame % 2, 7, 2, (51, 134, 177, 255))
    elif kind == "path":
        canvas.rect(0, 0, 32, 32, (187, 134, 76, 255))
        canvas.rect(2, 5, 12, 4, (211, 157, 91, 255))
        canvas.rect(20, 20, 8, 4, (144, 91, 51, 255))
        canvas.rect(8, 26, 5, 3, (119, 75, 43, 255))
    elif kind == "dirt-path":
        canvas.rect(0, 0, 32, 32, (143, 93, 54, 255))
        canvas.rect(4, 4, 8, 3, (180, 123, 68, 255))
        canvas.rect(18, 11, 8, 4, (112, 70, 42, 255))
        canvas.rect(9, 23, 11, 3, (166, 109, 61, 255))
    else:
        base = (122, 171, 84, 255) if kind != "grass-variant" else (135, 185, 94, 255)
        canvas.rect(0, 0, 32, 32, base)
        canvas.rect(4, 5, 5, 2, (91, 137, 67, 255))
        canvas.rect(20, 19, 7, 2, (98, 145, 69, 255))
        canvas.rect(14, 9, 3, 2, (158, 202, 105, 255))
        if kind == "flower":
            canvas.rect(15, 14, 2, 6, (65, 124, 57, 255))
            canvas.rect(12, 12, 3, 3, (255, 240, 214, 255))
            canvas.rect(17, 12, 3, 3, (255, 240, 214, 255))
            canvas.rect(14, 10, 4, 3, (247, 194, 82, 255))
    return canvas


def generate_ducks() -> None:
    for variant, palette in VARIANTS.items():
        for stage in STAGES:
            idle_canvas = draw_duck(stage, palette, "idle", 0)
            idle_canvas.save(DUCK_ROOT / f"{stage_prefix(stage)}-{variant}.png")
            for animation in ANIMATIONS:
                for frame in range(4):
                    draw_duck(stage, palette, animation, frame).save(
                        DUCK_ROOT / f"{stage_prefix(stage)}-{variant}-{animation}-{frame}.png"
                    )


def generate_static_assets() -> None:
    draw_egg((247, 223, 168, 255), (178, 126, 77, 255)).save(UI_ROOT / "egg-meadow.png")
    draw_egg((199, 234, 229, 255), (83, 151, 160, 255)).save(UI_ROOT / "egg-pond.png")
    draw_egg((252, 218, 108, 255), (231, 159, 55, 255)).save(UI_ROOT / "egg-fancy.png")
    draw_nest().save(OBJECT_ROOT / "nest.png")
    draw_tree().save(OBJECT_ROOT / "tree.png")
    draw_rock().save(OBJECT_ROOT / "rock.png")
    draw_reeds().save(OBJECT_ROOT / "reeds.png")
    draw_lily_pad().save(OBJECT_ROOT / "lily-pad.png")
    draw_tile("grass").save(TILE_ROOT / "grass.png")
    draw_tile("grass-variant").save(TILE_ROOT / "grass-variant-1.png")
    draw_tile("water").save(TILE_ROOT / "water.png")
    for frame in range(4):
        draw_tile("water-ripple", frame).save(TILE_ROOT / f"water-ripple-{frame}.png")
    draw_tile("path").save(TILE_ROOT / "path.png")
    draw_tile("dirt-path").save(TILE_ROOT / "dirt-path.png")
    draw_tile("flower").save(TILE_ROOT / "flower.png")


def main() -> None:
    generate_ducks()
    generate_static_assets()
    generated_duck_files = len(VARIANTS) * len(STAGES) * (1 + len(ANIMATIONS) * 4)
    print(f"generated {generated_duck_files} duck sprites and refreshed tiles/objects/ui assets")


if __name__ == "__main__":
    main()
