import type { ButtonHTMLAttributes, Ref } from "react";

export type ButtonVariant =
  | "primary"
  | "primary-danger"
  | "secondary"
  | "outline"
  | "danger"
  | "link"
  | "icon"
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
    look: "text-[14px] rounded-sm border-0 bg-surface-sunken font-normal text-ink hover:bg-line disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-sunken",
    size: "sm",
  },
  // An open popover's button (`aria-expanded`) turns dark, so it is clear which button the popover belongs to.
  outline: {
    look: "text-[14px] flex items-center gap-1.5 rounded-sm border border-line bg-white font-medium text-ink hover:bg-surface-sunken aria-expanded:border-ink-subtle aria-expanded:bg-ink-subtle aria-expanded:text-white disabled:cursor-not-allowed disabled:opacity-50",
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

const fixed: Record<"link" | "icon" | "toolbar", string> = {
  link: "cursor-pointer border-0 bg-transparent p-0 text-brand underline",
  icon: "grid place-items-center rounded-sm border-0 bg-transparent p-[5px] text-ink-subtle hover:bg-line",
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
 * framed one with an optional icon (the card's quick actions and section buttons), `danger` a soft red
 * destructive one, `link` an inline text link, `icon` a borderless icon button, `toolbar` a button on the board's
 * colored toolbar.
 *
 * `size` sets the padding of `primary`, `primary-danger`, `secondary`, `outline` and `danger`: `sm` 6×9px (rows, section titles,
 * small forms; default of `secondary`), `md` 7×11px (the card's actions; default of `outline` and `danger`), `lg` 8×12px (dialog
 * footers and forms; default of the primaries).
 * Their text is always 14px, so a button in a section title matches the others.
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
