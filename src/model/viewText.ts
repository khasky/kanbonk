import { currentLocale, formatDateTime, t } from "../i18n";

const units = [
  { unit: "year", ms: 365 * 86_400_000 },
  { unit: "month", ms: 30 * 86_400_000 },
  { unit: "week", ms: 7 * 86_400_000 },
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
] as const;

/** How long ago, in the shortest form of the language: "2d", "3 ч", "5分". Under a minute is "now". */
export function viewAge(at: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(at));
  const match = units.find((item) => elapsed >= item.ms);
  if (!match) return t("views.justNow");
  return new Intl.NumberFormat(currentLocale(), { style: "unit", unit: match.unit, unitDisplay: "narrow" }).format(
    Math.floor(elapsed / match.ms),
  );
}

/** The tooltip of a view badge: how many views, and when the last one was. */
export function viewedTitle(count: number, lastAt?: string): string {
  const views = t("views.viewCount", { count });
  return lastAt ? `${views} · ${t("views.lastViewed", { time: formatDateTime(lastAt) })}` : views;
}
