import { useClock } from "../app/useClock";
import { formatDateTime, t } from "../i18n";
import { lifetimeLeft } from "../model";
import { Icon } from "../ui/Icon";

/** "2d 5h left" for a temporary board, from the clock. */
export function useTimeLeft(expiresAt: string): string {
  const { days, hours } = lifetimeLeft(expiresAt, useClock().now);
  return days ? t("board.timeLeftDays", { days, hours }) : t("board.timeLeftHours", { hours });
}

/** When a temporary board moves to the trash, for a tooltip. */
export function expiryTitle(expiresAt: string): string {
  return `${t("board.temporaryBoard")}. ${t("board.expiresAt", { date: formatDateTime(expiresAt) })}`;
}

/**
 * A temporary board's mark: a clock with the time it has left, on a translucent chip in the color of the text around
 * it (a board's tile or toolbar). `compact` shows only the clock, as in the sidebar.
 */
export function TemporaryBadge({ expiresAt, compact = false }: { expiresAt: string; compact?: boolean }) {
  const left = useTimeLeft(expiresAt);
  if (compact)
    return (
      <span className="inline-flex flex-none text-ink-subtle" title={`${expiryTitle(expiresAt)} (${left})`}>
        <Icon name="clock" className="size-3.5" />
        <span className="sr-only">{`${t("board.temporaryBoard")}, ${left}`}</span>
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] bg-[#00000033] px-1.5 py-0.5 text-[12px] font-semibold whitespace-nowrap"
      title={expiryTitle(expiresAt)}
    >
      <Icon name="clock" className="size-3.5" />
      {left}
    </span>
  );
}
