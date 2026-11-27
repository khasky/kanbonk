import type { ReactNode } from "react";
import type { Label } from "../model";
import { readableTextColor } from "../model/labelColors";

const sizes = {
  sm: "min-h-6 px-2 text-[12px]",
  md: "min-h-7 px-3",
  lg: "min-h-8 px-3",
};

/**
 * A label in its color, with text that stays readable on it; a label without a color is grey. `size="sm"` in a
 * dense row (table cells), `md` (default) in lists of a panel, `lg` in a picker. `children` replaces the name (e.g.
 * a placeholder for an unnamed label). `className` may only add layout.
 */
export function LabelChip({
  label,
  size = "md",
  className,
  children,
}: {
  label: Label;
  size?: keyof typeof sizes;
  className?: string;
  children?: ReactNode;
}) {
  const color = label.color || "#dfe1e6";
  return (
    <span
      className={`flex min-w-12 items-center rounded-sm font-semibold wrap-anywhere ${sizes[size]}${className ? ` ${className}` : ""}`}
      style={{ background: color, color: readableTextColor(color) }}
    >
      {children ?? label.name}
    </span>
  );
}
