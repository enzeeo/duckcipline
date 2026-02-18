const TIMER_STATE_STORAGE_KEY = "timerState";
const DEFAULT_DURATION_SECONDS = 25 * 60;
const MILLISECONDS_PER_SECOND = 1000;

async function configureSidePanelBehavior() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
    return;
  }

  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

configureSidePanelBehavior().catch((error) => {
  console.error("Failed to configure side panel behavior on service worker load.", error);
});

async function openSidePanelForTab(tab) {
  if (!chrome.sidePanel || !chrome.sidePanel.open) {
    return;
  }

  if (!tab || !Number.isInteger(tab.windowId)) {
    return;
  }

  await chrome.sidePanel.open({
    windowId: tab.windowId
  });
}

function createDefaultTimerState() {
  return {
    isRunning: false,
    configuredDurationSeconds: DEFAULT_DURATION_SECONDS,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: DEFAULT_DURATION_SECONDS
  };
}

async function readTimerStateFromSessionStorage() {
  const storageValues = await chrome.storage.session.get(TIMER_STATE_STORAGE_KEY);
  const storedTimerState = storageValues[TIMER_STATE_STORAGE_KEY];

  if (!storedTimerState) {
    return createDefaultTimerState();
  }

  return {
    ...createDefaultTimerState(),
    ...storedTimerState
  };
}

async function writeTimerStateToSessionStorage(timerState) {
  await chrome.storage.session.set({
    [TIMER_STATE_STORAGE_KEY]: timerState
  });
}

function calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds) {
  if (!timerState.startedAtTimestampMilliseconds) {
    return timerState.configuredDurationSeconds;
  }

  const elapsedMilliseconds = nowTimestampMilliseconds - timerState.startedAtTimestampMilliseconds;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND);
  const remainingSeconds = timerState.configuredDurationSeconds - elapsedSeconds;

  if (remainingSeconds < 0) {
    return 0;
  }

  return remainingSeconds;
}

async function getCanonicalTimerState() {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await readTimerStateFromSessionStorage();

  if (!timerState.isRunning) {
    return timerState;
  }

  const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

  if (remainingSeconds > 0) {
    return timerState;
  }

  const completedTimerState = {
    ...timerState,
    isRunning: false,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: 0
  };

  await writeTimerStateToSessionStorage(completedTimerState);
  return completedTimerState;
}

function parseDurationSeconds(durationSecondsFromMessage) {
  if (!Number.isFinite(durationSecondsFromMessage)) {
    return DEFAULT_DURATION_SECONDS;
  }

  if (durationSecondsFromMessage < 1) {
    return DEFAULT_DURATION_SECONDS;
  }

  return Math.floor(durationSecondsFromMessage);
}

async function startTimer(durationSecondsFromMessage) {
  const durationSeconds = parseDurationSeconds(durationSecondsFromMessage);
  const startedTimerState = {
    isRunning: true,
    configuredDurationSeconds: durationSeconds,
    startedAtTimestampMilliseconds: Date.now(),
    remainingSecondsWhenNotRunning: durationSeconds
  };

  await writeTimerStateToSessionStorage(startedTimerState);

  return {
    isRunning: true,
    remainingSeconds: durationSeconds
  };
}

async function stopTimer() {
  const timerState = await readTimerStateFromSessionStorage();
  const stoppedTimerState = {
    ...timerState,
    isRunning: false,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: timerState.configuredDurationSeconds
  };

  await writeTimerStateToSessionStorage(stoppedTimerState);

  return {
    isRunning: false,
    remainingSeconds: stoppedTimerState.remainingSecondsWhenNotRunning
  };
}

async function getTimerStateMessageResponse() {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await getCanonicalTimerState();

  if (!timerState.isRunning) {
    return {
      isRunning: false,
      remainingSeconds: timerState.remainingSecondsWhenNotRunning
    };
  }

  const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

  if (remainingSeconds < 1) {
    const completedTimerState = {
      ...timerState,
      isRunning: false,
      startedAtTimestampMilliseconds: null,
      remainingSecondsWhenNotRunning: 0
    };

    await writeTimerStateToSessionStorage(completedTimerState);

    return {
      isRunning: false,
      remainingSeconds: 0
    };
  }

  return {
    isRunning: true,
    remainingSeconds
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
  const timerState = await readTimerStateFromSessionStorage();
  await writeTimerStateToSessionStorage(timerState);
});

chrome.runtime.onStartup.addListener(async () => {
  await configureSidePanelBehavior();
});

chrome.action.onClicked.addListener((tab) => {
  openSidePanelForTab(tab).catch((error) => {
    console.error("Failed to open side panel from toolbar click.", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    sendResponse({ error: "Invalid message." });
    return;
  }

  const handleMessageAsync = async () => {
    if (message.type === "startTimer") {
      return startTimer(message.durationSeconds);
    }

    if (message.type === "stopTimer") {
      return stopTimer();
    }

    if (message.type === "getTimerState") {
      return getTimerStateMessageResponse();
    }

    return { error: "Unknown message type." };
  };

  handleMessageAsync()
    .then((messageResponse) => {
      sendResponse(messageResponse);
    })
    .catch((error) => {
      sendResponse({ error: error.message || "Unexpected error." });
    });

  return true;
});
