import type { ReactNode } from "react";

/**
 * A button filled with a color to pick it; `pressed` outlines the chosen one. `children` (e.g. a check mark) show on
 * it in white. `className` may only add layout (its width).
 */
export function Swatch({
  color,
  label,
  pressed,
  className,
  children,
  onClick,
}: {
  color: string;
  label: string;
  pressed: boolean;
  className?: string;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`grid h-8 cursor-pointer place-items-center rounded-sm border-0 text-white hover:opacity-85 aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-brand${className ? ` ${className}` : ""}`}
      style={{ background: color }}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
