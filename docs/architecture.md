# Architecture

Kanbonk is a single React + TypeScript application. The same build runs as a web page, as a browser extension page and inside the Tauri WebView on desktop and mobile. There is no backend: each device owns a full copy of the user's data.

```
┌────────────────────────── shared app (src/) ───────────────────────────┐
│  React UI (app/ layout/ board/ card/ dialogs/ panels/ pages/ hooks/)   │
│      │ setState(pure function)                                          │
│      ▼                                                                  │
│  Domain modules: model/ (trash · zones · calendar · dedupe …) · sync/   │
│      │                                                                  │
│      ▼                                                                  │
│  lib/storage (IndexedDB)  sync/lanSync · sync/devices   lib/platform   │
└──────┬──────────────────────────────┬──────────────────────────┬────────┘
       │                              │                          │
   web page / extension page     Wi-Fi relay, WebRTC,      Tauri plugins (desktop,
   (browser IndexedDB)           file bundles, tabs        mobile) or browser APIs
```

## Design principles

- **Local-first.** The device's IndexedDB is the source of truth. Sync merges whole states between devices; nothing depends on a server.
- **Pure domain logic.** Every change is a pure function `AppState → AppState` in a domain module. React components call these functions inside `setState`, and the same functions run in tests.
- **Every change is versioned.** `recordRevision` stores a snapshot of the changed entity. Revisions power history, undo by restore and conflict detection during sync.
- **One codebase for all platforms.** Only [`src/lib/platform.ts`](../src/lib/platform.ts) knows which shell the app runs in.

## Source layout

| Module | Responsibility |
|---|---|
| `main.tsx` | Bootstrapping: mounts `app/App` |
| `app/` | The app shell. `App.tsx` wires the hooks together and lays out the header, sidebar, panels and main area; `useAppState` loads and saves the data; `useOverlays` tracks open dialogs; `AppContext` shares data, navigation and actions with `MainContent` (the page switch) and `AppOverlays` (every dialog and panel); `useBoardView` derives the open board's lists, filter and cards; `StatusBanners`, `useClock`, `useNotice`, `useBoardBackground` |
| `layout/` | The app frame: top bar with the app menu, global search results, sidebar, resizable side panel slot |
| `board/` | The board view (`BoardView`, `BoardCanvas`): toolbar and menu, filter, list column, card tile, calendar, zone frame, automation and activity panels, the board document (`DocView`) and AI panel |
| `card/` | The card dialog and its sections: dates, description, checklists, labels, members, links, attachments and previews, sharing (`share.ts`: print, PNG, JSON, link, QR), comments; `CardActionsContext` gives them the card actions without props |
| `dialogs/` | Modal dialogs: Trello import, backup, sync, settings, AI settings, create, copy board, clone card, delete, author name |
| `panels/` | Side panels: Inbox, Planner, reminders, history, board description |
| `pages/` | Pages in the main area: home, workspace, trash, not-found |
| `hooks/` | Changes to cards (`useCardActions`), boards and lists (`useBoardActions`), the trash, device sync, panel layout, automatic backups |
| `ui/` | Shared building blocks: `Modal`, `Dialog`, `SidePanel`, `Button`, form fields (`Input`, `Select`, `Textarea`, `Checkbox`, `FileButton`), `Menu`, `Popover` (a titled panel under the button that opened it), `Segmented`, `PanelRow`, `Hint`, icons, inline name editor, color input, card picker, Markdown editor and renderer |
| `styles/` | `index.css`, the only stylesheet: Tailwind CSS v4 without its preflight reset, the design tokens in `@theme`, base element rules, rendered-Markdown and print rules. Components style themselves with Tailwind utilities in their JSX |
| `model/` | Pure domain logic. Types (`types.ts`), IDs, revisions, search and filters, card and list operations, dependencies, copying (re-exported by `model/index.ts`); `trash.ts` (soft delete, restore chains, purge, visible state), `zones.ts`, `calendar.ts`, `dedupe.ts`, `automation.ts`, `reminders.ts`, `inbox.ts`, `links.ts`, `activity.ts`, `labelColors.ts`, `boardDoc.ts`, `workspaces.ts`, `legacy.ts` (migrating older saved data) |
| `sync/` | `sync.ts` merges two states by revision ancestry and finds conflicts; `lanSync.ts` runs sessions over the LAN relay or WebRTC; `devices.ts` keeps trusted devices, encrypted file bundles and the tab channel |
| `backup/` | `backup.ts` builds and restores ZIP backups and validates states; `autoBackup.ts` schedules snapshots and full backups |
| `i18n/` | Interface languages: `t(key, params)` with `{name}` placeholders and `Intl.PluralRules` plural forms, `tNodes` for messages with elements, `formatDate`/`formatTime`/`formatDateTime`; English sources in `en/<area>.ts`, one file per language in `locales/` (lazy-loaded, type-checked to have every key); `locales.ts` lists the languages and matches the system's. The choice lives in `localStorage["kanbonk-language"]`; `main.tsx` loads it before the first render and renders the app again when it changes (open dialogs stay open; the memoised `CardTile` subscribes with `useLocale`) |
| `lib/` | Infrastructure without domain logic: `storage.ts` (IndexedDB, device ID), `platform.ts` (platform detection, saving and sharing files), `router.ts` (History API router, modal-over-page cards), `format.ts`, `htmlToMarkdown.ts`, `uiPreferences.ts` |
| `ai/` | AI providers (bring your own key), inbox triage and documents with citations |
| `trello/import/`, `trello/formats.ts`, `trello/bridge.ts` | Trello JSON/ZIP import (parsing, ZIP reading, attachments), JSON/CSV export and CSV import, the Trello import extension client |
| `mcp/tools/`, `mcp/agent.ts` | MCP tool schemas (`definitions.ts`) and their implementation (`run.ts`), the headless agent device; the Node entry is `mcp/kanbonk-mcp.mjs` |

