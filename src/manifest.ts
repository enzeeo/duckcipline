import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Duckcipline",
  description: "Privacy-first focus timer for Chrome. Runs locally and resets when Chrome closes.",
  version: "0.1.0",
  action: {
    default_title: "Duckcipline Focus Timer"
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
