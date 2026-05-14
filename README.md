# Duckcipline

Privacy-first Chrome extension for focus sessions and a local duck homestead.

Duckcipline runs entirely in Chrome. Timer state is owned by the Manifest V3 background service worker, short-lived timer state uses `chrome.storage.session`, and long-lived homestead progress uses local extension storage.

## Current Product

- Side panel extension UI.
- Timestamp-based focus timer.
- Project progress that advances while the timer runs.
- Duck hatching, seed rewards, placement, renaming, and growth.
- Canvas homestead with local pixel assets and drawn fallbacks.

## Quick Start

Use Node 20.19.0 or newer. With `nvm`:

```bash
nvm use
```

```bash
npm ci
npm run build
```

Load the built extension in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this repo's `dist/` directory.

For local development:

```bash
npm run dev
```

## Scripts

```text
npm run typecheck       TypeScript only
npm test                Run unit tests once
npm run test:watch      Run unit tests in watch mode
npm run build           Typecheck and build extension
npm run build:watch     Rebuild extension on file changes
npm run package         Build release/duckcipline-0.1.0.zip
npm run assets:prompts  Generate sprite-sheet prompt batches
npm run assets:extract  Extract selected sprites into runtime assets
npm run assets:verify   Verify generated pixel assets
```

## Project Layout

```text
src/
  background/   Chrome service worker adapter, app orchestration, storage adapters
  popup/        Side panel UI, DOM wiring, sprite loading, canvas rendering, simulation
  shared/       Cross-runtime types, message contracts, game logic, definitions
  timer/        Pure timestamp-based timer utilities
  assets/       Local pixel assets bundled into the extension
docs/
  DESIGN.md                    Product/design contract
  MANUAL_TESTING.md            Manual QA checklist
  TODO.md                      Roadmap and follow-up work
  DUCK_HOMESTEAD_CODEX_PLAN.md Historical implementation plan
workflow/
  README.md                    Asset and diagram workflow notes
  popup-page-workflow.*        Popup workflow source and rendered diagram
  sprite_sheet_manifest.json   Selected sprite-sheet extraction manifest
scripts/
  *.py, *.sh                   Asset generation and verification helpers
```

## Architecture

```text
Chrome runtime
   |
   | message passing
   v
src/background/background.ts
   |-- Chrome service worker adapter
   +--> src/background/backgroundApplication.ts
   |      owns canonical timer/game state flow
   +--> src/background/stateStore.ts
   |      chrome.storage and memory-backed storage adapters
   |
   +--> src/timer/timerState.ts
   |      pure timestamp math, no Chrome APIs
   |
   +--> src/shared/gameLogic.ts
          pure homestead/project state transitions

src/popup/popup.ts
   |-- sends typed messages to background
   |-- renders timer, project controls, and homestead state
   +--> src/popup/canvasRenderer.ts
   +--> src/popup/assetLoader.ts
   +--> src/popup/homesteadSimulation.ts
```

Rules that matter:

- The popup never owns canonical timer state.
- Timer correctness comes from timestamps, not `setInterval`.
- Pure logic stays outside Chrome APIs when practical.
- Runtime assets are local only. No remote image or analytics calls.
- Keep extension permissions minimal. Current manifest uses `storage` and `sidePanel`.

## Documentation

- [Design contract](docs/DESIGN.md)
- [Manual testing checklist](docs/MANUAL_TESTING.md)
- [Roadmap and TODOs](docs/TODO.md)
- [Workflow notes](workflow/README.md)

## Testing

Use the smallest relevant check while editing:

```bash
npm test
npm run typecheck
npm run build
npm run assets:verify
npm run package
```

Manual QA lives in [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md).
