import type { HTMLAttributes } from "react";

const tones = {
  muted: "text-[13px] leading-[1.45] text-ink-muted",
  subtle: "text-[13px] leading-normal text-ink-subtle",
};

/**
 * A short note under a control or section. `tone="subtle"` matches the darker intro text of the import and sync
 * dialogs. `as="small"` for a note inside a label or row.
 */
export function Hint({
  as: Tag = "p",
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "p" | "small"; tone?: keyof typeof tones }) {
  return <Tag className={tones[tone]} {...props} />;
}
