# Duckcipline – TODO

# V1 – Basic Timer Extension

## Setup

- [x] Initialize Vite + TypeScript project
- [x] Install CRXJS plugin
- [x] Configure Manifest V3
- [x] Add storage permission
- [x] Configure background service worker

---

## Core Timer Logic

- [x] Define TimerState interface
- [x] Implement startTimer(durationMs)
- [x] Implement pauseTimer()
- [x] Implement resetTimer()
- [x] Implement getRemainingTime()
- [x] Ensure timestamp-based accuracy

---

## Background Service Worker

- [x] Implement message listener
- [x] Handle START message
- [x] Handle PAUSE message
- [x] Handle RESET message
- [x] Handle GET_STATE message
- [x] Store state in chrome.storage.session

---

## Popup UI

- [x] Create popup layout
- [x] Add preset duration buttons (25 / 50)
- [x] Add custom duration input
- [x] Add Start button
- [x] Add Pause button
- [x] Add Reset button
- [x] Display countdown
- [x] Poll background every 1000ms

---

## Testing

- [ ] Timer continues after popup closes
- [ ] Timer resets if Chrome closes
- [ ] Pause preserves remaining time
- [ ] Reset clears state
- [ ] Edge case: Start while running
- [ ] Edge case: Pause while paused

---

# V2 – Duck Rewards

- [x] Track completed sessions
- [x] Define Duck interface
- [x] Add duck inventory
- [ ] Add simple hatch animation
- [x] Persist duck data locally

## Reward Workflow 

- [x] Reward progress increases continuously while timer runs
- [x] Reward progress is timestamp-based (accurate after panel close/reopen)
- [x] Prevent reward selection changes while timer is running
- [x] Reset timer does not reset reward progress
- [x] Show selected reward text above timer
- [x] Show separate reward time-left text below timer
- [x] Show claim button when reward threshold is reached
- [x] Claim creates a new duck object in local storage
- [x] After claim, selected reward is cleared and must be selected again

---

# V3 – Garden System

## V3A – Foundation (Implementation)

- [ ] Define garden data models (GardenState, TileDefinition, DuckEntity, DuckMovementRuntimeState)
- [ ] Define tile indexing helpers (x/y to flat array index)
- [ ] Add garden constants (tile size, map width, map height, layer empty value)
- [ ] Build ground layer array rendering
- [ ] Build object layer array rendering
- [ ] Build foreground layer rendering (front occlusion layer)
- [ ] Implement render order (ground -> object -> ducks -> foreground)
- [ ] Add collision layer generation and collision lookup helpers
- [ ] Add garden storage read/write in chrome.storage.local
- [ ] Add garden state bootstrap defaults

## V3B – Ducks In Garden (Implementation)

- [ ] Add duck spawn placement validation (bounds + collision)
- [ ] Add duck runtime movement state tracking (from/to tile + progress)
- [ ] Implement timestamp-based duck interpolation rendering
- [ ] Implement simple duck wandering behavior (idle/walk)
- [ ] Persist duck grid positions after movement completion
- [ ] Prevent duck movement into blocked collision tiles

## V3C – Garden Editing (Implementation)

- [ ] Add edit mode toggle in UI
- [ ] Add tile brush selection (ground/object/foreground)
- [ ] Implement grid-snap tile placement
- [ ] Implement tile removal tool
- [ ] Recompute collision when blocking objects are placed/removed
- [ ] Save edits to local storage

## V3D – Pixel Art Asset Pipeline (Implementation)

- [ ] Create sprite sheets for ground, objects, foreground, and ducks
- [ ] Define sprite metadata mapping (tile id -> source x/y/width/height)
- [ ] Define duck animation metadata (idle/walk frame lists + frames per second)
- [ ] Add image preload/ready flow before first garden render

## V3E – Testing (Implementation)

- [ ] Verify draw order hides ducks behind foreground objects
- [ ] Verify collision blocks ducks and placement
- [ ] Verify duck movement is smooth (no visible snapping between tiles)
- [ ] Verify full save/load round-trip for garden + ducks
- [ ] Verify behavior after side panel close/reopen

## V3 – Needs Definition (Fleshing Out)

- [ ] Confirm garden map size for v1 (example 40x30 or other)
- [ ] Confirm camera behavior (fixed view or scrollable)
- [ ] Confirm v1 tile catalog ids and blocking rules
- [ ] Confirm duck movement speed target
- [ ] Confirm duck behavior scope for v1 (random walk only or additional rules)
- [ ] Confirm required duck animations and frames per second
- [ ] Confirm edit mode scope for v1 (which layers are editable)
- [ ] Confirm whether undo/redo is needed in v1
- [ ] Confirm exact persisted fields for garden save format
- [ ] Confirm asset folder/file naming conventions

---

# Future Enhancements

- [ ] Add Chrome notifications
- [ ] Add focus streak tracking
- [ ] Add export/import save
- [ ] Add New Tab garden mode
- [ ] Add cosmetic unlock system
