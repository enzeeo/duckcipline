# Duckcipline – TODO

# V1 – Basic Timer Extension

## Setup

- [ ] Initialize Vite + TypeScript project
- [ ] Install CRXJS plugin
- [ ] Configure Manifest V3
- [ ] Add storage permission
- [ ] Configure background service worker

---

## Core Timer Logic

- [ ] Define TimerState interface
- [ ] Implement startTimer(durationMs)
- [ ] Implement pauseTimer()
- [ ] Implement resetTimer()
- [ ] Implement getRemainingTime()
- [ ] Ensure timestamp-based accuracy

---

## Background Service Worker

- [ ] Implement message listener
- [ ] Handle START message
- [ ] Handle PAUSE message
- [ ] Handle RESET message
- [ ] Handle GET_STATE message
- [ ] Store state in chrome.storage.session

---

## Popup UI

- [ ] Create popup layout
- [ ] Add preset duration buttons (25 / 50)
- [ ] Add custom duration input
- [ ] Add Start button
- [ ] Add Pause button
- [ ] Add Reset button
- [ ] Display countdown
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

- [ ] Track completed sessions
- [ ] Define Duck interface
- [ ] Add duck inventory
- [ ] Add simple hatch animation
- [ ] Persist duck data locally

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
