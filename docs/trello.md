# Trello import and export

Kanbonk reads Trello's JSON export, ZIP archives with attachments and Trello's CSV, and writes boards back as Trello-shaped JSON or CSV.

Code: [`src/trello/import/`](../src/trello/import/) (JSON and ZIP import), [`src/trello/formats.ts`](../src/trello/formats.ts) (JSON/CSV export, CSV import), [`src/trello/bridge.ts`](../src/trello/bridge.ts) and [`trello-import-extension/`](../trello-import-extension) (board export and attachment download).

## Import

Open **⋯ → Import from Trello** and choose the files; several ZIP parts and a JSON can be chosen at once.

| Input | How to get it in Trello | What Kanbonk imports |
|---|---|---|
| JSON | Board menu → Print, export and share → Export as JSON | Everything in the JSON (see below); attachments as "missing" until their files arrive |
| ZIP parts with JSON and files | **Export board** in the Kanbonk Trello Import extension (below), or by hand | JSON plus attachment, sticker and background bytes |
| More ZIP parts later | **Add files to imported board** | Missing files of a board imported earlier |
| CSV | Board menu → Print, export and share → Export as CSV (Trello Premium) | Lists and cards with names, descriptions, labels, members, start and due dates |

From JSON Kanbonk restores boards, lists, cards, descriptions, labels with all 30 Trello colors, members, start and due dates, checklists, comments and the `actions` log, card templates, covers, sticker metadata and attachment links. Closed Trello boards stay closed. Card creation times come from the timestamp inside the 24-hex Trello ID or from the `createCard` action and drive the calendar view.

Links to Trello cards inside names, descriptions, checklist items and link attachments become links between the imported cards, across boards. Trello represents dependencies the same way, so they keep working.

Boards from one Trello workspace land in one Kanbonk workspace, matched by the Trello organization ID. A plain JSON export only contains the ID, so the workspace is named `Trello <first 8 chars of ID>` until you rename it.

### Limits of Trello's JSON

- [A board JSON export contains only the latest 1000 actions](https://support.atlassian.com/trello/docs/exporting-data-from-trello/). Older activity and comments may be missing; Kanbonk warns about it. The extension fetches the full comment history page by page.
- Attachments uploaded to Trello are only links in the JSON and need an authorized Trello session to download.

### Getting attachments

**Kanbonk Trello Import extension (Chrome, Edge).** Open `chrome://extensions` or `edge://extensions`, turn on **Developer mode**, choose **Load unpacked** and select [`trello-import-extension/`](../trello-import-extension). Sign in to Trello in the same browser profile.

1. Open the board in Trello. A **Kanbonk export** panel appears in the lower right corner.
2. Press **Export board**. The panel shows the progress: board data, comments, then files with their count and size. **Cancel** stops the export.
3. The board is saved to the downloads folder as `<board> - Kanbonk export - part N.zip`, the last one marked `(last)`. Allow the site to download multiple files if the browser asks.
4. In Kanbonk choose all the parts at once in **⋯ → Import from Trello** and press **Import**.

Each part holds files up to about 100 MB in total; a larger file gets a part of its own. Part 1 contains `board.json` with the full comment history, the workspace name and stickers. Every part contains `kanbonk-export.json` with the export ID and the part number, and the last part also states the number of parts, so Kanbonk refuses an incomplete or mixed selection and names the missing parts. Files that could not be downloaded are listed in the panel and in `failed-files.txt` of the last part. Kanbonk reads the parts one at a time, so a large export does not have to fit in memory at once.

The same extension also lets Kanbonk opened from `http://localhost:1420` or `http://127.0.0.1:4173` fetch attachments and the full comment history while a Trello tab is open, when you import a plain board JSON. It can only read `trello.com` and only accepts these requests from local Kanbonk pages, so this path does not work from the Kanbonk extension or the native apps; use the ZIP parts there.

**Your own ZIP.** Put files under paths that contain the Trello attachment ID. A board background can go to `background/<Trello board ID>/<file>`.

ZIP parts made by the console helper of earlier versions (`<board>-1.zip`, `<board>-2.zip`, …) are imported the same way: choose all of them at once.

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
