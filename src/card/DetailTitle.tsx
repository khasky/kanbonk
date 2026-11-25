import type { ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";

/**
 * The heading of a section of the card's details. Its icon hangs in the 36px gutter left of the card's content, so
 * section titles and their content line up with the card title; `children` may hold controls after the text.
 */
export function DetailTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h3 className="mt-0 mb-3 -ml-9 flex min-h-8 items-center gap-3 text-[14px] font-semibold">
      <span className="grid size-6 flex-none place-items-center text-ink-subtle">
        <Icon name={icon} />
      </span>
      {children}
    </h3>
  );
}
