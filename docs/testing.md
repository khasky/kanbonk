# Testing

## Automated tests

```sh
pnpm test         # Vitest, all files in tests/
pnpm build    # TypeScript type check and production build
ppnpm test:load  # browser load test, see Performance below
```

Vitest runs two projects, configured in `vitest.config.ts`: `unit` runs every file in parallel, then `perf` runs `heavyBoard.test.ts` alone. Time budgets measure wall-clock time, and measured while other test files compete for the CPU they would report the machine's load instead of the code's speed.

| Test file | Covers |
|---|---|
| `model.test.ts` | IDs, revisions, search, list operations, copying, dependencies |
| `cardTransfer.test.ts`, `checklist.test.ts` | Moving and copying cards, templates, checklist operations |
| `sync.test.ts` | Merging states, fast-forward, conflicts, conflict resolution |
| `lanSync.test.ts`, `lanServer.test.ts` | The sync protocol, chunking, files, encryption, trusted devices; the LAN relay |
| `trash.test.ts` | Soft delete, restore chains, purge, tombstone sync |
| `zones.test.ts` | Zones: grouping, contiguity, list and zone drag and drop, removal, sync, backup validation |
| `newModules.test.ts` | Router, calendar layout, Trello JSON/CSV round trip, dedupe, HTML to Markdown, file bundles, snapshot retention |
| `backup.test.ts` | Backup parts, manifests, hashes, restore checks |
| `importTrello.test.ts`, `trelloBackground.test.ts`, `trelloBridge.test.ts`, `trelloExtension.test.ts`, `trelloExport.test.ts` | Trello JSON and ZIP import, backgrounds, the import extension: board export in ZIP parts and attachment relay |
| `automation.test.ts`, `reminders.test.ts`, `repeatingDue.test.ts` | Board rules, reminders, repeating due dates |
| `cardFeatures.test.ts`, `calendarDrag.test.ts` | Clone, sub-cards and their trash chains, readable text on colored cards; calendar move and resize |
| `boardDoc.test.ts`, `ai.test.ts` | Board document links and summary; AI requests for Claude, OpenAI and compatible servers (network stubbed), citation checks |
| `mcpTools.test.ts` | MCP tools: building boards, cards, sub-cards, checklists, dependencies, trash and restore, input errors |
| `heavyBoard.test.ts` | Time budgets for import, export, merge, search, filter, edit, trash and dedupe on a 5000-card board; round trip of a real heavy Trello export when `KANBONK_HEAVY_EXPORT` points to one |
| `inbox.test.ts`, `links.test.ts`, `activity.test.ts`, `attachments.test.ts`, `localAuthor.test.ts`, `MarkdownText.test.tsx` | Inbox, card links, activity feed, attachments, comment authorship, Markdown rendering |

`tests/trello-board.json` and `tests/trello-attachments.zip` are synthetic fixtures.

Test data is synthetic. Never commit real board exports.

## Performance

`scripts/load-test.mjs` generates a board with 5000 cards, imports it through the UI in Chromium and measures how the interface responds, once on a desktop viewport and once on a phone viewport with 4x CPU throttling. It exits with an error when a measurement is over budget.

```sh
pnpm build && pnpm preview --port 4174 --strictPort   # in another terminal
ppnpm test:load      # needs playwright-core and Chrome/Edge; set PLAYWRIGHT_CORE and CHROME_PATH if they are not found
```

| Measurement (ms) | Desktop budget | Desktop | Phone (4x CPU) budget | Phone (4x CPU) |
|---|---|---|---|---|
| Import and first render | 8000 | 493 | 20000 | 2955 |
| Keystroke to painted frame in board search | 100 | 23 | 250 | 81 |
| Longest main-thread task while typing | 200 | 0 | 500 | 0 |
| Board search result shown | 500 | 3 | 1500 | 35 |
| Search across all boards | 150 | 30 | 500 | 126 |
| Open a card | 300 | 42 | 800 | 276 |
| Scroll frame | 50 | 34 | 120 | 84 |

Card tiles in the DOM: 197 on desktop and 77 on the phone, out of 5000.

## Testing sync on one computer

Every browser origin and profile is a separate device for Kanbonk, so two devices can run on one machine:

1. `pnpm build` and `node server.mjs 127.0.0.1 4174`.
2. Open `http://127.0.0.1:4174` in two different browser profiles (or one normal and one private window).
3. Connect both through **⋯ → Sync** and try edits, offline edits on both sides (conflicts) and attachments.

The desktop app, the extension and an Android emulator (which reaches the host as `10.0.2.2`) can join the same room.

## What has been verified

Last verification: November 2026.

