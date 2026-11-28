import { type ButtonHTMLAttributes, createContext, type ReactNode, type Ref, use } from "react";

type MenuPlacement = "default" | "topbar";
/** Whether the open menu's rows are 44px touch targets on phones. */
const TouchRowsContext = createContext(false);

const popoverTop = { default: "top-[calc(100%+6px)]", topbar: "top-[calc(100%+8px)]" };
const summaryFocus = { default: "focus-visible:outline-brand", topbar: "focus-visible:outline-brand-light" };

/**
 * A dropdown menu opened from a "⋯" button. It closes when focus leaves it, on Escape (which then goes no further, so
 * a dialog around the menu stays open) and after one of its buttons is pressed. `keepOpen` lets an item such as a color picker take focus without closing the menu. `className` adds layout
 * to the menu (e.g. a z-index), `summaryClassName` styles the "⋯" button; the menu is a `group/menu`, so the button
 * can style its open state with `group-open/menu:`. `placement="topbar"` is the menu in the dark top bar; `touchRows`
 * makes its rows 44px touch targets on phones.
 */
export function Menu({
  label,
  className,
  summaryClassName,
  placement = "default",
  touchRows = false,
  children,
  keepOpen,
  ref,
}: {
  label: string;
  className?: string;
  summaryClassName?: string;
  placement?: MenuPlacement;
  touchRows?: boolean;
  children: ReactNode;
  keepOpen?: (target: Element) => boolean;
  ref?: Ref<HTMLDetailsElement>;
}) {
  const summary = `cursor-pointer list-none in-[fieldset:disabled]:pointer-events-none in-[fieldset:disabled]:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ${summaryFocus[placement]} [&::-webkit-details-marker]:hidden`;
  return (
    <details
      ref={ref}
      className={
        className ? `group/menu relative flex-none open:z-40 ${className}` : "group/menu relative flex-none open:z-40"
      }
      onBlur={(event) => {
        if (!keepOpen?.(event.target as Element) && !event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          // Only the menu closes, not a dialog it is in.
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        className={summaryClassName ? `${summary} ${summaryClassName}` : summary}
        aria-label={label}
        title={label}
      >
        ⋯
      </summary>
      <div
        className={`absolute right-0 z-40 grid max-h-[calc(100dvh-120px)] w-[min(240px,calc(100vw-24px))] gap-0.5 overflow-y-auto rounded-lg border border-line bg-white p-1.5 text-[14px] font-normal text-ink shadow-[0_8px_24px_#091e4240] ${popoverTop[placement]}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            (event.currentTarget.parentElement as HTMLDetailsElement).open = false;
        }}
      >
        <TouchRowsContext value={touchRows}>{children}</TouchRowsContext>
      </div>
    </details>
  );
}

/** Look of a menu row; also for a `<label>` row that wraps an input. */
export const menuItemClass =
  "block w-full cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-[9px] text-left text-inherit hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";

/** A row of a `Menu`. `danger` marks a destructive action. */
export function MenuItem({
  danger,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean;
}) {
  const touch = use(TouchRowsContext) ? " max-phone:min-h-11" : "";
  const look = danger
    ? "block w-full cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-[9px] text-left text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    : menuItemClass;
  return <button className={look + touch} {...props} />;
}

/** A row of a `Menu` that picks one file from this device; it clears itself, so the same file can be picked again. */
export function MenuFileItem({
  children,
  accept,
  onFile,
}: {
  children: ReactNode;
  accept?: string;
  onFile: (file: File | null) => void;
}) {
  const touch = use(TouchRowsContext) ? " max-phone:min-h-11" : "";
  return (
    <label
      className={`${menuItemClass} relative has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand${touch}`}
    >
      {children}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
    </label>
  );
}

/** A line between groups of menu rows. */
export function MenuSeparator() {
  return <hr className="mx-0 my-[3px] w-full border-x-0 border-b-0 border-t border-line" />;
}
