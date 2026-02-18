const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const DEFAULT_DURATION_MINUTES = 25;

const timerDisplayElement = document.getElementById("timerDisplay");
const timerStatusElement = document.getElementById("timerStatus");
const durationMinutesInputElement = document.getElementById("durationMinutesInput");
const startButtonElement = document.getElementById("startButton");
const stopButtonElement = document.getElementById("stopButton");

function padTimeSegment(segmentValue) {
  return String(segmentValue).padStart(2, "0");
}

function formatAsHoursMinutesSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const minutes = Math.floor((totalSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return `${padTimeSegment(hours)}:${padTimeSegment(minutes)}:${padTimeSegment(seconds)}`;
}

function readDurationMinutesFromInput() {
  const parsedDurationMinutes = Number.parseInt(durationMinutesInputElement.value, 10);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes < 1) {
    return DEFAULT_DURATION_MINUTES;
  }

  return parsedDurationMinutes;
}

function updatePopupDisplay(timerState) {
  if (timerState.error) {
    timerStatusElement.textContent = "Error";
    return;
  }

  timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
  timerStatusElement.textContent = timerState.isRunning ? "Running" : "Stopped";
}

async function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshTimerDisplay() {
  const timerState = await sendRuntimeMessage({ type: "getTimerState" });
  updatePopupDisplay(timerState);
}

async function handleStartButtonClick() {
  const durationMinutes = readDurationMinutesFromInput();
  const durationSeconds = durationMinutes * SECONDS_PER_MINUTE;

  await sendRuntimeMessage({
    type: "startTimer",
    durationSeconds
  });

  await refreshTimerDisplay();
}

async function handleStopButtonClick() {
  await sendRuntimeMessage({ type: "stopTimer" });
  await refreshTimerDisplay();
}

startButtonElement.addEventListener("click", () => {
  handleStartButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

stopButtonElement.addEventListener("click", () => {
  handleStopButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

refreshTimerDisplay().catch(() => {
  timerStatusElement.textContent = "Error";
});

setInterval(() => {
  refreshTimerDisplay().catch(() => {
    timerStatusElement.textContent = "Error";
  });
}, UPDATE_INTERVAL_MILLISECONDS);
