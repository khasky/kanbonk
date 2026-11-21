export type TrelloRecord = Record<string, unknown>;

export function object(value: unknown): TrelloRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as TrelloRecord) : {};
}

export function array(value: unknown): TrelloRecord[] {
  return Array.isArray(value) ? value.map(object) : [];
}

export function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Kanbonk has no archive: what is closed in Trello is imported into the trash, where it can be restored for 30 days. */
export function closedInTrello(closed: unknown, id: string): { deletedAt?: string; deletedBatch?: string } {
  return closed === true ? { deletedAt: new Date().toISOString(), deletedBatch: `trello-closed-${id}` } : {};
}
