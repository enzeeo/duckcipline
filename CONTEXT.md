# Duckcipline Context

## Domain Terms

- **Focus Session**: A timed work period controlled by the background timer state.
- **Project**: A selectable reward track that gains progress from Focus Session time.
- **Duck**: A local reward entity that can be hatched, named, fed, placed, and simulated in the Homestead.
- **Homestead**: The grid-based garden space where Ducks are placed, rendered, and simulated.
- **Panel Shell**: The popup-side adapter that owns DOM elements, browser events, Chrome runtime messages, and rendering calls.
- **Homestead Interaction**: The popup-side module that owns Homestead selection, camera, pointer, follow, simulation, and save-snapshot state without direct DOM or Chrome runtime access.

## Product Contract

- Privacy-first Chrome extension.
- Runs locally with no backend, accounts, analytics, or tracking.
- Manifest V3 side panel UI.
- Background service worker owns canonical timer and game state.
- Popup renders state and sends typed messages.
- Timer resets when Chrome closes.
- Duck, seed, project, and homestead progress persists locally.

## State And Storage

- `timerState`: stored in `chrome.storage.session`.
- `gameState`: stored in `chrome.storage.local`.
- `duckRewardsState`: legacy local key used for migration only.
- Timer math must use timestamps from `startedAtTimestampMilliseconds`.
- Do not make `setInterval` or popup polling the source of truth.

## Code Boundaries

- `src/background`: service worker adapter, app orchestration, and storage adapters.
- `src/timer`: pure timer state utilities.
- `src/shared`: shared types, messages, game rules, project definitions, map rules, and asset contracts.
- `src/popup`: side panel DOM wiring, runtime client, canvas renderer, asset loading, homestead interaction, and simulation.
- `src/assets`: local bundled pixel assets.
- `scripts`: packaging and asset workflow helpers.
- `workflow`: source files and notes for diagrams and sprite-sheet extraction.

## Commands

- `npm run typecheck`: TypeScript only.
- `npm test`: unit tests.
- `npm run build`: typecheck and build extension into `dist/`.
- `npm run package`: build release zip.
- `npm run assets:verify`: verify pixel asset contracts.

## Documentation Map

- `docs/README.md`: documentation entry point.
- `docs/ARCHITECTURE.md`: runtime and module boundaries.
- `docs/DEVELOPMENT.md`: setup, commands, loading, tests, release flow.
- `docs/DATA_AND_MESSAGES.md`: storage, state, and runtime messages.
- `docs/DESIGN.md`: product and visual design contract.
- `docs/MANUAL_TESTING.md`: manual Chrome QA checklist.
- `MEMORY.md`: durable repo decisions.
- `SESSION.md`: latest handoff notes.
- `ERRORS.md`: repeated setup or debugging traps.
