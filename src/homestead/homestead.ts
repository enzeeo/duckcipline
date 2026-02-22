const TIMER_HTML_PATH = "src/timer/timer.html";

function getRequiredButtonElement(elementId: string): HTMLButtonElement {
  const element = document.getElementById(elementId);

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Required button element not found: ${elementId}`);
  }

  return element;
}

function navigateToTimerView(): void {
  window.location.href = chrome.runtime.getURL(TIMER_HTML_PATH);
}

const openTimerButtonElement = getRequiredButtonElement("openTimerButton");

openTimerButtonElement.addEventListener("click", () => {
  navigateToTimerView();
});
