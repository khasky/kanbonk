import { type MessageKey, t } from "../i18n";
import { type Priority, priorities, priorityColors } from "../model";
import { readableTextColor } from "../model/labelColors";
import { Icon } from "../ui/Icon";

const priorityKeys: Record<Priority, MessageKey> = {
  critical: "priority.critical",
  high: "priority.high",
  medium: "priority.medium",
  low: "priority.low",
};

/** The name of a priority in the current language. */
export const priorityName = (priority: Priority) => t(priorityKeys[priority]);

/** A priority as a small colored chip, as on tiles and in the card. */
export function PriorityChip({ priority, className = "" }: { priority: Priority; className?: string }) {
  const color = priorityColors[priority];
  return (
    <span
      className={`inline-flex items-center rounded-[3px] font-bold ${className}`}
      style={{ background: color, color: readableTextColor(color) }}
    >
      {priorityName(priority)}
    </span>
  );
}

/** The priorities as colored rows and "None" last; `current`, if given, is marked. */
export function PriorityPicker({
  current,
  onPick,
}: {
  current?: Priority | "none";
  onPick: (priority: Priority | undefined) => void;
}) {
  const rowClass =
    "flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border-0 px-2.5 text-left font-semibold hover:opacity-85";
  return (
    <div className="grid gap-1" role="group" aria-label={t("priority.title")}>
      {[...priorities, undefined].map((priority) => {
        const color = priority && priorityColors[priority];
        const chosen = current !== undefined && (priority ?? "none") === current;
        return (
          <button
            key={priority ?? "none"}
            type="button"
            className={`${rowClass} ${color ? "" : "bg-surface-sunken text-ink-subtle"}`}
            style={color ? { background: color, color: readableTextColor(color) } : undefined}
            aria-pressed={current === undefined ? undefined : chosen}
            onClick={() => onPick(priority)}
          >
            {priority ? priorityName(priority) : t("priority.none")}
            {chosen && <Icon name="check" className="ml-auto size-4" />}
          </button>
        );
      })}
    </div>
  );
}
