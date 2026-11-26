import { formatDate, formatDateTime, t } from "../i18n";
import { lastDays, type ViewStats } from "../model/views";
import { viewAge } from "../model/viewText";
import { detailSectionClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

const weeks = 12;

/** The shade of a day with `count` views, against the busiest day shown. */
function dayColor(count: number, most: number): string {
  if (!count) return "var(--color-surface-sunken)";
  const strength = 0.25 + 0.75 * (count / Math.max(1, most));
  return `color-mix(in srgb, var(--color-brand) ${Math.round(strength * 100)}%, white)`;
}

/**
 * Who opened the card and when, like the "Card Views" panel of Trello's view-counting Power-Ups: totals, a calendar of
 * the last weeks with a square per day, and each person's views. Views of every synced device count.
 */
export function CardViews({ stats }: { stats: ViewStats }) {
  const days = lastDays(weeks * 7);
  const most = Math.max(0, ...days.map((day) => stats.byDay.get(day) ?? 0));
  return (
    <section className={detailSectionClass} aria-label={t("views.cardViews")}>
      <DetailTitle icon="eye">{t("views.cardViews")}</DetailTitle>
      <p className="mt-0 mb-3 text-[14px] text-ink-subtle">
        {t("views.viewCount", { count: stats.total })} · {t("views.peopleCount", { count: stats.unique })}
        {stats.lastAt && ` · ${t("views.lastViewedBy", { time: viewAge(stats.lastAt), name: stats.lastBy ?? "" })}`}
      </p>
      <div
        className="mb-3 grid w-max grid-flow-col grid-rows-7 gap-[3px]"
        role="img"
        aria-label={t("views.activityByDay")}
      >
        {days.map((day) => {
          const count = stats.byDay.get(day) ?? 0;
          return (
            <span
              key={day}
              className="size-3 rounded-[2px]"
              style={{ background: dayColor(count, most) }}
              title={`${formatDate(`${day}T12:00:00`)}: ${t("views.viewCount", { count })}`}
            />
          );
        })}
      </div>
      <ul className="m-0 grid list-none gap-1 p-0 text-[14px]">
        {stats.viewers.map((viewer) => (
          <li key={viewer.name} className="flex items-center gap-2">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-line text-[10px] font-bold">
              {viewer.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{viewer.name}</span>
            <span className="text-ink-subtle" title={formatDateTime(viewer.lastAt)}>
              {t("views.viewCount", { count: viewer.count })} · {viewAge(viewer.lastAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