## State flow

1. On start, `loadState()` reads the state from the `app` store in IndexedDB and registers all known IDs so new IDs never collide with them.
2. The UI holds the **full state** (`fullState`) and derives the **visible state** with `visibleState()`, which hides trashed items. Components render the visible state; trash pages and sync use the full state.
3. A user action calls a domain function inside `setState`. The function returns a new state with new revisions.
4. An effect writes the full state back to IndexedDB through a serialized queue and notifies other tabs over `BroadcastChannel("kanbonk-state")`. Other tabs reload and merge.
5. Active sync sessions push the new state to connected devices (see [sync.md](sync.md)).

## Routing

[`router.ts`](../src/lib/router.ts) uses the History API.

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

[`platform.ts`](../src/lib/platform.ts) exports:

- `platform`: `"web" | "extension" | "desktop" | "mobile"`.
- `saveFile(blob, name)`: uses the Tauri dialog and fs plugins in native apps (the Android WebView ignores `<a download>`), otherwise a regular download.
- `shareFile(file)`: opens the OS share sheet when the Web Share API supports files, otherwise saves the file.
- `hashRouting`: true inside the extension.

Feature detection for optional browser APIs (File System Access, Web Share, WebRTC) stays next to the feature that uses it, so the feature works everywhere the API exists.

## Native shells

- **Tauri** ([`src-tauri/`](../src-tauri)) wraps `dist/` for Windows, macOS, Linux, Android and iOS. Rust code registers the `dialog` and `fs` plugins and four commands that write, list and delete automatic backups (`kanbonk-auto-*.zip` only); permissions are in `src-tauri/capabilities/default.json`.
- **Browser extension** ([`extension/`](../extension)) is a Manifest V3 extension with two permissions: `unlimitedStorage`, so the browser neither caps nor evicts its boards and files, and `downloads`, for automatic backups to `Downloads/kanbonk/backups`. The manifest `key` pins its ID, so the storage origin does not depend on the folder it was loaded from. Its service worker opens or focuses the Kanbonk tab; the page is the regular app built with a relative base path.
- **LAN server** ([`server.mjs`](../server.mjs)) serves `dist/` with an SPA fallback and relays encrypted WebSocket packets between two members of a room.
