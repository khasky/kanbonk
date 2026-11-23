# Trash and dependencies

Implementation: [`src/model/trash.ts`](../src/model/trash.ts). Tests: [`tests/trash.test.ts`](../tests/trash.test.ts).

## Moving to the trash

Workspaces, boards, lists and cards can be deleted from their menus. Deleting is a soft delete: the item and everything below it that is not already in the trash get the same `deletedAt` time and the same `deletedBatch` ID.

| Deleted item | Also moves to the trash |
|---|---|
| Workspace | its boards, their lists and cards |
| Board | its lists and cards |
| List | its cards |
| Card | its sub-cards (`parentCardId`) |

Trashed items disappear from boards, search and the calendar: the UI renders `visibleState(state)`, which filters them out. They stay in the stored state, sync to other devices and are included in backups.

### Dependent cards

Before deleting, Kanbonk computes the impact (`trashImpact`): how many items will be trashed and which cards outside the deleted set **depend on** a card that is being deleted. When there are such cards, the delete dialog offers:

- **Delete with dependents** — trash the dependent cards in the same batch;
- **Delete, keep dependents** — trash only the selected item; the dependent cards keep their link and show that their prerequisite is in the trash;
- **Cancel**.

A card "depends on" another card when it has a item in its **Dependencies** checklist linked to it (see [data-model.md](data-model.md#card-dependencies)). The card modal shows **Depends on** and **Blocks** summaries.

## The trash page

`/trash` lists trashed items with their path (workspace › board › list), the deletion time and whether they were deleted together with a parent. Tabs filter by kind (`?type=workspaces|boards|lists|cards`).

## Restoring along the dependency chain

`restoreFromTrash(state, kind, id)` brings back everything the item needs to be usable:

1. **Ancestors**: if the card's list, board or workspace is in the trash, they are restored too, otherwise the card would have nowhere to appear. A sub-card also brings back its trashed parent card.
2. **The same batch**: items that were deleted in the same action as the restored item and live below it (restoring a board brings back its lists and cards, but not cards deleted separately earlier).
3. **Prerequisites**: cards the restored cards depend on, if they are in the trash, so dependencies are not left dangling.

The function returns the list of restored items, and the UI reports how many extra items came back.

## Retention: 30 days

Items stay in the trash for 30 days. The trash page shows how many days each item has left. `purgeExpired(state, deviceId, now)` runs at start-up and every 30 seconds while the app is open and deletes permanently everything trashed more than 30 days ago, with the items below it, exactly as **Delete forever** does.

## Deleting permanently

**Delete forever** on an item and **Empty trash** remove items from the state for good:

- the entity, its revisions and heads are removed;
- links pointing at a purged card (dependency checklist items, link attachments) are removed from the remaining cards;
- a **tombstone** `"kind:id" → time` is recorded. Tombstones sync, so a purge on one device removes the item on every device instead of the item coming back from a peer that still has it.

Attachment bytes of purged cards stay in IndexedDB until the next backup restore or cleanup; they are no longer referenced by the state.

## No archive

Kanbonk has no separate archive: hiding finished work means moving it to the trash. Earlier versions could archive workspaces, boards, lists and cards; when such data is loaded, synced from an older device or restored from a backup, archived items move to the trash with the time of that migration, so they can be restored for 30 days. Automation rules that archived a card now move it to the trash. Boards, lists and cards closed in Trello are imported into the trash the same way.
