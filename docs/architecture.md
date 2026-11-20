# Architecture

Kanbonk is a single React + TypeScript application. The same build runs as a web page, as a browser extension page and inside the Tauri WebView on desktop and mobile. There is no backend: each device owns a full copy of the user's data.

```
┌────────────────────────── shared app (src/) ───────────────────────────┐
│  React UI (App.tsx, pages.tsx)                                          │
│      │ setState(pure function)                                          │
│      ▼                                                                  │
│  Domain modules: model · trash · zones · calendar · dedupe · sync …     │
│      │                                                                  │
│      ▼                                                                  │
│  storage.ts (IndexedDB)   lanSync.ts / devices.ts (sync)   platform.ts │
└──────┬──────────────────────────────┬──────────────────────────┬────────┘
       │                              │                          │
   web page / extension page     Wi-Fi relay, WebRTC,      Tauri plugins (desktop,
   (browser IndexedDB)           file bundles, tabs        mobile) or browser APIs
```

## Design principles

- **Local-first.** The device's IndexedDB is the source of truth. Sync merges whole states between devices; nothing depends on a server.
- **Pure domain logic.** Every change is a pure function `AppState → AppState` in a domain module. React components call these functions inside `setState`, and the same functions run in tests.
- **Every change is versioned.** `recordRevision` stores a snapshot of the changed entity. Revisions power history, undo by restore and conflict detection during sync.
- **One codebase for all platforms.** Only [`src/platform.ts`](../src/platform.ts) knows which shell the app runs in.

## Source layout

| Module | Responsibility |
|---|---|
| `main.tsx`, `App.tsx` | Bootstrapping, the main component: top bar, sidebar, board canvas, dialogs, card modal |
| `pages.tsx` | Page components: home, workspace, trash, not-found, calendar, zone frame, delete and dedupe dialogs |
| `router.ts` | History API router: routes, links, modal-over-page cards |
| `platform.ts` | Platform detection, saving and sharing files, hash routing in the extension |
| `model.ts` | Types, short IDs, revisions, search, list and card operations, dependencies, copying |
| `trash.ts` | Soft delete, restore chains, purge, tombstones, the visible state |
| `zones.ts` | Grouping lists into zones, zone drag and drop |
| `calendar.ts` | Calendar ranges, card placement, lane layout for multi-day cards |
| `dedupe.ts` | Semantic duplicate detection and merging |
| `sync.ts` | Merging two states by revision ancestry, conflicts |
| `lanSync.ts` | Sync sessions over the LAN relay or WebRTC, the wire protocol, trust handshake |
| `devices.ts` | Trusted devices, encrypted file bundles, the tab channel |
| `storage.ts` | IndexedDB access: state, attachments, snapshots, settings; device ID |
| `backup.ts`, `autoBackup.ts`, `SettingsDialog.tsx` | ZIP backups, state validation, automatic snapshots and scheduled full backups with their settings |
| `importTrello.ts`, `trelloFormats.ts`, `trelloBridge.ts` | Trello JSON/ZIP/CSV import, Trello JSON/CSV export, the Trello import extension client |
| `automation.ts`, `reminders.ts`, `repeatingDue.ts` | Board rules, due reminders, repeating due dates |
| `inbox.ts`, `links.ts`, `activity.ts`, `labels.ts` | Personal inbox, links between cards, activity feed, label colors |
| `MarkdownEditor.tsx`, `htmlToMarkdown.ts`, `MarkdownText.tsx` | Visual Markdown editing and rendering |
| `ColorInput.tsx`, `CardPicker.tsx`, `share.ts` | Color picker with presets, searchable card chooser, card print/PNG/JSON/link/QR |
| `boardDoc.ts`, `DocView.tsx` | The board document: card links, backlinks, live project summary |
| `ai.ts`, `AiPanel.tsx` | AI providers (bring your own key), inbox triage and documents with citations |
| `mcp/tools.ts`, `mcp/agent.ts` | MCP tools and the headless agent device; the Node entry is `mcp/kanbonk-mcp.mjs` |

## State flow

1. On start, `loadState()` reads the state from the `app` store in IndexedDB and registers all known IDs so new IDs never collide with them.
2. The UI holds the **full state** (`fullState`) and derives the **visible state** with `visibleState()`, which hides trashed items. Components render the visible state; trash pages and sync use the full state.
3. A user action calls a domain function inside `setState`. The function returns a new state with new revisions.
4. An effect writes the full state back to IndexedDB through a serialized queue and notifies other tabs over `BroadcastChannel("kanbonk-state")`. Other tabs reload and merge.
5. Active sync sessions push the new state to connected devices (see [sync.md](sync.md)).

## Routing

[`router.ts`](../src/router.ts) uses the History API.

| Path | Page |
|---|---|
| `/` | Workspaces, or an "Add workspace" button when there are none |
| `/w/<id>` | Boards of a workspace |
| `/b/<id>` | Board, lists view |
| `/b/<id>?view=calendar&scale=week\|month\|year&date=YYYY-MM-DD` | Board, calendar view |
| `/c/<id>` | Card |
| `/trash?type=workspaces\|boards\|lists\|cards` | Trash, optionally filtered |

When a card is opened from a board, `navigate(href, { modal: true })` stores the current page in `history.state.backgroundHref`. The router then renders that page with the card as a modal on top. Opening `/c/<id>` directly, or reloading it, shows the card as a full page.

In the browser extension there is no server to answer deep links, so routes live in the hash (`index.html#/b/<id>`). `linkHref()` produces the right form for every link.

## Platform layer

[`platform.ts`](../src/platform.ts) exports:

- `platform`: `"web" | "extension" | "desktop" | "mobile"`.
- `saveFile(blob, name)`: uses the Tauri dialog and fs plugins in native apps (the Android WebView ignores `<a download>`), otherwise a regular download.
- `shareFile(file)`: opens the OS share sheet when the Web Share API supports files, otherwise saves the file.
- `hashRouting`: true inside the extension.

Feature detection for optional browser APIs (File System Access, Web Share, WebRTC) stays next to the feature that uses it, so the feature works everywhere the API exists.

## Native shells

- **Tauri** ([`src-tauri/`](../src-tauri)) wraps `dist/` for Windows, macOS, Linux, Android and iOS. Rust code registers the `dialog` and `fs` plugins and four commands that write, list and delete automatic backups (`kanbonk-auto-*.zip` only); permissions are in `src-tauri/capabilities/default.json`.
- **Browser extension** ([`extension/`](../extension)) is a Manifest V3 extension with two permissions: `unlimitedStorage`, so the browser neither caps nor evicts its boards and files, and `downloads`, for automatic backups to `Downloads/Kanbonk Backups`. The manifest `key` pins its ID, so the storage origin does not depend on the folder it was loaded from. Its service worker opens or focuses the Kanbonk tab; the page is the regular app built with a relative base path.
- **LAN server** ([`server.mjs`](../server.mjs)) serves `dist/` with an SPA fallback and relays encrypted WebSocket packets between two members of a room.
