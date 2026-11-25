import { currentLocale, type MessageKey, t } from "../i18n";
import type { Revision } from "../model";

type Snapshot = Revision["snapshot"];

// Fields that change without the user seeing a difference.
const ignored = new Set([
  "id",
  "createdAt",
  "deletedBatch",
  "automationRunKeys",
  "sourceTrelloId",
  "sourceTrelloShortLink",
  // Stickers were removed; old versions may still hold them (model/legacy.ts drops them from cards).
  "stickers",
]);

// The part of the item each field belongs to, in the order the parts are listed. Lists show how many were added or
// removed.
const parts: Array<{ fields: string[]; key: MessageKey; counted?: boolean }> = [
  { fields: ["deletedAt", "deleted"], key: "panels.historyTrashed" },
  { fields: ["workspaceId", "boardId", "listId", "zoneId", "parentCardId"], key: "panels.historyMoved" },
  { fields: ["name"], key: "card.title" },
  { fields: ["description"], key: "card.description" },
  { fields: ["doc"], key: "board.viewDoc" },
  { fields: ["labelIds"], key: "card.labels" },
  { fields: ["memberIds", "members"], key: "card.members" },
  { fields: ["startAt", "dueAt", "dueReminderMinutes"], key: "card.dates" },
  { fields: ["checklists"], key: "card.checklist" },
  { fields: ["comments"], key: "board.comments", counted: true },
  { fields: ["attachments"], key: "card.attachments", counted: true },
  { fields: ["cover"], key: "card.cover" },
  { fields: ["color"], key: "panels.historyColor" },
  { fields: ["background", "backgroundImageId"], key: "panels.historyBackground" },
  { fields: ["zones"], key: "panels.historyZones" },
  { fields: ["automationRules"], key: "board.automation" },
  { fields: ["isTemplate"], key: "board.template" },
  { fields: ["starred"], key: "pages.starred" },
  { fields: ["position"], key: "card.position" },
];
const partOf = new Map(parts.flatMap((part) => part.fields.map((field) => [field, part] as const)));

/** What changed from `previous` to `current`, e.g. "Description, Comments (+2)"; the oldest kept version has no previous. */
export function revisionChanges(previous: Snapshot | undefined, current: Snapshot): string {
  if (!previous) return t("panels.historyOldest");
  const before = previous as unknown as Record<string, unknown>;
  const after = current as unknown as Record<string, unknown>;
  const changed = new Set<(typeof parts)[number] | undefined>();
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (ignored.has(field) || JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
    changed.add(partOf.get(field));
  }
  const moved = changed.has(partOf.get("listId"));
  const names = parts
    .filter((part) => changed.has(part) && !(moved && part.key === "card.position"))
    .map((part) => {
      if (part.key === "panels.historyTrashed" && !after.deletedAt && !after.deleted)
        return t("panels.historyRestored");
      const name = t(part.key);
      if (!part.counted) return name;
      const delta = count(after[part.fields[0]]) - count(before[part.fields[0]]);
      return delta ? `${name} (${delta > 0 ? "+" : "−"}${Math.abs(delta)})` : name;
    });
  if (changed.has(undefined)) names.push(t("panels.historyOther"));
  return names.length ? names.join(", ") : t("panels.historyNoChanges");
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** The stored size of a version, e.g. "3.4 KB". */
export function revisionSize(snapshot: Snapshot): string {
  const kb = new TextEncoder().encode(JSON.stringify(snapshot)).length / 1024;
  return t("panels.historySize", {
    size: kb.toLocaleString(currentLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  });
}
