import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Duckcipline",
  description: "Privacy-first focus timer for Chrome. Runs locally and resets when Chrome closes.",
  version: "0.1.0",
  icons: {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },
  action: {
    default_title: "Duckcipline Focus Timer",
    default_icon: {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },
  side_panel: {
    default_path: "src/popup/popup.html"
  },
  background: {
    service_worker: "src/background/background.ts",
    type: "module"
  },
  permissions: ["storage", "sidePanel"]
});
