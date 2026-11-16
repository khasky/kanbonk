// Builds the shared app as a browser extension into dist-extension/.
// Load it via chrome://extensions → "Load unpacked". `--watch` rebuilds on every change (then press reload in chrome://extensions).
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { build } from "vite";

const outDir = "dist-extension";
const copyExtensionFiles = {
  name: "listva-extension-files",
  closeBundle() {
    cpSync("extension", outDir, { recursive: true });
    mkdirSync(`${outDir}/icons`, { recursive: true });
    copyFileSync("src-tauri/icons/32x32.png", `${outDir}/icons/32.png`);
    copyFileSync("src-tauri/icons/128x128.png", `${outDir}/icons/128.png`);
    console.log(`Extension ready in ${outDir}/`);
  },
};

await build({
  base: "./",
  plugins: [copyExtensionFiles],
  build: { outDir, emptyOutDir: true, watch: process.argv.includes("--watch") ? {} : null },
});
