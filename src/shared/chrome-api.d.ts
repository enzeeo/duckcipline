interface ChromeEvent<CallbackType extends (...argumentsList: unknown[]) => unknown> {
  addListener(callback: CallbackType): void;
}

interface ChromeTab {
  windowId?: number;
}

interface ChromeMessageSender {}

interface ChromeRuntimeApi {
  onInstalled: ChromeEvent<() => void | Promise<void>>;
  onStartup: ChromeEvent<() => void | Promise<void>>;
  onMessage: ChromeEvent<
    (
      message: unknown,
      sender: ChromeMessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean | void
  >;
  sendMessage(message: unknown): Promise<unknown>;
}

interface ChromeActionApi {
  onClicked: ChromeEvent<(tab?: ChromeTab) => void>;
}

interface ChromeStorageSessionApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeStorageApi {
  session: ChromeStorageSessionApi;
}

interface ChromeSidePanelApi {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  open(options: { windowId: number }): Promise<void>;
}

interface ChromeNamespace {
  runtime: ChromeRuntimeApi;
  action: ChromeActionApi;
  storage: ChromeStorageApi;
  sidePanel?: ChromeSidePanelApi;
}

declare const chrome: ChromeNamespace;
