#!/usr/bin/env python3
"""Print small-batch ChatGPT image prompts for Duckcipline sprite sheets."""

from __future__ import annotations

import argparse


DUCK_VARIANTS = {
    "brown-green": "mallard colors: brown body, dark green head, orange beak, cream wing mark",
    "white": "warm white duck, orange beak, soft cream shadows",
    "yellow": "yellow duck, orange beak, slightly deeper yellow shadows",
    "gray": "gray duck, orange beak, charcoal head shadows",
    "light-brown": "light brown duck, orange beak, tan highlights",
    "gold": "gold duck, orange beak, bright golden highlights",
    "white-black": "white duck with black head and black wing markings, orange beak",
}

DUCK_STAGES = {
    "duckling": "small duckling proportions",
    "youngDuck": "medium young duck proportions",
    "adultDuck": "large adult duck proportions",
}

DUCK_ROWS = ("idle", "wander", "swim", "eat", "sleep")


def create_duck_prompt(variant_id: str, growth_stage: str, option_number: int) -> str:
    variant_description = DUCK_VARIANTS[variant_id]
    stage_description = DUCK_STAGES[growth_stage]
    rows = ", ".join(DUCK_ROWS)

    return (
        f"Option {option_number}: Create one pixel-art sprite sheet for Duckcipline. "
        f"Subject: one {stage_description}, {variant_description}. "
        "Canvas: transparent PNG style with solid #ff00ff background only where transparency is needed. "
        "Layout: exactly 4 columns and 5 rows, no labels, no text, no numbers, no grid lines. "
        "Each cell is one centered side-view duck frame, consistent scale, facing right, thick dark outline, "
        "cozy farming game style, crisp nearest-neighbor pixels. "
        f"Rows from top to bottom: {rows}. "
        "Columns are frames 0, 1, 2, 3 for that row. "
        "Idle should gently bob, wander is walking on land, swim sits lower with small water ripples, "
        "eat bends the head down, sleep rests with closed eye and small Z pixels. "
        "Keep all frames aligned so they can be cropped uniformly."
    )


def create_environment_prompt(batch_id: str, option_number: int) -> str:
    if batch_id == "environment-a":
        items = "grass tile, grass variant tile, water tile, path tile, dirt path tile, flower grass tile"
        layout = "exactly 6 columns and 1 row"
    elif batch_id == "environment-b":
        items = "water ripple frame 0, water ripple frame 1, water ripple frame 2, water ripple frame 3, reeds, lily pad, rock"
        layout = "exactly 7 columns and 1 row"
    else:
        items = "large leafy tree, straw nest"
        layout = "exactly 2 columns and 1 row"

    return (
        f"Option {option_number}: Create one pixel-art Duckcipline environment sprite sheet. "
        f"Items left to right: {items}. "
        f"Layout: {layout}, no labels, no text, no numbers, no grid lines. "
        "Use solid #ff00ff background only where transparency is needed. "
        "Crisp cozy farming game pixel art, thick dark outline, readable at 32x32 pixels. "
        "Tree should remain readable when cropped to 64x64; all other items should remain readable at 32x32. "
        "Keep each item centered in its cell for uniform cropping."
    )


def create_egg_prompt(option_number: int) -> str:
    return (
        f"Option {option_number}: Create one pixel-art Duckcipline egg sprite sheet. "
        "Items left to right: meadow egg, pond egg, fancy egg. "
        "Layout: exactly 3 columns and 1 row, no labels, no text, no numbers, no grid lines. "
        "Use solid #ff00ff background only where transparency is needed. "
        "Each egg is a static sprite only, centered, thick dark outline, cozy farming game style, "
        "readable at 32x32 pixels. Meadow egg is warm cream with brown speckles; "
        "pond egg is pale blue-green with teal speckles; fancy egg is golden with bright highlights."
    )


def print_prompt_group(title: str, prompts: list[str]) -> None:
    print(f"## {title}")
    print()
    for prompt in prompts:
        print(prompt)
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Print small-batch image generation prompts.")
    parser.add_argument(
        "--batch",
        choices=("style-lock", "ducks", "environment", "eggs", "all"),
        default="all",
        help="Prompt batch to print.",
    )
    parser.add_argument("--variant", choices=tuple(DUCK_VARIANTS), help="Duck variant for --batch ducks.")
    parser.add_argument("--stage", choices=tuple(DUCK_STAGES), help="Duck growth stage for --batch ducks.")
    parser.add_argument("--options", type=int, default=3, help="Number of prompt options to print.")
    args = parser.parse_args()

    option_numbers = list(range(1, args.options + 1))

    if args.batch in ("style-lock", "all"):
        print_prompt_group(
            "Style Lock: brown-green adultDuck",
            [create_duck_prompt("brown-green", "adultDuck", option_number) for option_number in option_numbers],
        )

    if args.batch in ("ducks", "all"):
        variants = [args.variant] if args.variant else list(DUCK_VARIANTS)
        stages = [args.stage] if args.stage else list(DUCK_STAGES)
        for variant_id in variants:
            for growth_stage in stages:
                print_prompt_group(
                    f"Duck: {variant_id} {growth_stage}",
                    [create_duck_prompt(variant_id, growth_stage, option_number) for option_number in option_numbers],
                )

    if args.batch in ("environment", "all"):
        for batch_id in ("environment-a", "environment-b", "environment-c"):
            print_prompt_group(
                batch_id,
                [create_environment_prompt(batch_id, option_number) for option_number in option_numbers],
            )

    if args.batch in ("eggs", "all"):
        print_prompt_group("Eggs", [create_egg_prompt(option_number) for option_number in option_numbers])


if __name__ == "__main__":
    main()
