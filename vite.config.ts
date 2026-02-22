import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { fileURLToPath } from "node:url";
import manifest from "./src/manifest";

const homesteadHtmlEntryFilePath = fileURLToPath(new URL("./src/homestead/homestead.html", import.meta.url));

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        homesteadPage: homesteadHtmlEntryFilePath
      }
    }
  }
});
