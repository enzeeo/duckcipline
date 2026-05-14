import { createBackgroundApplication } from "./backgroundApplication.js";
import { createChromeStateStore } from "./stateStore.js";
import {
  isExtensionRequestMessage
} from "../shared/messages.js";
import type { ErrorResponse } from "../shared/types.js";

const backgroundApplication = createBackgroundApplication({
  clock: {
    now: () => Date.now()
  },
  stateStore: createChromeStateStore(chrome)
});

function createErrorResponse(message: string): ErrorResponse {
  return { error: message };
}

async function configureSidePanelBehavior(): Promise<void> {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
    return;
  }

  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

async function openSidePanelForTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!chrome.sidePanel || !chrome.sidePanel.open) {
    return;
  }

  const windowIdentifier = tab?.windowId;

  if (typeof windowIdentifier !== "number" || !Number.isInteger(windowIdentifier)) {
    return;
  }

  await chrome.sidePanel.open({
    windowId: windowIdentifier
  });
}

async function stopRunningTimerIfNoNormalWindowsRemain(): Promise<void> {
  const normalBrowserWindows = await chrome.windows.getAll({
    windowTypes: ["normal"]
  });

  if (normalBrowserWindows.length > 0) {
    return;
  }

  await backgroundApplication.stopRunningTimerIfActive(Date.now());
}

configureSidePanelBehavior().catch((error: unknown) => {
  console.error("Failed to configure side panel behavior on service worker load.", error);
});

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
  await backgroundApplication.initializeState();
});

chrome.runtime.onStartup.addListener(async () => {
  await configureSidePanelBehavior();
});

chrome.windows.onRemoved.addListener(() => {
  stopRunningTimerIfNoNormalWindowsRemain().catch((error: unknown) => {
    console.error("Failed to stop timer after closing Chrome windows.", error);
  });
});

chrome.action.onClicked.addListener((tab) => {
  openSidePanelForTab(tab).catch((error: unknown) => {
    console.error("Failed to open side panel from toolbar click.", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionRequestMessage(message)) {
    sendResponse(createErrorResponse("Invalid message."));
    return;
  }

  backgroundApplication.handleMessage(message)
    .then((messageResponse) => {
      sendResponse(messageResponse);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        sendResponse(createErrorResponse(error.message));
        return;
      }

      sendResponse(createErrorResponse("Unexpected error."));
    });

  return true;
});
