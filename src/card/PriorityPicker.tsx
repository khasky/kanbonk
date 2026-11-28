import { type MessageKey, t } from "../i18n";
import { type Priority, priorities, priorityColors } from "../model";
import { readableTextColor } from "../model/labelColors";
import { Button } from "../ui/Button";
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
  return (
    <div className="grid gap-1" role="group" aria-label={t("priority.title")}>
      {[...priorities, undefined].map((priority) => {
        const color = priority && priorityColors[priority];
        const chosen = current !== undefined && (priority ?? "none") === current;
        return (
          <Button
            key={priority ?? "none"}
            type="button"
            variant="row"
            className="h-8 font-semibold"
            style={{
              background: color ?? "var(--color-surface-sunken)",
              color: color ? readableTextColor(color) : "var(--color-ink-subtle)",
            }}
            aria-pressed={current === undefined ? undefined : chosen}
            onClick={() => onPick(priority)}
          >
            {priority ? priorityName(priority) : t("priority.none")}
            {chosen && <Icon name="check" className="ml-auto size-4" />}
          </Button>
        );
      })}
    </div>
  );
}
