# Duckcipline Architecture

## Runtime

Duckcipline is a Manifest V3 Chrome extension built with Vite, TypeScript, and `@crxjs/vite-plugin`.

```text
Chrome side panel UI
  src/popup/popup.html
  src/popup/popup.ts
        |
        | chrome.runtime.sendMessage
        v
Chrome service worker
  src/background/background.ts
  src/background/backgroundApplication.ts
        |
        | reads/writes through BackgroundStateStore
        v
Chrome extension storage
  chrome.storage.session: timerState
  chrome.storage.local: gameState
```

The built extension is loaded from `dist/` after `npm run build`.

## State Ownership

- Background is canonical for timer state and game state.
- Popup never owns canonical state.
- Popup can keep temporary UI state only, such as selected DOM controls, pointer state, camera interaction, and animation state.
- Timer correctness must come from timestamps, not from trusting an interval tick.

## Main Modules

```text
src/manifest.ts
  Manifest V3 definition. Current permissions: storage, sidePanel.

src/background/background.ts
  Chrome service worker entry point. Wires Chrome runtime messages to the background app.

src/background/backgroundApplication.ts
  Application orchestration. Handles timer and game messages, synchronizes game progress with timer state, and returns typed responses.

src/background/stateStore.ts
  Storage adapter boundary. Chrome storage in production, memory storage in tests.

src/timer/timerState.ts
  Pure timestamp timer math. No Chrome APIs.

src/shared/messages.ts
  Message constants, request types, validation helpers, and response parsing.

src/shared/types.ts
  Shared state and domain interfaces.

src/shared/gameLogic.ts
  Pure project, duck, homestead, and migration state transitions.

src/popup/popup.ts
  Side panel entry point. Owns DOM wiring, sends runtime messages, and renders current state.

src/popup/popupRuntimeClient.ts
  Typed popup-side Chrome runtime client.

src/popup/canvasRenderer.ts
  Homestead canvas rendering.

src/popup/assetLoader.ts
  Runtime asset loading with local extension URLs.

src/popup/homesteadInteraction.ts
  Homestead selection, placement, camera, pointer, follow, and snapshot behavior.

src/popup/homesteadSimulation.ts
  Popup-side duck movement simulation state.
```

## Boundaries

- Chrome APIs belong in adapters and entry points.
- Timer math belongs in `src/timer`.
- Project, duck, and homestead state transitions belong in `src/shared`.
- DOM and canvas code belongs in `src/popup`.
- Background orchestration belongs in `src/background/backgroundApplication.ts`.

When adding behavior, prefer pure logic first, then wire it through the background and popup adapters.

## Permissions

Keep permissions minimal. Current manifest permissions are:

```text
storage
sidePanel
```

Do not add `tabs`, `host_permissions`, `activeTab`, or `scripting` unless the feature explicitly needs them.

