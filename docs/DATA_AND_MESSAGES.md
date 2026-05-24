# Data And Messages

## Storage

Production storage is isolated behind `src/background/stateStore.ts`.

```text
chrome.storage.session
  timerState
    Short-lived focus timer state.
    Resets when Chrome closes.

chrome.storage.local
  gameState
    Long-lived project, duck, seed, homestead, and camera state.

  duckRewardsState
    Legacy key read for migration only.
```

Tests use `createMemoryStateStore()` instead of Chrome storage.

## Timer State

`TimerState` lives in `src/shared/types.ts`.

Important fields:

- `isRunning`
- `hasStartedAtLeastOnce`
- `configuredDurationSeconds`
- `startedAtTimestampMilliseconds`
- `remainingSecondsWhenNotRunning`

Running timers calculate remaining seconds from `Date.now() - startedAtTimestampMilliseconds`. Paused timers preserve `remainingSecondsWhenNotRunning`.

## Game State

`GameState` lives in `src/shared/types.ts`.

Current game state includes:

- active project selection
- project progress map
- completed focus session totals
- ducks
- seeds
- homestead camera

Project, duck, growth, placement, and migration rules should stay in `src/shared/gameLogic.ts` when they can be pure.

## Message Flow

Popup code sends `ExtensionRequestMessage` values from `src/shared/messages.ts`.

Timer messages:

```text
startTimer
stopTimer
pauseTimer
resetTimer
getTimerState
```

Game messages:

```text
getGameState
selectProject
claimActiveProject
renameDuck
feedDuck
placeDuck
moveDuck
updateDuckSimulationState
saveHomesteadCamera
```

Responses are typed as timer or game response objects, or `{ error: string }`.

## Adding A Message

1. Add the message constant and interface in `src/shared/messages.ts`.
2. Add or reuse response types in `src/shared/types.ts`.
3. Handle the message in `src/background/backgroundApplication.ts`.
4. Add pure state logic in `src/shared` if the behavior changes game or timer rules.
5. Add popup client wiring in `src/popup/popupRuntimeClient.ts` or the relevant popup module.
6. Add focused tests for validation, background behavior, and pure rules.

