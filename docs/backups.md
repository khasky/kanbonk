# Backups

Kanbonk keeps three kinds of backups. All of them stay on the user's devices.

| Kind | When | What | Where |
|---|---|---|---|
| Automatic snapshots | Every 10 minutes when data changed, and when the page is hidden | The full state (no file bytes) | IndexedDB store `backups` on the same device |
| Automatic full backup | Every 6 hours, day or week, set in **⋯ → Settings** | Full ZIP backup with all files | The platform's default place or a folder the user chose |
| Manual backup | **⋯ → Backup → Download backup** | Full ZIP backup with all files | Downloaded or saved through the system dialog |

Implementation: [`src/autoBackup.ts`](../src/autoBackup.ts), [`src/backup.ts`](../src/backup.ts).

## Automatic snapshots

The first snapshot is taken 30 seconds after start, then every 10 minutes and whenever the page becomes hidden. A snapshot is skipped when the state hash has not changed.

Retention: the 20 newest snapshots plus the newest snapshot of each of the last 30 days. The backup dialog lists snapshots with their time and card/board counts. **Restore** replaces all data with the snapshot; the current state is saved as a new snapshot first, so the step can be undone by restoring that one.

Snapshots live in the same browser storage as the data. They protect against mistakes, not against losing the device or clearing browser data; use automatic full backups or manual backups for that.

## Automatic full backups

**⋯ → Settings → Automatic backups** sets how often a full backup is written (every 6 hours, every day, every week or off), where, and how many backups are kept (1–100, default 7). Backups run while Kanbonk is open: the app checks every 10 minutes whether one is due. **Back up now** writes one at once. Each backup is `kanbonk-auto-<UTC time>-<part>of<total>.zip`; after a successful write, complete backups beyond the newest N are deleted. Only files named `kanbonk-auto-*.zip` are ever deleted.

| Platform | Default location | Default frequency | Old copies deleted |
|---|---|---|---|
| Browser extension | `Downloads/Kanbonk Backups`, saved without a dialog (`downloads` permission) | Every day | Yes, by the download IDs the extension recorded |
| Desktop app | `Documents/Kanbonk Backups` | Every day | Yes |
| Web page | Downloads, as an ordinary download | Off | No: a page cannot delete downloads |
| Mobile app | None | — | — |

**Choose folder** picks another folder: a directory handle in Chromium browsers with the File System Access API (the browser may ask to confirm access again after a restart), or a path in the desktop app. A folder chosen in an older version keeps being used, and daily backups stay on for it.

The extension's data lives inside the browser profile and is deleted with the extension, so the settings show a warning there. The extension's ID is pinned by the `key` in [`extension/manifest.json`](../extension/manifest.json), so reinstalling it unpacked from another folder keeps the same ID and storage origin.

To restore, choose all parts of one backup in **⋯ → Backup**.

## Manual backup format

A backup is one or more ZIP parts of up to 80 MB each. The first part contains `kanbonk-backup.json`:

```json
{
  "format": "kanbonk-backup",
  "version": 2,
  "id": "<backup id>",
  "parts": 3,
  "state": { "...": "the full AppState" },
  "files": [{ "id": "<file id>", "type": "image/png", "size": 5664, "hash": "<SHA-256, 64 hex>" }],
  "unavailable": 0
}
```

Every part stores its share of the files as `files/<id>`. Files referenced only by old revisions are included too, so restoring an old card version also restores its images.

## Restoring

Select **all parts** of one backup at once in **Restore from ZIP**. Kanbonk checks that:

- exactly one manifest is present and every part belongs to the same backup ID;
- the number of parts matches the manifest;
- the state passes `validState`;
- every file's size and SHA-256 match the manifest; altered bytes are rejected even when the size is unchanged.

The backup is then merged into the current data with `mergeStates`. Existing data is kept, and items edited both in the backup and on the device become conflicts to resolve. Version 1 backups (without hashes) remain readable.

`unavailable` counts attachments that were known but missing on the device when the backup was made (for example Trello attachments that were never downloaded); the backup cannot contain their bytes.
