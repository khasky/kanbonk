# Kanbonk

**Local-first Kanban boards for desktop, browser and mobile — no account, no cloud, no server.**

Kanbonk is a Trello-style task manager that keeps every workspace, board, list, card and attachment on your own devices. Devices sync directly with each other over Wi-Fi, a private peer-to-peer link or an encrypted file you pass by Bluetooth, and Kanbonk can import and export Trello JSON and CSV.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-web%20%7C%20Windows%20%7C%20Android%20%7C%20Chrome%2FEdge-informational)
![Status](https://img.shields.io/badge/status-alpha-orange)

![A Kanbonk board with a "Development" zone grouping four lists](docs/images/board.png)

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Platforms](#platforms)
- [Privacy and security](#privacy-and-security)
- [Documentation](#documentation)
- [Project status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Features

**Boards like Trello**

- Workspaces, boards, lists and cards with drag and drop: lists move left and right, cards move within a list and between lists.
- Card modal over the board, or a standalone card page when opened by link (`/c/<id>`): title, visual Markdown description and comments, start and due dates, checklists, labels in any color, members, attachments, covers and full-card colors, stickers.
- **Sub-cards**, **clone** (`<name> - Clone` right below) and **share**: print, PNG, JSON, link and QR code.
- **Zones**: group adjacent lists into one zone, e.g. *Development* = Todo + In progress + Testing + Deployment. A list belongs to at most one zone.
- **Calendar view** (week, month, year): a card sits on its start date (or creation date) and stretches to its due date like an event in Google Calendar. Drag cards between days, drag their edges to change dates, delete with ×.
- **Card dependencies**: a card can depend on another card, on any board. Deleting a card warns about the cards that depend on it.
- Instant search on the board and across all workspaces with filters (`board:`, `label:`, `due:overdue`, `has:attachments`, …).
- Stays responsive on boards with thousands of cards, on phones too: see the [load test results](docs/testing.md#performance).
- Short, URL-safe IDs like Trello's (`DMZD8gZ6`).

**Your data stays yours**

- **Trash** for workspaces, boards, lists and cards, kept for 30 days. Restoring an item also restores the parents and dependencies it needs.
- **Automatic backups**: version snapshots every 10 minutes and, where the browser supports it, a daily ZIP with all files written to a folder you choose.
- **Semantic duplicate finder** across boards that runs entirely on the device, with one-click merge.
- Full revision history for every workspace, board, list and card.

**Board + document, AI and agents**

- Every board has a **project document** with links to cards, backlinks and a live project summary, so the context lives next to the work.
- **AI assistant with your own key** (Claude, ChatGPT, Gemini or any OpenAI-compatible server): turns emails and meeting notes into cards that quote their source, and writes the project document citing cards. Nothing is sent without a click.
- **MCP server**: AI agents read and change boards through a headless Kanbonk device that syncs with your devices after you trust it.

**Sync without a cloud**

- Every change appears instantly and is saved locally; offline changes queue up and are sent when the connection returns.
- Several tabs of the same browser stay in sync automatically.
- **Wi-Fi**: devices meet in a room on a small local relay (`npm run serve:lan`) that only sees encrypted packets.
- **Internet peer-to-peer**: a direct, DTLS-encrypted WebRTC link set up by exchanging an invitation, e.g. through a messenger.
- **Bluetooth, USB or messenger**: an encrypted `.kanbonk-sync` file with data and attachments.
- **Trusted devices**: a new device must be approved before any data is accepted. Concurrent edits are detected and you choose which version to keep.

**Trello compatible**

- Import Trello JSON exports, ZIP archives with attachments and Trello CSV.
- Export any board as Trello-shaped JSON or as CSV with Trello's columns.

See the [feature guide](docs/features.md) for details.

## Quick start

Requirements: [Node.js](https://nodejs.org/) 22.12 or newer and npm.

```sh
git clone https://github.com/khasky/kanbonk.git
cd listva
npm install
npm run dev
```

Open the address Vite prints (by default `http://localhost:1420`). Data is stored in the browser's IndexedDB on this device.

Run the tests and a production build:

```sh
npm test
npm run build
```

To use Kanbonk from a phone on the same Wi-Fi, build and start the LAN server with your computer's local IP, then open `http://<ip>:4174` on the phone:

```sh
npm run build
npm run serve:lan -- 192.168.1.10 4174
```

## Platforms

One React app in `src/` runs everywhere; the platform-specific code lives in a single module, [`src/platform.ts`](src/platform.ts).

| Platform | Develop | Build | Output |
|---|---|---|---|
| Web | `npm run dev` | `npm run build` | `dist/` |
| Chrome / Edge extension | `npm run dev:extension` | `npm run build:extension` | `dist-extension/` (load unpacked) |
| Windows (Tauri) | `npm run tauri dev` | `npm run tauri build` | NSIS `.exe` and `.msi` in `src-tauri/target/release/bundle/` |
| Android (Tauri) | `npm run tauri android dev` | `npm run tauri android build -- --apk` | APK in `src-tauri/gen/android/app/build/outputs/apk/` |
| macOS, Linux, iOS (Tauri) | `npm run tauri dev` / `npm run tauri ios dev` | `npm run tauri build` / `npm run tauri ios build` | not built or tested yet |

Native builds need the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/): Rust for desktop, plus JDK 17, the Android SDK and NDK for Android. Step-by-step setup is in [docs/platforms.md](docs/platforms.md).

## Privacy and security

- No account, telemetry or Kanbonk server. Each device keeps its data locally (IndexedDB in browsers and in the app WebViews).
- Wi-Fi sync packets are encrypted end to end with XChaCha20-Poly1305 using a key derived from a 128-bit pairing code. The relay forwards ciphertext and never stores data.
- Peer-to-peer sync uses WebRTC data channels (DTLS). Public STUN servers learn only network addresses.
- File bundles are encrypted with the pairing code of a trusted device.
- The AI assistant is off until you add your own key. The key stays on the device; board data goes straight to the chosen provider only when you press an AI action (see [docs/ai.md](docs/ai.md#privacy)).
- The LAN server serves the app over plain HTTP. Use it only on a network you trust: anyone on that network could tamper with the page before encryption starts.

The design and its limits are described in [docs/sync.md](docs/sync.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Documentation

| Document | Contents |
|---|---|
| [Feature guide](docs/features.md) | Pages, cards, zones, calendar, search syntax, automation, reminders |
| [Architecture](docs/architecture.md) | Code layout, state flow, routing, platform layer |
| [Data model](docs/data-model.md) | Entities, IDs, revisions, soft delete, tombstones |
| [Sync](docs/sync.md) | Transports, encryption, trusted devices, merge and conflicts |
| [Trash and dependencies](docs/trash-and-dependencies.md) | Delete, restore chains, 30-day purge, card dependencies |
| [AI and the board document](docs/ai.md) | Project document, AI providers, privacy, inbox triage, citations |
| [MCP server](docs/mcp.md) | Connecting AI agents, tools, security |
| [Backups](docs/backups.md) | Automatic snapshots, folder backups, ZIP backup format |
| [Trello import and export](docs/trello.md) | JSON, ZIP and CSV formats, the Trello bridge extension |
| [Platforms](docs/platforms.md) | Building and developing for web, extension, Windows, Android |
| [Testing](docs/testing.md) | Automated tests, what has been verified, manual device checklist |

## Project status

Kanbonk is **alpha** software. The web app, the Windows build, the Chrome/Edge extension and the Android build in an emulator have been tested. Sync between physical phones, Bluetooth transfer, peer-to-peer across different networks and iOS builds have not been verified yet. The full list is in [docs/testing.md](docs/testing.md).

## Contributing

Bug reports, ideas and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Kanbonk contributors.

Kanbonk is not affiliated with Trello or Atlassian. Trello is a trademark of Atlassian.
