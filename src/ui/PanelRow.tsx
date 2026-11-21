import type { HTMLAttributes, ReactNode } from "react";

const rowLooks = {
  line: "border-b border-line py-3",
  boxed: "rounded-md border border-line px-3 py-2.5",
};

/**
 * A row of a list in a panel: text on the left, actions on the right. `boxed` frames each row; `wrap` lets the
 * actions drop under the text on narrow screens. Put the text in `PanelRowText`, its second line in `PanelRowNote`
 * and the buttons as `<Button variant="secondary" className="flex-none">`.
 */
export function PanelRow({
  look = "line",
  wrap = false,
  className,
  children,
}: {
  look?: keyof typeof rowLooks;
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const gap = look === "boxed" ? "gap-3" : wrap ? "flex-wrap gap-2" : "gap-2.5";
  return (
    <div className={`flex items-center justify-between ${gap} ${rowLooks[look]}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/** The text part of a `PanelRow`; long words break instead of pushing the actions out. */
export function PanelRowText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={className ? `min-w-0 wrap-anywhere ${className}` : "min-w-0 wrap-anywhere"} {...props} />;
}

/** A muted second line (date, details) under a `PanelRow`'s text. */
export function PanelRowNote(props: HTMLAttributes<HTMLElement>) {
  return <small className="mt-[3px] block text-ink-muted" {...props} />;
}

/** Buttons side by side that wrap onto more lines when there is no room. `className` adds layout only. */
export function RowActions({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "span";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={
        className
          ? `flex flex-row flex-wrap items-center gap-1.5 ${className}`
          : "flex flex-row flex-wrap items-center gap-1.5"
      }
    >
      {children}
    </Tag>
  );
}
