import type { ButtonHTMLAttributes, ReactNode } from "react";

const tones = {
  default: "bg-[#0001]",
  toolbar: "bg-[#ffffff26] text-white",
};

/**
 * A row of tabs that switch one view. `tone="toolbar"` is the switch on the board's colored toolbar. `className` may
 * only add layout.
 */
export function Segmented({
  label,
  tone = "default",
  className,
  children,
}: {
  label: string;
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`inline-flex flex-wrap gap-0.5 rounded-md p-0.5 ${tones[tone]}${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label={label}
    >
      {children}
    </div>
  );
}

/** One tab of a `Segmented` group. */
export function SegmentedTab({
  selected,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> & { selected: boolean }) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      className="cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-1.5 text-inherit aria-selected:bg-white aria-selected:text-brand aria-selected:shadow-tile"
      {...props}
    />
  );
}