| Area | Result |
|---|---|
| Unit tests | 200 of 201 pass, 1 skipped; `pnpm build` passes |
| Card features (Playwright, Chromium) | Clone below the original, sub-cards and parent hint, Markdown comments, share (QR, link, JSON, PNG, print layout), full-card color with readable text, custom label and board colors, assignee button only with a team |
| Calendar editing (Chromium) | Drag a card to another day, resize its due date, × with confirmation |
| Offline queue (Chromium, two devices) | Relay stopped, edits on one device show **Offline · N queued**, relay restarted, both devices reconnect on their own and the change arrives |
| Board document and AI (Chromium, Claude API mocked) | Card links and backlinks, inbox triage creates a card with its source quote, document rewrite marks an unknown citation; requests use `claude-opus-5-5` with fallbacks |
| MCP server | A stdio MCP client lists 27 tools and runs them; the agent pairs with the web app over the relay after the trust prompt, an agent-made board appears in the app and a rename in the app reaches the agent |
| Heavy Trello export (14.6 MB, 1945 cards, 48 lists, 617 checklists) | Unit round trip keeps cards, lists, checklists and comments; through the UI: import and render in 679 ms, 1944 open cards on the board, JSON export with 1945 cards and 617 checklists, CSV export 1.5 MB, no page errors |
| Web UI (Playwright, Chromium) | Workspaces → boards → lists → cards; `/w`, `/b`, `/c` addresses; card modal over the board and Esc back; visual Markdown editor saves headings and bold; drag and drop of cards within and between lists and of lists; dependency warning on delete; trash filter and restore; calendar week/month/year with a multi-day card; card by direct link as a page; rename in one tab appears in another; not-found pages |
| Zones (Chromium) | Create a zone from the list menu, add lists, drag a list into a zone, drag a whole zone, persistence after reload, zone removal keeps lists |
| Extension (Chromium, Edge 157) | Loads, hash routes survive reload, Wi-Fi sync with the web app |
| Windows app ↔ Chrome | LAN sync of boards, lists, cards and a PNG attachment (SHA-256 identical), data kept after restart |
| Android 15 emulator ↔ desktop browser | Trust prompt, data and files both ways, offline edits on both sides produce a conflict, choosing a version converges both devices, reconnect without a new trust prompt |
| File bundles | Saved from the Android app through the system dialog, opened in the desktop browser (data and 3 files, no conflicts); a device's own bundle is rejected |
| Internet P2P | Two isolated browser profiles on one machine connect and sync; invitations contain public (`srflx`) candidates from STUN |
| Trello import | Several real board exports, including one with 397 cards and 431 attachments; all attachment hashes matched the originals |
| Full backup | A real database with 456 files: 38 ZIP parts restored at once, hashes matched, data survived reload |

## Not verified yet

- AI with **real provider keys** (Anthropic, OpenAI, Gemini, compatible servers): requests were tested against mocked APIs only.
- Performance on **real phones and tablets**; the load test emulates a phone with CPU throttling.
- Sync between **physical** phones and computers on a real Wi-Fi network.
- Sending a bundle over **Bluetooth**.
- **Internet P2P across different networks** and NAT types. Without a TURN relay, peers behind symmetric NATs may not connect.
- **Google Chrome** with the extension (Chrome blocks command-line extension loading; load it manually).
- **iOS**, **macOS** and **Linux** builds.
- Installing the Windows installers; release signing of any package.
- Trello CSV against a live Trello export (requires Trello Premium).

## Manual device checklist

Run these before a release, and report results in an issue.

1. **Wi-Fi.** On a computer run `node server.mjs 0.0.0.0 4174`; on a phone open `http://<computer-ip>:4174`. On the computer: **⋯ → Sync → Wi-Fi / local network**, **Create code**, **Connect with code**; enter the same address and code on the phone. Expect a trust prompt on both devices. After approving, a card created on one device appears on the other. Edit the same card on both devices while disconnected, reconnect: a version choice must appear, and after choosing, both devices show the same card.
2. **Reconnect.** Turn the phone's Wi-Fi off for a minute, turn it on and connect with the same code: changes catch up without a new trust prompt.
3. **Internet P2P.** Two computers on different networks, transport **Internet: direct P2P connection (WebRTC)**. Exchange the invitation and the reply through a messenger. Expect a connection; with symmetric NAT on both sides it may fail (known limitation).
4. **Bluetooth.** Transport **File: Bluetooth / USB / messenger**, **Send package** on the phone (browser: share sheet → Bluetooth; Android app: save the file, then Files → Share → Bluetooth), receive on the computer and open it with **Open received package**. Expect the data and attachments.
5. **Android app.** Install the APK (`adb install -r app-universal-debug.apk`) and repeat step 1 with the app instead of the phone browser.
6. **Extension in Chrome.** Load `dist-extension/` unpacked, create a workspace, reload the tab, sync with the web app over Wi-Fi.

## Known limitations

- The visual Markdown editor uses `document.execCommand`, which is deprecated but supported by all current browsers.
- Conflicts are detected per entity, not per field (see [sync.md](sync.md#merge-and-conflicts)).
- Data at rest in IndexedDB is not encrypted.
