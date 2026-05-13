# Duckcipline Homestead V1 Manual Testing

## Timer and Project Progress

- Select an egg project and start a timer.
- Verify project progress increases while the timer runs.
- Pause and verify progress is saved.
- Reset and verify project progress remains.
- Close and reopen the side panel; verify progress remains.
- Complete a project before the timer ends; verify Claim waits until the timer is stopped.

## Seed and Egg Flow

- Select Small Seed Patch, complete it, and claim seeds.
- Select Meadow Egg, complete it, and claim a duck.
- Verify the new duck appears in the Homestead unplaced tray.
- Create or migrate enough ducks to reach 20; verify egg projects disable and seed projects remain available.

## Homestead

- Open Homestead.
- Pan to each map edge and verify the camera clamps.
- Widen the side panel and verify more world is visible without scaling tiles.
- Click an unplaced duck, then click a valid tile to place it.
- Drag an unplaced duck thumbnail to a valid tile.
- Try water/tree/rock placement and verify it is rejected.
- Drag a placed duck to another valid tile.
- Click a placed duck and verify details open.

## Duck Menu

- Rename a duck.
- Feed 1 seed and verify seed count decreases.
- Feed to next stage and verify growth at 5 and 10 seed thresholds.
- Verify adult ducks cannot be fed for growth.

## Fallback Assets

- Run without PNG assets under `src/assets/pixel`.
- Verify canvas tiles, objects, and ducks still draw with placeholders.
