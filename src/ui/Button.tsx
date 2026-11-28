import type { ButtonHTMLAttributes, Ref } from "react";

export type ButtonVariant =
  | "primary"
  | "primary-danger"
  | "secondary"
  | "outline"
  | "done"
  | "danger"
  | "link"
  | "link-quiet"
  | "text"
  | "icon"
  | "icon-framed"
  | "icon-inverse"
  | "row"
  | "chip"
  | "add-card"
  | "add-list"
  | "placeholder"
  | "placeholder-raised"
  | "create-tile"
  | "topbar"
  | "badge"
  | "nav"
  | "dot"
  | "toolbar";
export type ButtonSize = "sm" | "md" | "lg";

const sized: Partial<Record<ButtonVariant, { look: string; size: ButtonSize }>> = {
  primary: {
    look: "text-[14px] rounded-[3px] border-0 bg-brand font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50",
    size: "lg",
  },
  "primary-danger": {
    look: "text-[14px] rounded-[3px] border-0 bg-[#c9372c] font-semibold text-white hover:bg-danger disabled:cursor-not-allowed disabled:opacity-50",
    size: "lg",
  },
  secondary: {
    look: "text-[14px] rounded-sm border-0 bg-surface-sunken font-normal text-ink hover:bg-line aria-expanded:bg-line disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-sunken",
    size: "sm",
  },
  // An open popover's button (`aria-expanded`) turns dark, so it is clear which button the popover belongs to.
  outline: {
    look: "h-8 text-[15px] flex items-center gap-1.5 rounded-sm border border-line bg-white font-medium text-ink hover:bg-surface-sunken aria-expanded:border-ink-subtle aria-expanded:bg-ink-subtle aria-expanded:text-white disabled:cursor-not-allowed disabled:opacity-50",
    size: "md",
  },
  // Pressed (`aria-pressed`), it turns green: the card's Done toggle.
  done: {
    look: "h-8 text-[15px] flex items-center gap-1.5 rounded-sm border border-line bg-white font-medium text-ink hover:bg-surface-sunken aria-pressed:border-success aria-pressed:bg-success aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-50",
    size: "md",
  },
  danger: {
    look: "text-[14px] rounded-sm border-0 bg-danger-soft font-normal text-danger disabled:cursor-not-allowed disabled:opacity-50",
    size: "md",
  },
};

const paddings: Record<ButtonSize, string> = {
  sm: "px-[9px] py-1.5",
  md: "px-[11px] py-[7px]",
  lg: "px-3 py-2",
};

const fixed: Record<Exclude<ButtonVariant, keyof typeof sized>, string> = {
  link: "cursor-pointer border-0 bg-transparent p-0 text-brand underline",
  "link-quiet": "cursor-pointer border-0 bg-transparent p-0 text-left text-brand hover:underline",
  text: "cursor-pointer border-0 bg-transparent p-0 text-left text-inherit hover:underline",
  icon: "grid cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-[5px] text-ink-subtle hover:bg-line aria-expanded:bg-line disabled:cursor-not-allowed disabled:opacity-50",
  "icon-framed":
    "grid cursor-pointer place-items-center rounded-sm border border-line bg-white p-[5px] text-ink-subtle hover:bg-surface-sunken aria-expanded:bg-line disabled:cursor-not-allowed disabled:opacity-50",
  "icon-inverse":
    "grid cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-[3px] text-white hover:bg-[#0003] disabled:cursor-not-allowed disabled:opacity-50",
  chip: "cursor-pointer truncate rounded-sm border-0 bg-brand-soft px-1.5 py-[3px] text-left text-[12px] text-ink hover:bg-line",
  // "Add a card" and "Create from template" at the bottom of a list.
  "add-card":
    "flex w-full cursor-pointer items-center gap-[7px] rounded-md border-0 bg-transparent p-2 text-left text-[16px] text-ink-subtle hover:bg-line max-phone:min-h-11",
  // "Add a list" and "New zone" on the board background.
  "add-list":
    "flex w-full cursor-pointer items-center gap-[7px] rounded-md border-0 bg-transparent p-2 text-left font-semibold text-white hover:bg-[#ffffff38] max-phone:min-h-11",
  // `!`: the card dialog makes its buttons 44px high on phones, which must not shrink this one.
  placeholder:
    "min-h-14! w-full cursor-text rounded-sm border-0 bg-surface-sunken p-2.5 text-left text-ink-subtle hover:bg-line",
  "placeholder-raised":
    "w-full cursor-text rounded-lg border-0 bg-white px-3 py-2.5 text-left text-ink-subtle shadow-tile hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white",
  "create-tile":
    "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-0 bg-surface-sunken p-3.5 text-left text-ink-subtle no-underline shadow-tile hover:brightness-95",
  // Touch-sized on phones.
  topbar:
    "cursor-pointer rounded-[3px] border-0 bg-topbar-button px-3 py-[7px] text-inherit max-phone:min-h-11 max-phone:px-2.5 max-phone:py-2 max-phone:text-[14px]",
  // The sync badge; `data-state` picks its colors.
  badge:
    "cursor-pointer whitespace-nowrap rounded-[20px] border-0 px-[9px] py-[5px] text-[12px] max-phone:min-h-11 max-phone:px-2.5 max-phone:py-2 max-phone:text-[14px] data-[state=offline]:bg-ink-muted data-[state=offline]:text-white data-[state=pending]:bg-[#7f5f01] data-[state=pending]:text-[#fff7d6] data-[state=synced]:bg-[#164b35] data-[state=synced]:text-[#baf3db]",
  // A sidebar link; the current page (`aria-current`) or a shown panel (`aria-pressed`) is highlighted.
  nav: "flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent p-1.5 text-left font-bold text-brand no-underline hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-pressed:bg-brand-soft",
  // The handle in the middle of a graph link; its fill color comes from `className`.
  dot: "size-3.5 -translate-1/2 cursor-pointer rounded-full border-2 border-white p-0 shadow hover:scale-125",
  row: "flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent px-[9px] py-1.5 text-left text-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50",
  // Labels shrink to their icon on tablets; on phones the button becomes a 44px touch target.
  toolbar:
    "flex min-h-8 items-center gap-1.5 rounded-[3px] border-0 bg-[#ffffff26] px-[9px] py-[7px] text-white hover:bg-[#ffffff45] max-tablet:text-[0px] max-tablet:[&>svg]:text-[length:initial] max-phone:min-h-11 max-phone:min-w-11 max-phone:flex-none max-phone:justify-center",
};

