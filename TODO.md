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
- [ ] Poll background every 500ms

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

---

# V3 – Garden System

- [ ] Define grid size + tile size
- [ ] Implement tile data structure
- [ ] Render tile grid
- [ ] Implement grid snap placement
- [ ] Add object layer
- [ ] Implement collision grid
- [ ] Add duck wandering logic
- [ ] Save/load garden state

---

# Future Enhancements

- [ ] Add Chrome notifications
- [ ] Add focus streak tracking
- [ ] Add export/import save
- [ ] Add New Tab garden mode
- [ ] Add cosmetic unlock system
