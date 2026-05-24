# MEMORY.md

Durable repo memory for future agents. Keep compact and factual.

## Decisions

### 2026-05-24 - Keep Background As Canonical State Owner
- Decided: The Manifest V3 background service worker owns canonical timer and game state.
- Why: Popup UI can close or rerender; state must remain coherent while Chrome is open.
- Rejected: Popup-owned timer or game state.

### 2026-05-24 - Save Homestead Through One Canonical Message
- Decided: Homestead persistence uses one `saveHomesteadState` message carrying camera plus optional Duck simulation updates.
- Why: Full Homestead saves should persist camera and placed-Duck simulation together through the background canonical-state transaction path.
- Rejected: Split `saveHomesteadCamera` and `updateDuckSimulationState` runtime messages, or a storage adapter refactor for this change.

### 2026-05-24 - Keep Timer Timestamp-Based
- Decided: Timer correctness must be computed from timestamps in `src/timer/timerState.ts`.
- Why: `setInterval` can drift or stop when extension UI is closed.
- Rejected: Interval tick count as the source of truth.

### 2026-05-24 - Split Short-Lived Timer And Long-Lived Game Storage
- Decided: Store `timerState` in `chrome.storage.session` and `gameState` in `chrome.storage.local`.
- Why: Focus timers reset when Chrome closes, while duck and homestead progress persists locally.
- Rejected: Persisting timer state in local storage for V1 behavior.

### 2026-05-24 - Preserve Minimal Permissions
- Decided: Current manifest uses only `storage` and `sidePanel`.
- Why: Duckcipline is privacy-first and local-only.
- Rejected: Adding `tabs`, `host_permissions`, `activeTab`, or `scripting` without a concrete feature need.

### 2026-05-24 - Document Repo Contracts In Docs Folder
- Decided: Use `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, and `docs/DATA_AND_MESSAGES.md` as the main repo documentation map.
- Why: README stays concise while docs carry implementation details and handoff context.
- Rejected: Putting all operational documentation in README.
