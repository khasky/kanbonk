# Data model

All types live in [`src/model/types.ts`](../src/model/types.ts). The whole database of a device is one `AppState` object.

```ts
interface AppState {
  workspaces: Workspace[];
  boards: Board[];
  lists: BoardList[];
  cards: Card[];
  labels: Label[];
  revisions: Revision[];
  activity?: ActivityEvent[];
  heads: Record<string, string>;      // "kind:id" -> current revision id
  ancestry: Record<string, string[]>; // revision id -> parent revision ids
  tombstones?: Record<string, string>; // "kind:id" -> purge time
}
```

## Entities

| Entity | Key fields | Parent |
|---|---|---|
| `Workspace` | `name` | — |
| `Board` | `name`, `description`, `background`, `starred`, `members`, `automationRules`, `zones`, `doc` (Markdown project document) | workspace (`workspaceId`) |
| `BoardList` | `name`, `position`, `zoneId` | board (`boardId`) |
| `Card` | `name`, `description` (Markdown), `position`, `createdAt`, `startAt`, `dueAt`, `labelIds`, `memberIds`, `checklists`, `comments`, `attachments`, `cover`, `stickers`, `isTemplate`, `completed`, `parentCardId` (sub-card of another card) | list (`listId`) and board (`boardId`) |
| `Label` | `name`, `color` | board |
| `Zone` | `name`, `color` (stored inside `Board.zones`) | board |

Workspaces, boards, lists and cards also carry:

- `archived` — Trello-style "closed/archived": hidden from boards and search, restored from the archive views.
- `deletedAt`, `deletedBatch` — the item is in the trash (see [trash-and-dependencies.md](trash-and-dependencies.md)).
- `sourceTrelloId` — the original Trello ID for imported items.

`position` is a number used for ordering within the parent. Reordering assigns fresh positions `1..n`; inserting between two items uses the midpoint.

### Zones

A zone groups adjacent lists of one board. Zones are stored as `Board.zones: { id, name, color }[]` and each list points to at most one zone with `BoardList.zoneId`. Keeping the reference on the list makes "a list belongs to one zone at most" a property of the data rather than a rule to enforce. `src/zones.ts` keeps each zone contiguous: a list that joins a zone moves to the end of the zone, and drag and drop assigns the zone of the list it lands on. Deleting a zone clears `zoneId` on its lists; the lists stay.

### Card dependencies

A dependency is a pair of links:

- the **dependent** card gets an item in its `Dependencies` checklist (created when missing) with `linkedCardId` = the prerequisite card;
- the **prerequisite** card gets an attachment of status `link` with `linkedCardId` = the dependent card.

`linkDependency` and `unlinkDependency` in `model.ts` keep both sides consistent. This mirrors [how Trello represents dependencies](https://support.atlassian.com/trello/docs/creating-and-managing-task-dependencies/), so dependencies survive a Trello round trip.

### Attachments and media

Attachment metadata lives on the card; file bytes live in the `attachments` IndexedDB store under the attachment ID. `status` is `local` (bytes present), `missing` (expected but not downloaded yet, e.g. after a Trello import) or `link` (a URL or a card link). Board backgrounds and image stickers use the same store. `mediaReferences(state)` lists every file ID the state needs, including files referenced only by old revisions.

## IDs

New IDs are 8 characters of base62 (`[0-9A-Za-z]`), for example `DMZD8gZ6`, like Trello's short links:

- URL-safe without escaping.
- Unbiased: random bytes ≥ 248 are rejected, so each character is uniform over 62 symbols.
- 62⁸ ≈ 2.2 × 10¹⁴ possible values. The generator also checks every new ID against all IDs this device has seen (`rememberIds`), so a collision with known data is impossible and one with unseen data is negligible.

Revision IDs use 12 characters. Older data with UUIDs keeps working: IDs are opaque strings everywhere.

## Revisions

`recordRevision(state, kind, id, deviceId)` appends a `Revision` with a full snapshot of the entity, links it to the previous head (`parentId`/`parentIds`) and moves `heads["kind:id"]` to it.

- **History**: the card and board history views list revisions; restoring one records a new revision with the old snapshot.
- **Sync**: revision ancestry tells whether one device's version descends from the other's or whether they diverged (see [sync.md](sync.md#merge-and-conflicts)).
- **Retention**: merging keeps the 30 newest revisions per entity plus every revision that is a head or part of an open conflict.

## Storage

The project was previously called Listva, and data written under that name is migrated by [`src/legacy.ts`](../src/legacy.ts) and [`src/storage.ts`](../src/storage.ts): on start the IndexedDB database `listva` is copied into `kanbonk` and deleted, and `localStorage` keys `listva-*` move to `kanbonk-*`. The inbox and personal workspace IDs `listva-*` are renamed to `kanbonk-*` everywhere they are referenced (entities, revisions, heads, tombstones) when the state is loaded and in every incoming state, so backups, sync bundles (header `LISTVA-SYNC-1`, key prefix `listva-key:`) and Trello helper exports (`listva*` fields) made before the rename are still read. Live sync uses the new room and key prefixes, so a device has to run the renamed version to pair. The desktop app's identifier changed from `app.listva.local` to `com.khasky.kanbonk`; on Windows the first start copies the old WebView profile ([`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)). On Android the new identifier is a separate app: move data with a backup or sync.

| Where | What |
|---|---|
| IndexedDB `kanbonk`, store `app` | The `AppState` |
| store `attachments` | File bytes by attachment/background/sticker ID |
| store `backups` | Automatic snapshots (JSON) and their metadata |
| store `settings` | Automatic backup settings, backup folder, time of the last backup, IDs of backup downloads (extension) |
| `localStorage` | Device ID (`kanbonk-device-id`), author name, trusted devices, chosen sync transport, UI preferences (panels, filters, dismissed reminders, ignored duplicates) |

Each origin has its own storage: the web app on `localhost:1420`, the web app on `192.168.1.10:4174`, the extension and each native app are separate devices from Kanbonk's point of view and sync like any other devices.

## Changing the model

- Add new fields as **optional** so that older states, backups, sync peers and file bundles stay valid.
- Extend `validState` in [`backup.ts`](../src/backup.ts) for the new field; it guards backup restores, sync packets and file bundles against malformed data.
- Copy or remap the field in `copyBoard`/`copyList` and `transferCard` if it references other entities.
- Add a test in `tests/` covering creation, sync (`mergeStates`) and `validState`.
