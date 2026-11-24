# Feature guide

Button names are quoted as they appear in the app.

## Pages

| Address | Page |
|---|---|
| `/` | All workspaces. With none, an **Add workspace** button |
| `/w/<id>` | Boards of a workspace. With none, **Add board** |
| `/b/<id>` | A board in lists view. With no lists, **Add a list** |
| `/b/<id>?view=calendar` | The same board in calendar view |
| `/b/<id>?view=doc` | The board's project document (see [ai.md](ai.md)) |
| `/c/<id>` | A card |
| `/trash` | The trash, with a filter by kind |

The top bar has a link to the trash with the number of trashed items and a search box over all workspaces. The sidebar has the personal **Inbox** (a board in its own **Inbox** workspace), the **Planner**, the list of workspaces and their boards.

## Boards, lists and cards

- **Drag and drop**: drag a list by its handle (⋮⋮) left or right; drag cards within a list or to another list. Lists can also be moved with **Move left** / **Move right** in the list menu.
- List menu (⋯): sort cards by name or due date, move, copy the list with its cards, delete to the trash.
- Boards can be starred, copied to another workspace with or without cards and templates, and given a background: a preset color, any color from the color picker, or your own image.
- Cards can be moved or copied to a list on another board, turned into templates and created from templates.
- Renaming creates one revision when you finish typing; Esc cancels the edit.
- **Search on the board**: the search box in the board toolbar narrows the board to matching cards as you type (title, description, checklists, comments, labels).

### Large boards

