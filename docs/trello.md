# Trello import and export

Kanbonk reads Trello's JSON export, ZIP archives with attachments and Trello's CSV, and writes boards back as Trello-shaped JSON or CSV.

Code: [`src/importTrello.ts`](../src/importTrello.ts) (JSON and ZIP import), [`src/trelloFormats.ts`](../src/trelloFormats.ts) (JSON/CSV export, CSV import), [`src/trelloBridge.ts`](../src/trelloBridge.ts) and [`trello-bridge/`](../trello-bridge) (attachment download helper).

## Import

Open **⋯ → Import from Trello** and pick a file.

| Input | How to get it in Trello | What Kanbonk imports |
|---|---|---|
| JSON | Board menu → Print, export and share → Export as JSON | Everything in the JSON (see below); attachments as "missing" until their files arrive |
| ZIP with JSON and files | Made by the Kanbonk helper (below) or by hand | JSON plus attachment bytes |
| Extra ZIP parts | **Load attachments from ZIP** after an import | Attachment bytes for an existing import |
| CSV | Board menu → Print, export and share → Export as CSV (Trello Premium) | Lists and cards with names, descriptions, labels, members, start and due dates |

From JSON Kanbonk restores boards, lists, cards, descriptions, labels with all 30 Trello colors, members, start and due dates, checklists, comments and the `actions` log, card templates, covers, sticker metadata and attachment links. Closed Trello boards stay closed. Card creation times come from the timestamp inside the 24-hex Trello ID or from the `createCard` action and drive the calendar view.

Links to Trello cards inside names, descriptions, checklist items and link attachments become links between the imported cards, across boards. Trello represents dependencies the same way, so they keep working.

Boards from one Trello workspace land in one Kanbonk workspace, matched by the Trello organization ID. A plain JSON export only contains the ID, so the workspace is named `Trello <first 8 chars of ID>` until you rename it.

### Limits of Trello's JSON

- [A board JSON export contains only the latest 1000 actions](https://support.atlassian.com/trello/docs/exporting-data-from-trello/). Older activity and comments may be missing; Kanbonk warns about it. The helper and the bridge extension fetch the full comment history page by page.
- Attachments uploaded to Trello are only links in the JSON and need an authorized Trello session to download.

### Getting attachments

Pick whichever works for you:

1. **Helper script.** In the import dialog press **Copy Trello helper**, open the board in Trello, paste the code into the browser console and wait. It downloads ZIP parts: the first contains `board.json`, the others contain batches of files. Import the first ZIP, then add the rest with **Load attachments from ZIP**.
2. **Bridge extension (Chrome).** Load [`trello-bridge/`](../trello-bridge) as an unpacked extension, sign in to Trello in the same profile and keep a Trello tab open. When you import JSON into Kanbonk opened from `http://localhost` or `http://127.0.0.1`, attachments and the full comment history are fetched through that tab. The extension can only read `trello.com` and only accepts requests from local Kanbonk pages, so it does not work from the Kanbonk extension or the native apps.
3. **Your own ZIP.** Put files under paths that contain the Trello attachment ID. A board background can go to `background/<Trello board ID>/<file>`.

Attachments are matched by Trello ID in the ZIP path; a match by file name is accepted only when the name is unique and the size matches the JSON. Each attachment shows its status: local, missing or link.

## Export

From the board menu:

- **Export JSON (Trello)** writes a Trello-shaped board JSON: `id`, `name`, `desc`, `closed`, `prefs`, `labels` with Trello color names, `lists`, `cards` with `idList`, `idLabels`, `idMembers`, `start`, `due`, `dueComplete`, `shortLink`, `url`, `checklists`, `members` and `actions` (`createCard`, `commentCard`). Kanbonk can import its own export. Attachment bytes are not included; use a backup for that.
- **Export CSV (Trello)** writes one row per card with Trello's CSV columns:

| # | Column | # | Column |
|---|---|---|---|
| 1 | Card ID | 12 | Vote Count |
| 2 | Card Name | 13 | Comment Count |
| 3 | Card URL | 14 | Last Activity Date |
| 4 | Card Description | 15 | List ID |
| 5 | Labels | 16 | List Name |
| 6 | Members | 17 | Board ID |
| 7 | Due Date | 18 | Board Name |
| 8 | Attachment Count | 19 | Archived |
| 9 | Attachment Links | 20 | Start Date |
| 10 | Checklist Item Total Count | 21 | Due Complete |
| 11 | Checklist Item Completed Count | | |

The file is UTF-8 with a BOM so spreadsheet apps detect the encoding. Quoting follows RFC 4180.

Columns 1–19 follow the order of Trello's CSV export as [documented by the Atlassian community](https://community.atlassian.com/forums/Trello-questions/Printing-content-from-all-cards-from-a-board/qaq-p/2067718). Trello only offers CSV export on Premium plans, so the format has not been compared against a live Trello CSV file. The importer matches columns by name, so extra or reordered columns are fine.

Zones, card dependencies beyond checklist links, the trash and revision history have no Trello equivalent and are not exported.
