import type { ButtonHTMLAttributes } from "react";

const looks = {
  // A day number in a board calendar's grid: a small round chip, filled on today.
  label: {
    base: "m-0.5 inline-block cursor-pointer rounded-[10px] border-0 px-1.5 py-[3px] text-[12px]",
    today: "bg-brand text-white",
    day: "bg-transparent text-ink hover:bg-line",
    outside: "bg-transparent text-ink-faint hover:bg-line",
  },
  // A day of a date picker's month: a 32px cell; today is in brand text with a bar under it.
  cell: {
    base: "relative h-8 cursor-pointer rounded-[3px] border-0 text-[14px]",
    today: "bg-transparent font-semibold text-brand hover:bg-surface-sunken",
    day: "bg-transparent text-ink hover:bg-surface-sunken",
    outside: "bg-transparent text-ink-faint hover:bg-surface-sunken",
  },
};

/**
 * A day of a calendar. `look="label"` is the day number in a board calendar, `cell` a day of a date picker, which can
 * be `selected` (a start or due date) or `between` them. `outside` marks a day of another month. `className` may only
 * add layout.
 */
export function DayButton({
  look,
  today,
  outside,
  selected,
  between,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  look: keyof typeof looks;
  today?: boolean;
  outside?: boolean;
  selected?: boolean;
  between?: boolean;
}) {
  const style = looks[look];
  const state = selected
    ? "rounded-[3px] bg-brand font-semibold text-white hover:bg-brand-hover"
    : between
      ? "rounded-none bg-brand-soft text-ink hover:bg-[#cce0ff]"
      : today
        ? style.today
        : outside
          ? style.outside
          : style.day;
  return (
    <button
      type="button"
      className={`${style.base} ${state}${className ? ` ${className}` : ""}`}
      aria-current={today ? "date" : undefined}
      {...props}
    >
      {children}
      {look === "cell" && today && !selected && (
        <span className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-brand" aria-hidden="true" />
      )}
    </button>
  );
}