Boards with thousands of cards stay responsive on desktops and phones: lists outside the viewport render a placeholder until they scroll into view, long lists render 40 cards at a time and add more as you scroll, card tiles are memoised so an edit re-renders one tile, and search and filters run on deferred input so typing never waits for the result. The numbers are in [testing.md](testing.md#performance).

## Zones

A zone groups adjacent lists of a board, for example **Development** = Todo + In progress + Testing + Deployment. A list belongs to at most one zone.

- Create: **New zone** at the end of the board, under **Add a list**, enter a name. The empty zone appears at the end of the board with a **Drag lists here** area.
- Add a list: drag the list into the empty zone's area, onto a list of the zone or onto the zone header. The list moves to the end of the zone so the zone stays in one piece.
- Remove a list: drag it onto a list outside the zone.
- Move a whole zone: drag its header handle (⋮⋮) onto another list.
- The header shows the number of cards in the zone, and lets you rename the zone and change its color. **×** removes the zone; the lists stay on the board.

## The card

A card opened from a board appears as a modal on top of it; Esc or the close button returns to the board. Opened by link, it is a page of its own.

- **Layout**: the header holds the card's list (choosing another moves the card), the cover button, the **⋯** menu (Move / copy, Clone, Make template, Share, Card history, Move to trash) and the close button. Under the title, **Add**, **Labels**, **Dates**, **Checklist** and **Members** open small popovers next to the button; **Add** lists everything that can be added to the card (also attachments, links, dependencies, cover and stickers). The card's members, labels and dates show as chips under these buttons; a chip opens its popover. Esc closes a popover without closing the card.

- **Title**: a text field.
- **Card color**: the cover picker has presets and a color picker; **Color the whole card** paints the whole tile, and the text switches between dark and light for contrast.
- **Description**: visual Markdown editing with a formatting toolbar (bold, italic, strikethrough, headings, lists, quote, code, link, divider) and a toggle to edit the Markdown source. Ctrl+Enter saves, Esc cancels. Pasted text is inserted as plain text.
- **Start and due dates**: the **Dates** popover has a month calendar, a start date, a due date and time and a reminder; a day picked in the calendar goes to the date field last focused. **Save** applies the dates, **Remove** clears them. The date chip turns red once the due date has passed.
- **Labels**: Trello's 30 colors as presets, or any color from the color picker.
- **Comments**: written in the same visual Markdown editor as the description.
- **Members**: the **Members** button appears when the board has someone to assign: a trusted device (see [sync.md](sync.md#trusted-devices)) or a member imported from Trello.
- **Sub-cards**: **Sub-cards** creates a child card right below the parent. A card can have one parent, chosen with **Choose parent card**; tiles show `↳ parent`. Deleting a parent moves its sub-cards to the trash with it.
- **Clone** copies the card right below the original as `<name> - Clone`.
- **Share**: print the card, save it as PNG or JSON, copy its link (`/c/<id>`) or show a QR code of the link.
- Checklists, attachments, links, stickers.
- **Preview** opens a stored attachment in a dialog: images, PDF (in the browser's PDF viewer; not in the Android app), Markdown rendered as formatted text, plain text and code files (txt, json, csv, yaml, source code and similar, first 1 MB), video and audio. The type is taken from the file's MIME type or, for untyped files, its extension.
- **Dependencies**: **Dependency** links the card to a card it depends on, on any board (as an item of the card's **Dependencies** checklist). The card shows **Depends on** and **Blocks**. See [trash-and-dependencies.md](trash-and-dependencies.md).
- **History**: every change is a revision; any earlier version can be restored.
- The meta line shows the list, board, creation date and card ID.

Comments are signed with the name set in **⋯ → My name** (by default `Member xxxxxx`, built from the device ID, so it differs per device). Only the device that wrote a comment can edit or delete it; comments imported from Trello are read-only. This is a UI rule, not access control.

## Calendar view

Switch a board between **Lists** and **Calendar** in the board toolbar. Scales: week, month and year; **Today** and the arrows move through time.

- A card is placed on its **start date**, or on its **creation date** when it has no start date.
- If the due date is later than the start, the card stretches across all days up to the due date, like a multi-day event in Google Calendar. Overlapping cards stack in lanes.
- Clicking a card opens the same card modal as in the lists view.
- **Drag** a card to another day to move it; start and due dates shift together.
- **Resize** a card by dragging its left or right edge to change the start or due date.
- **×** on a card moves it to the trash after a confirmation.
- The board filter applies to the calendar too.

## Search

The search box in the top bar searches all workspaces: workspace and board names, card titles, descriptions, checklists and comments. Several words must all match; quote a phrase to match it exactly. Prefix a condition with `-` to exclude matches.

| Filter | Matches cards… |
|---|---|
| `board:`, `list:` | on a board or in a list with that name |
| `label:` | with that label |
| `member:` or `@name` | assigned to that member |
| `name:`, `description:`, `checklist:`, `comment:` | with the text in that field |
| `has:attachments`, `has:description`, `has:cover`, `has:members`, `has:stickers` | that have it |
| `due:overdue`, `due:day`, `due:week`, `due:month` | due in that range |
| `is:open`, `is:starred` | not in the trash, or on a starred board |

Example: `board:"Release" label:bug -is:starred due:week`.

The board **Filter** narrows the current board by text, label, member and due date.

## Inbox and planner

**Inbox** is a personal board for quick capture; its cards can be moved to any list later. **Planner** shows cards with due dates by week. On wide screens both panels can be open next to a board; their widths are adjustable and remembered on the device.

## Reminders

Cards with a due date and a reminder time appear in **Reminders** in the top bar when the reminder time arrives. Kanbonk checks while the app is open and, after a restart, shows reminders due within the last day. System notifications while the app is closed are not supported yet.

## Automation

**Automation** in the board toolbar creates rules:

- **Trigger**: a card moves to a chosen list, a due date arrives (at the due time or an hour, day or week before), or a custom button in the card is pressed.
- **Action**: move to the trash (with its sub-cards) or add a label.

Due rules run once per due date while the app is open or at the next start. Rules are saved with the board and copied with it.

## Duplicate finder

**⋯ → Duplicates across boards** finds cards with similar meaning on different boards. It runs on the device: card titles (weighted highest), descriptions and checklist items are compared with TF-IDF over English word stems (common English stop words are dropped and a light English stemmer strips suffixes, so "preparing reports" matches "prepare report") and title character trigrams, which also tolerate small typos. Word forms of other languages are not normalized; such text is matched by exact words and trigrams only. Templates and trashed cards are skipped.

- The slider sets the similarity threshold (default 0.55); a toggle includes pairs on the same board.
- **Merge into first** / **Merge into second** keeps one card and moves the other's description, comments, checklists, attachments, dates and dependency links into it; the duplicate goes to the trash.
- **Not a duplicate** hides the pair on this device.

## Offline work

Every change is applied to the screen and saved on the device immediately; sync never blocks the UI. The badge in the top bar shows the sync state: **Local** (no sync set up), **Synced**, **Unsent: N** (changes waiting for the connected device) or **Offline · N queued**. When the network or the relay comes back, Kanbonk reconnects on its own (after 5 s, then up to every 60 s) and sends the queued changes.

## AI and agents

- The board document and the AI assistant (your own Claude, ChatGPT, Gemini or compatible key): [ai.md](ai.md).
- The MCP server that lets AI agents work with your boards: [mcp.md](mcp.md).

## Trash and backups

Deleted items stay in the trash for 30 days, then are deleted for good. See [trash-and-dependencies.md](trash-and-dependencies.md) and [backups.md](backups.md).
