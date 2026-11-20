// Browser load test: imports a generated 5000-card board and measures how the UI responds, on desktop and with
// mobile-like CPU throttling. Fails (exit 1) when a measurement exceeds its budget.
//
// Usage: pnpm build && pnpm preview --port 4174 --strictPort   (in another terminal)
//        node scripts/load-test.mjs [url=http://127.0.0.1:4174/] [cards=5000]
// Needs playwright-core and a Chromium-based browser, which are not project dependencies:
//   PLAYWRIGHT_CORE=<path to playwright-core>  CHROME_PATH=<path to chrome/chromium/edge executable>
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bigBoard } from "./generate-big-board.mjs";

const require = createRequire(import.meta.url);
const [url = "http://127.0.0.1:4174/", cardCount = "5000"] = process.argv.slice(2);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const chromeCandidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/chromium", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const executablePath = chromeCandidates.find((path) => path && existsSync(path));

/** Budgets in ms. "mobile" runs with 4x CPU throttling and a phone viewport. */
const budgets = {
  desktop: { importAndRender: 8000, typeFrame: 100, longestTask: 200, filterResult: 500, globalSearch: 150, openCard: 300, scrollFrame: 50 },
  mobile: { importAndRender: 20000, typeFrame: 250, longestTask: 500, filterResult: 1500, globalSearch: 500, openCard: 800, scrollFrame: 120 },
};

const file = join(mkdtempSync(join(tmpdir(), "kanbonk-load-")), "big-board.json");
writeFileSync(file, JSON.stringify(bigBoard(Number(cardCount), 50)));

async function run(profile) {
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext(profile === "mobile" ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(url);
  await page.waitForSelector(".topbar-more summary");
  if (profile === "mobile") await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const measured = {};
  await page.locator(".topbar-more summary").click();
  await page.getByRole("button", { name: "Import from Trello" }).click();
  await page.locator('.import-dialog input[type=file]').first().setInputFiles(file);
  let started = Date.now();
  await page.locator(".import-dialog .primary-button").click();
  await page.waitForSelector(".list-column .card-tile", { timeout: 120_000 });
  measured.importAndRender = Date.now() - started;
  await page.locator(".import-dialog").getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(500);
  measured.tilesInDom = await page.locator(".card-tile").count();

  // Time from a keystroke in the board search to the next painted frame (input responsiveness),
  // and the longest main-thread task while typing (blocks the following keystrokes).
  const search = page.getByLabel("Search cards on this board");
  await search.click();
  await page.evaluate(() => { window.longestTask = 0; new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.longestTask = Math.max(window.longestTask, entry.duration); }).observe({ type: "longtask" }); });
  measured.typeFrame = 0;
  for (const letter of "#4321") {
    const ms = await search.evaluate((input, letter) => new Promise((resolve) => {
      const started = performance.now();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, input.value + letter);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - started)));
    }), letter);
    measured.typeFrame = Math.max(measured.typeFrame, Math.round(ms));
  }
  started = Date.now();
  const shownCards = () => [...document.querySelectorAll(".card-stack[data-count]")].reduce((sum, stack) => sum + Number(stack.dataset.count), 0);
  await page.waitForFunction(`(${shownCards})() === 1`, null, { timeout: 30_000 });
  measured.filterResult = Date.now() - started;
  measured.longestTask = Math.round(await page.evaluate(() => window.longestTask));
  measured.matches = await page.evaluate(`(${shownCards})()`);
  await search.fill("");
  await page.waitForFunction((count) => document.querySelectorAll(".card-tile").length >= count, measured.tilesInDom, { timeout: 30_000 });

  // Search across all boards from the top bar ("#" would be the label operator, so search the number alone): keystroke to the matching result painted.
  measured.globalSearch = await page.getByLabel("Search cards", { exact: true }).evaluate((input) => new Promise((resolve) => {
    const started = performance.now();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "4321");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const check = () => [...document.querySelectorAll(".search-results button")].some((button) => button.textContent.includes("#4321")) ? requestAnimationFrame(() => setTimeout(() => resolve(Math.round(performance.now() - started)))) : performance.now() - started > 30_000 ? resolve(Infinity) : requestAnimationFrame(check);
    check();
  }));
  await page.getByLabel("Search cards", { exact: true }).fill("");

  // Click to the first frame with the card dialog painted.
  measured.openCard = await page.evaluate(() => new Promise((resolve) => {
    const started = performance.now();
    document.querySelectorAll(".card-tile")[3].click();
    const check = () => document.querySelector(".card-dialog") ? requestAnimationFrame(() => setTimeout(() => resolve(Math.round(performance.now() - started)))) : requestAnimationFrame(check);
    check();
  }));
  await page.keyboard.press("Escape");
  await page.locator(".card-dialog").waitFor({ state: "detached" });

  // Longest frame while scrolling the canvas sideways and a list down.
  measured.scrollFrame = Math.round(await page.evaluate(async () => {
    const canvas = document.querySelector(".board-canvas");
    const stack = document.querySelector(".card-stack");
    let worst = 0;
    let last = performance.now();
    for (let step = 0; step < 40; step++) {
      canvas.scrollLeft += 120;
      stack.scrollTop += 200;
      stack.closest(".list-column")?.scrollBy?.(0, 200);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      worst = Math.max(worst, now - last);
      last = now;
    }
    return worst;
  }));
  await browser.close();
  const failures = Object.entries(budgets[profile]).filter(([key, budget]) => measured[key] > budget).map(([key, budget]) => `${key} ${measured[key]} ms > ${budget} ms`);
  return { profile, measured, failures: [...failures, ...errors.map((error) => `page error: ${error}`)] };
}

let failed = false;
for (const profile of ["desktop", "mobile"]) {
  const result = await run(profile);
  console.log(`${profile}: ${JSON.stringify(result.measured)}`);
  for (const failure of result.failures) { console.log(`  FAIL ${failure}`); failed = true; }
}
console.log(failed ? "Load test failed." : "Load test passed.");
process.exit(failed ? 1 : 0);
