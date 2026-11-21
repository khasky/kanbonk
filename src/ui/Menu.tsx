import type { ReactNode, Ref } from "react";

/**
 * A dropdown menu opened from a "⋯" button. It closes when focus leaves it, on Escape and after one of its buttons is
 * pressed. `keepOpen` lets an item such as a color picker take focus without closing the menu.
 */
export function Menu({
  label,
  className,
  summaryClassName,
  children,
  keepOpen,
  ref,
}: {
  label: string;
  className?: string;
  summaryClassName?: string;
  children: ReactNode;
  keepOpen?: (target: Element) => boolean;
  ref?: Ref<HTMLDetailsElement>;
}) {
  return (
    <details
      ref={ref}
      className={className ? `menu ${className}` : "menu"}
      onBlur={(event) => {
        if (!keepOpen?.(event.target as Element) && !event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className={summaryClassName} aria-label={label} title={label}>
        ⋯
      </summary>
      <div
        className="menu-popover"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
