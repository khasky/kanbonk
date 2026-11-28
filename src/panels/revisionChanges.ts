import { currentLocale, type MessageKey, t } from "../i18n";
import type { Revision, Zone } from "../model";

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
  { fields: ["labelIds"], key: "card.labels", counted: true },
  { fields: ["memberIds", "members"], key: "card.members", counted: true },
  { fields: ["startAt", "dueAt", "dueReminderMinutes"], key: "card.dates" },
  { fields: ["checklists"], key: "card.checklist", counted: true },
  { fields: ["links"], key: "links.title", counted: true },
  { fields: ["isEpic"], key: "links.epic" },
  { fields: ["comments"], key: "board.comments", counted: true },
  { fields: ["attachments"], key: "card.attachments", counted: true },
  { fields: ["cover"], key: "card.cover" },
  { fields: ["color"], key: "panels.historyColor" },
  { fields: ["background", "backgroundImageId"], key: "panels.historyBackground" },
  { fields: ["zones"], key: "panels.historyZones" },
  { fields: ["automationRules"], key: "board.automation", counted: true },
  { fields: ["isTemplate"], key: "board.template" },
  { fields: ["starred"], key: "pages.starred" },
  { fields: ["position"], key: "card.position" },
];
const partOf = new Map(parts.flatMap((part) => part.fields.map((field) => [field, part] as const)));

/**
 * What changed from `previous` to `current`, one line per change, e.g. "Title: “Plan” → “Release plan”", "Comments
 * (+2)" or "Zone “Development” added"; the oldest kept version has no previous.
 */
export function revisionChanges(previous: Snapshot | undefined, current: Snapshot): string[] {
  if (!previous) return [t("panels.historyOldest")];
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
    .flatMap((part) => {
      if (part.key === "panels.historyTrashed" && !after.deletedAt && !after.deleted)
        return [t("panels.historyRestored")];
      if (part.key === "card.title")
        return [t("panels.historyRenamed", { field: t(part.key), from: String(before.name), to: String(after.name) })];
      if (part.key === "panels.historyZones") return zoneChanges(before.zones, after.zones);
      const name = t(part.key);
      if (!part.counted) return [name];
      const delta = count(after[part.fields[0]]) - count(before[part.fields[0]]);
      return [delta ? `${name} (${delta > 0 ? "+" : "−"}${Math.abs(delta)})` : name];
    });
  if (changed.has(undefined)) names.push(t("panels.historyOther"));
  return names.length ? names : [t("panels.historyNoChanges")];
}

/** The zones of a board that were added, removed, renamed or recolored. */
function zoneChanges(before: unknown, after: unknown): string[] {
  const old = new Map(((before as Zone[] | undefined) ?? []).map((zone) => [zone.id, zone]));
  const now = (after as Zone[] | undefined) ?? [];
  const lines = now.flatMap((zone) => {
    const was = old.get(zone.id);
    if (!was) return [t("panels.historyZoneAdded", { name: zone.name })];
    return [
      ...(was.name !== zone.name ? [t("panels.historyZoneRenamed", { from: was.name, to: zone.name })] : []),
      ...(was.color !== zone.color ? [t("panels.historyZoneColor", { name: zone.name })] : []),
    ];
  });
  const kept = new Set(now.map((zone) => zone.id));
  for (const zone of old.values())
    if (!kept.has(zone.id)) lines.push(t("panels.historyZoneRemoved", { name: zone.name }));
  return lines.length ? lines : [t("panels.historyZones")];
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
