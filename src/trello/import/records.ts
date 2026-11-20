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