/** The class of a `Button`, for an element that must look like one (e.g. the `<label>` of a `FileButton`). */
export function buttonClass(variant: ButtonVariant, size?: ButtonSize, className?: string): string {
  const look = sized[variant];
  const classes = look ? `${look.look} ${paddings[size ?? look.size]}` : fixed[variant as keyof typeof fixed];
  return className ? `${classes} ${className}` : classes;
}

/**
 * The app's buttons. `primary` is the main action of a form or dialog, `primary-danger` a confirmed destructive one,
 * `secondary` a grey one for every other action (also the Cancel or Close of a dialog footer), `outline` a white
 * framed one with an optional icon (the card's quick actions and section buttons), `done` an outline toggle that
 * turns green when pressed, `danger` a soft red
 * destructive one, `link` an inline text link, `link-quiet` a brand-colored text button underlined on hover (a card's name
 * in a list or table), `text` a text button in the color of its surroundings, underlined on hover, `icon` a
 * borderless icon button (give it a `size-*` to make it a fixed square), `icon-framed` the same in a white frame
 * (the "+" after a card's labels and members), `icon-inverse` a white one on a colored surface (a zone's header),
 * `row` a full-width row of a popover or panel list, `chip` a small card entry (the year calendar), `add-card` /
 * `add-list` the "add" buttons at the bottom of a list and on the board background, `placeholder` a grey "click to
 * write" field (the empty description), `placeholder-raised` a white one (the comment box), `create-tile` the
 * "+ Create" tile at the end of a grid of boards or workspaces, `topbar` a button in the dark top bar, `badge` the
 * sync badge (its colors by `data-state`), `nav` a sidebar link (also for an `AppLink` through `buttonClass`), `dot`
 * the handle of a graph link (its fill color is the one non-layout class `className` may add), `toolbar` a button on the board's colored toolbar.
 *
 * `size` sets the padding of `primary`, `primary-danger`, `secondary`, `outline`, `done` and `danger`: `sm` 6×9px (rows, section titles,
 * small forms; default of `secondary`), `md` 7×11px (the card's actions; default of `outline` and `danger`), `lg` 8×12px (dialog
 * footers and forms; default of the primaries).
 * Their text is 14px; `outline` (only in the open card) has 15px text and is always 32px high, as the card's buttons in Trello.
 * The other variants have one size. `className` may only add layout (margins, flex, width, display).
 */
export function Button({
  variant,
  size,
  className,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}) {
  // `data-inline` keeps a text link out of the 44px touch targets that dialogs give their buttons on phones.
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      data-inline={variant === "link" || undefined}
      {...props}
    />
  );
}
