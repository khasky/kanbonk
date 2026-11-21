import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export type FieldSize = "sm" | "md";

// 16px text on phones keeps iOS from zooming into a focused field.
const look =
  "rounded-sm border border-ink-faint bg-white font-normal text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted max-phone:text-[16px]";
const sizes: Record<FieldSize, string> = {
  sm: "px-2 py-1.5 text-[14px]",
  md: "p-2.5 text-[14px]",
};

function fieldClass(size: FieldSize, className?: string) {
  return className ? `${look} ${sizes[size]} ${className}` : `${look} ${sizes[size]}`;
}

/**
 * The app's form fields. `size="md"` (default) is the field of a dialog, composer or form; `sm` a compact field in a
 * dense row (filters, card dates, the boxes under the card's actions). `className` may only add layout (width,
 * height, margins, flex, resize).
 */
export function Input({
  size = "md",
  className,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
  ref?: Ref<HTMLInputElement>;
}) {
  return <input ref={ref} className={fieldClass(size, className)} {...props} />;
}

/** A dropdown with the look of `Input`. */
export function Select({
  size = "md",
  className,
  ref,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: FieldSize;
  ref?: Ref<HTMLSelectElement>;
}) {
  return <select ref={ref} className={fieldClass(size, className)} {...props} />;
}

/** A multi-line field with the look of `Input`; it resizes vertically. */
export function Textarea({
  size = "md",
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: FieldSize;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea ref={ref} className={fieldClass(size, className ? `resize-y ${className}` : "resize-y")} {...props} />
  );
}

/**
 * A native checkbox (or, with `type="radio"`, radio button) in the brand color, without the margins the browser
 * gives it; put it in a `flex items-center` label.
 */
export function Checkbox({
  className,
  type = "checkbox",
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "checkbox" | "radio";
  ref?: Ref<HTMLInputElement>;
}) {
  const check = "m-0 size-4 flex-none cursor-pointer accent-brand disabled:cursor-not-allowed";
  return <input ref={ref} type={type} className={className ? `${check} ${className}` : check} {...props} />;
}
